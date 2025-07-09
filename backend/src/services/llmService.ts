import { z } from 'zod';
import env from '../config/env';
import { Model, ModelEngine, ModelTask, getModelsByTask, LLM_CONFIG } from '../config/models';
import { BRAND_TAG_INSTRUCTION, buildSentimentRatingPrompt, buildSentimentSummaryPrompt, SentimentAverages, DEFAULT_QUESTION_SYSTEM_PROMPT, buildWebsiteEnrichmentPrompt } from '../prompts';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import zodToJsonSchema from 'zod-to-json-schema';

// --- Logging Interface ---
interface LLMLogContext {
    modelId: string;
    engine: string;
    operation: string;
    attempt?: number;
    maxAttempts?: number;
    duration?: number;
    tokenUsage?: { prompt: number; completion: number; total: number };
    error?: unknown;
    metadata?: Record<string, any>;
}

const llmLog = (context: LLMLogContext, message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO') => {
    // Simple console logging for now - can be enhanced to integrate with main logger later
    const timestamp = new Date().toISOString();
    const logData = {
        timestamp,
        level,
        service: 'LLM',
        ...context,
        message
    };
    
    if (level === 'ERROR') {
        console.error(`[LLM:${level}] ${timestamp}`, logData);
    } else if (level === 'DEBUG' && !process.env.LLM_DEBUG) {
        // Skip debug logs unless explicitly enabled
        return;
    } else {
        console.log(`[LLM:${level}] ${timestamp}`, logData);
    }
};

// --- Brand Tagging Instructions ---
// Centralised prompt imported from prompts/brandTag.ts

// --- Zod Schemas ---
const CompetitorSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().min(1),
});

const SentimentRatingSchema = z.object({
  quality: z.number().min(1).max(10),
  priceValue: z.number().min(1).max(10),
  brandReputation: z.number().min(1).max(10),
  brandTrust: z.number().min(1).max(10),
  customerService: z.number().min(1).max(10),
  summaryDescription: z.string(),
});

const SentimentScoresSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  ratings: z.array(SentimentRatingSchema).min(1, "At least one rating must be provided"),
});

export type SentimentScores = z.infer<typeof SentimentScoresSchema>;

// --- Question Input Interface ---
export interface QuestionInput {
    id: string;
    text: string;
    systemPrompt?: string;
}

// --- API Clients ---
const HTTP_TIMEOUT_MS = process.env.LLM_TIMEOUT_MS ? Number(process.env.LLM_TIMEOUT_MS) : 60_000;

const openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: HTTP_TIMEOUT_MS });
const perplexityClient = new OpenAI({ apiKey: env.PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai', timeout: HTTP_TIMEOUT_MS });
const anthropicClient = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: HTTP_TIMEOUT_MS }) : null;
const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;

llmLog({ 
    modelId: 'system', 
    engine: 'INIT', 
    operation: 'CLIENT_SETUP',
    metadata: {
        openaiAvailable: !!env.OPENAI_API_KEY,
        perplexityAvailable: !!env.PERPLEXITY_API_KEY,
        anthropicAvailable: !!anthropicClient,
        geminiAvailable: !!genAI
    }
}, 'LLM service initialized with available clients');

// --- Standardized Types ---
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResponse<T> {
  data: T;
  usage: TokenUsage;
}

export interface CompetitorInfo {
  name: string;
  website: string;
}

// --- Core Generic Completion Function ---
export async function generateChatCompletion(
  model: Model,
  prompt: string,
  schema?: z.ZodType<any>
): Promise<{ content: string | null; usage: TokenUsage }> {
  const operation = schema ? 'STRUCTURED_COMPLETION' : 'TEXT_COMPLETION';
  const maxRetries = LLM_CONFIG.MAX_RETRIES;
  let content: string | null = null;
  let usage: OpenAI.CompletionUsage | undefined = undefined;
  
  llmLog({ 
    modelId: model.id, 
    engine: model.engine, 
    operation,
    metadata: { 
      hasSchema: !!schema,
      promptLength: prompt.length,
      maxRetries
    }
  }, `Starting ${operation.toLowerCase()} request`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const attemptStartTime = Date.now();
    
    try {
      switch (model.engine) {
        case ModelEngine.OPENAI:
          if (schema) {
            const toolName = "structured_response";
            const openaiRes = await openaiClient.chat.completions.create({
              model: model.id,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: LLM_CONFIG.MAX_TOKENS,
              tools: [{
                type: 'function',
                function: {
                  name: toolName,
                  description: 'Extracts structured data from the prompt.',
                  parameters: zodToJsonSchema(schema),
                },
              }],
              tool_choice: 'auto',
            });
            content = openaiRes.choices[0].message.tool_calls?.[0].function.arguments || null;
            usage = openaiRes.usage;
          } else {
            const openaiRes = await openaiClient.chat.completions.create({
              model: model.id,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: LLM_CONFIG.MAX_TOKENS,
            });
            content = openaiRes.choices[0].message.content;
            usage = openaiRes.usage;
          }
          break;
        
        case ModelEngine.PERPLEXITY:
          const perplexityRes = await perplexityClient.chat.completions.create({
            model: model.id,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: LLM_CONFIG.MAX_TOKENS,
          });
          content = perplexityRes.choices[0].message.content;
          usage = perplexityRes.usage;
          break;
        
        case ModelEngine.ANTHROPIC:
          if (!anthropicClient) throw new Error('Anthropic client not initialized');
          
          if (schema) {
            const toolName = "structured_response";
            const anthropicRes = await anthropicClient.messages.create({
                model: model.id,
                max_tokens: LLM_CONFIG.MAX_TOKENS,
                messages: [{ role: 'user', content: prompt }],
                tools: [{
                    name: toolName,
                    description: 'Extracts structured data from the prompt.',
                    input_schema: zodToJsonSchema(schema) as any,
                }],
                tool_choice: { type: 'tool', name: toolName },
            });

            const toolUseBlock = anthropicRes.content.find(block => block.type === 'tool_use');
            if (toolUseBlock && 'input' in toolUseBlock) {
                content = JSON.stringify(toolUseBlock.input);
            } else {
                content = null;
            }
            
            usage = {
                prompt_tokens: anthropicRes.usage.input_tokens,
                completion_tokens: anthropicRes.usage.output_tokens,
                total_tokens: anthropicRes.usage.input_tokens + anthropicRes.usage.output_tokens,
            };
          } else {
             const anthropicRes = await anthropicClient.messages.create({
                model: model.id,
                max_tokens: LLM_CONFIG.MAX_TOKENS,
                messages: [{ role: 'user', content: prompt }],
              });
              content = anthropicRes.content[0].type === 'text' ? anthropicRes.content[0].text : null;
              usage = {
                prompt_tokens: anthropicRes.usage.input_tokens,
                completion_tokens: anthropicRes.usage.output_tokens,
                total_tokens: anthropicRes.usage.input_tokens + anthropicRes.usage.output_tokens,
              };
          }
          break;

        case ModelEngine.GOOGLE:
          const geminiModel = genAI?.getGenerativeModel({ model: model.id });
          if (!geminiModel) throw new Error('Gemini client not initialized for model: ' + model.id);
          
          const result = await withTimeout(
            geminiModel.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { 
                responseMimeType: 'application/json',
                maxOutputTokens: LLM_CONFIG.MAX_TOKENS
              },
            }), HTTP_TIMEOUT_MS, `${model.engine} generateContent`);
          content = result.response.text();
          const usageMetadata = result.response.usageMetadata;
          usage = {
            prompt_tokens: usageMetadata?.promptTokenCount ?? 0,
            completion_tokens: usageMetadata?.candidatesTokenCount ?? 0,
            total_tokens: usageMetadata?.totalTokenCount ?? 0,
          };
          break;

        default:
          throw new Error(`Unsupported engine: ${model.engine}`);
      }

      if (!content) throw new Error(`API call to ${model.engine} returned empty content.`);
      if (!usage) throw new Error(`API call to ${model.engine} returned empty usage data.`);
      
      const attemptDuration = Date.now() - attemptStartTime;
      
      return {
        content,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
      };

    } catch (error) {
      const attemptDuration = Date.now() - attemptStartTime;
      const isLastAttempt = attempt === maxRetries;
      
      if (isLastAttempt) {
        throw new Error(`Failed to get completion from ${model.engine} after ${maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      const backoffDelay = LLM_CONFIG.RETRY_BACKOFF_BASE * attempt;
      await new Promise(res => setTimeout(res, backoffDelay));
    }
  }
  
  throw new Error(`Failed to get completion from ${model.engine} after ${maxRetries} retries.`);
}

// --- Helper for JSON parsing ---
function extractAndCleanJSON(response: string): string | null {
    let text = response.trim();

    const markdownMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (markdownMatch) {
        text = markdownMatch[1].trim();
    }
    
    try {
        JSON.parse(text);
        return text;
    } catch (e) {
        return null;
    }
}

// --- Enhanced generateAndValidate ---
export async function generateAndValidate<T, U>(
    prompt: string,
    schema: z.ZodSchema<T>,
    model: Model,
    task: ModelTask,
    transform?: (data: T) => U,
    rescue?: (data: any) => any,
): Promise<{ data: U; usage: TokenUsage }> {
    const maxRetries = LLM_CONFIG.MAX_RETRIES;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await generateChatCompletion(model, prompt);
            
            let parsedData: any;
            try {
                parsedData = JSON.parse(result.content || '');
            } catch (parseError) {
                const cleanedJson = extractAndCleanJSON(result.content || '');
                if (cleanedJson) {
                    parsedData = JSON.parse(cleanedJson);
                } else {
                    throw parseError;
                }
            }

            if (rescue && parsedData) {
                parsedData = rescue(parsedData);
            }

            const validatedData = schema.parse(parsedData);
            const finalData = transform ? transform(validatedData) : (validatedData as unknown as U);

            return { data: finalData, usage: result.usage };

        } catch (error) {
            if (attempt === maxRetries) {
                throw new Error(`Failed to generate and validate data after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            await new Promise(res => setTimeout(res, LLM_CONFIG.RETRY_BACKOFF_BASE * attempt));
        }
    }
    
    throw new Error(`Failed to generate and validate data after ${maxRetries} retries.`);
}

// --- Sentiment Generation ---
export async function generateSentimentScores(companyName: string, industry: string, model: Model): Promise<ChatCompletionResponse<SentimentScores>> {
  const prompt = buildSentimentRatingPrompt(companyName, industry);

  const rescue = (data: any) => {
    if (Array.isArray(data)) {
      return {
        companyName: companyName,
        industry: industry,
        ratings: data,
      };
    }
    return data;
  };

  const result = await generateAndValidate(prompt, SentimentScoresSchema, model, ModelTask.SENTIMENT, (data) => data, rescue);
  return result as ChatCompletionResponse<SentimentScores>;
}

// --- Sentiment Summary Generation ---
export async function generateOverallSentimentSummary(companyName: string, sentiments: SentimentScores[]): Promise<ChatCompletionResponse<SentimentScores>> {
  const model = getModelsByTask(ModelTask.SENTIMENT_SUMMARY)[0];
  if (!model) throw new Error(`No models found for task: ${ModelTask.SENTIMENT_SUMMARY}`);

  const allRatings = sentiments.flatMap(s => s.ratings);
  
  if (allRatings.length === 0) {
    throw new Error('No sentiment ratings found to summarize');
  }

  const averages = {
    quality: Math.round(allRatings.reduce((sum, r) => sum + r.quality, 0) / allRatings.length),
    priceValue: Math.round(allRatings.reduce((sum, r) => sum + r.priceValue, 0) / allRatings.length),
    brandReputation: Math.round(allRatings.reduce((sum, r) => sum + r.brandReputation, 0) / allRatings.length),
    brandTrust: Math.round(allRatings.reduce((sum, r) => sum + r.brandTrust, 0) / allRatings.length),
    customerService: Math.round(allRatings.reduce((sum, r) => sum + r.customerService, 0) / allRatings.length)
  };

  const prompt = buildSentimentSummaryPrompt(companyName, averages as SentimentAverages);

  const { content: summaryText, usage } = await generateChatCompletion(model, prompt);
  
  if (!summaryText) {
    throw new Error('Failed to generate sentiment summary text');
  }

  const result: SentimentScores = {
    companyName,
    industry: sentiments[0]?.industry || '',
    ratings: [{
      ...averages,
      summaryDescription: summaryText.trim()
    }]
  };

  return { data: result, usage };
}

// --- Question Response Generation with Brand Tagging ---
export async function generateQuestionResponse(
    question: QuestionInput, 
    model: Model
): Promise<ChatCompletionResponse<string>> {
    const defaultSystemPrompt = DEFAULT_QUESTION_SYSTEM_PROMPT;

    const systemPrompt = question.systemPrompt || defaultSystemPrompt;

    const prompt = `
SYSTEM PROMPT: ${systemPrompt}
QUESTION: "${question.text}"
ANSWER:
`;
    
    const { content, usage: rawUsage } = await generateChatCompletion(model, prompt);

    if (!content) {
        throw new Error('LLM returned empty content for question response.');
    }

    return {
        data: content,
        usage: rawUsage,
    };
}

// --- Website Enrichment for Competitors ---
export async function generateWebsiteForCompetitors(competitorNames: string[]): Promise<ChatCompletionResponse<CompetitorInfo[]>> {
    const model = getModelsByTask(ModelTask.WEBSITE_ENRICHMENT)[0];
    if (!model) {
        throw new Error("No model configured for website enrichment task.");
    }

    if (competitorNames.length === 0) {
        return {
            data: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        };
    }

    const prompt = buildWebsiteEnrichmentPrompt(competitorNames);

    const schema = z.object({
        competitors: z.array(CompetitorSchema),
    });

    const result = await generateAndValidate(
        prompt, 
        schema, 
        model, 
        ModelTask.WEBSITE_ENRICHMENT,
        (data) => data as { competitors: CompetitorInfo[] }
    );

    return {
        data: result.data.competitors,
        usage: result.usage
    };
}

// --- Utility Functions ---
async function withTimeout<T>(promise: Promise<T>, ms: number, operationLabel = 'LLM request'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationLabel} exceeded timeout of ${ms} ms`));
    }, ms);

    promise.then(v => {
      clearTimeout(timer);
      resolve(v);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
} 