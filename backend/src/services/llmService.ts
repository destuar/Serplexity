import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import env from '../config/env';
import { z } from 'zod';
import { Model, ModelEngine, MODELS, getModelsByTask, ModelTask, LLM_CONFIG } from '../config/models';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Enhanced logging for LLM service
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
    // Simple, clean LLM service logs - let the reportWorker handle detailed logging
    if (level === 'ERROR') {
        console.error(`🤖 [${context.engine}/${context.modelId}] ERROR: ${message}`);
        if (context.error) {
            console.error(context.error);
        }
    } else if (level === 'WARN') {
        console.warn(`🤖 [${context.engine}/${context.modelId}] WARN: ${message}`);
    } else if (level === 'DEBUG') {
        const tokens = context.tokenUsage ? ` 🪙 ${context.tokenUsage.total}` : '';
        const timing = context.duration ? ` ⏱️ ${context.duration}ms` : '';
        console.log(`🤖 [${context.engine}/${context.modelId}] ${message}${tokens}${timing}`);
    }
    // Skip INFO and other levels to reduce noise
};

// --- Zod Schemas for LLM Responses ---
const CompetitorSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().min(1),
});
const CompetitorListSchema = z.array(CompetitorSchema);

const SentimentRatingSchema = z.object({
  quality: z.number().min(1).max(10),
  priceValue: z.number().min(1).max(10),
  brandReputation: z.number().min(1).max(10),
  brandTrust: z.number().min(1).max(10),
  customerService: z.number().min(1).max(10),
  summaryDescription: z.string().min(1),
});

// A more flexible schema that can handle both the desired array format
// and the erroneous object format, transforming the latter into the former.
const SentimentScoresSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  ratings: z.union([
    z.array(SentimentRatingSchema).length(1), // Correct format
    SentimentRatingSchema.transform(val => [val]) // Erroneous format, transformed
  ]),
});

export type SentimentScores = z.infer<typeof SentimentScoresSchema>;

// --- API Clients ---
const openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
const perplexityClient = new OpenAI({ apiKey: env.PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai' });
const anthropicClient = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
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

// --- Core Generic Completion Function ---
async function generateChatCompletion(
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
    
    llmLog({ 
      modelId: model.id, 
      engine: model.engine, 
      operation,
      attempt,
      maxAttempts: maxRetries
    }, `API call attempt ${attempt}/${maxRetries}`);

    try {
      switch (model.engine) {
        case ModelEngine.OPENAI:
          if (schema) {
            // Use Tool Calling for guaranteed JSON output
            const toolName = "structured_response";
            llmLog({ 
              modelId: model.id, 
              engine: model.engine, 
              operation,
              attempt,
              maxAttempts: maxRetries,
              metadata: { method: 'tool_calling', toolName }
            }, 'Using OpenAI tool calling for structured response');
            
            const openaiRes = await openaiClient.chat.completions.create({
              model: model.id,
              messages: [{ role: 'user', content: prompt }],
              tools: [{
                type: 'function',
                function: {
                  name: toolName,
                  description: 'Extracts structured data from the prompt.',
                  parameters: zodToJsonSchema(schema),
                },
              }],
              tool_choice: { type: 'function', function: { name: toolName } },
            });
            content = openaiRes.choices[0].message.tool_calls?.[0].function.arguments || null;
            usage = openaiRes.usage;
          } else {
            // Standard call for non-structured data
            llmLog({ 
              modelId: model.id, 
              engine: model.engine, 
              operation,
              attempt,
              maxAttempts: maxRetries,
              metadata: { method: 'standard_chat' }
            }, 'Using OpenAI standard chat completion');
            
            const openaiRes = await openaiClient.chat.completions.create({
              model: model.id,
              messages: [{ role: 'user', content: prompt }],
            });
            content = openaiRes.choices[0].message.content;
            usage = openaiRes.usage;
          }
          break;
        
        case ModelEngine.PERPLEXITY:
          llmLog({ 
            modelId: model.id, 
            engine: model.engine, 
            operation,
            attempt,
            maxAttempts: maxRetries,
            metadata: { 
              note: 'Perplexity does not support response_format',
              method: 'standard_chat'
            }
          }, 'Using Perplexity chat completion');
          
          const perplexityRes = await perplexityClient.chat.completions.create({
            model: model.id,
            messages: [{ role: 'user', content: prompt }],
            // Perplexity doesn't support response_format
          });
          content = perplexityRes.choices[0].message.content;
          usage = perplexityRes.usage;
          break;
        
        case ModelEngine.ANTHROPIC:
          if (!anthropicClient) throw new Error('Anthropic client not initialized');
          
          llmLog({ 
            modelId: model.id, 
            engine: model.engine, 
            operation,
            attempt,
            maxAttempts: maxRetries,
            metadata: { 
              method: 'messages_api',
              maxTokens: 4096
            }
          }, 'Using Anthropic messages API');
          
          const anthropicRes = await anthropicClient.messages.create({
            model: model.id,
            max_tokens: 4096,
            messages: [{ role: 'user', content: `${prompt}\n\nReturn the response as a single JSON object.` }],
          });
          content = anthropicRes.content[0].type === 'text' ? anthropicRes.content[0].text : null;
          usage = {
            prompt_tokens: anthropicRes.usage.input_tokens,
            completion_tokens: anthropicRes.usage.output_tokens,
            total_tokens: anthropicRes.usage.input_tokens + anthropicRes.usage.output_tokens,
          };
          break;

        case ModelEngine.GOOGLE:
          const geminiModel = genAI?.getGenerativeModel({ model: model.id });
          if (!geminiModel) throw new Error('Gemini client not initialized for model: ' + model.id);
          
          llmLog({ 
            modelId: model.id, 
            engine: model.engine, 
            operation,
            attempt,
            maxAttempts: maxRetries,
            metadata: { 
              method: 'generate_content',
              responseMimeType: 'application/json'
            }
          }, 'Using Google Gemini generate content');
          
          const result = await geminiModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          });
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
      const tokenUsage = {
        prompt: usage.prompt_tokens,
        completion: usage.completion_tokens,
        total: usage.total_tokens
      };
      
      llmLog({ 
        modelId: model.id, 
        engine: model.engine, 
        operation,
        attempt,
        maxAttempts: maxRetries,
        duration: attemptDuration,
        tokenUsage,
        metadata: { 
          contentLength: content.length,
          success: true
        }
      }, `API call successful on attempt ${attempt}/${maxRetries}`);
      
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
      
      llmLog({ 
        modelId: model.id, 
        engine: model.engine, 
        operation,
        attempt,
        maxAttempts: maxRetries,
        duration: attemptDuration,
        error,
        metadata: { 
          isLastAttempt,
          errorType: error instanceof Error ? error.name : 'Unknown'
        }
      }, `API call failed on attempt ${attempt}/${maxRetries}${isLastAttempt ? ' (final attempt)' : ''}`, 'ERROR');
      
      if (isLastAttempt) {
        throw new Error(`Failed to get completion from ${model.engine} after ${maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Exponential backoff
      const backoffDelay = LLM_CONFIG.RETRY_BACKOFF_BASE * attempt;
      llmLog({ 
        modelId: model.id, 
        engine: model.engine, 
        operation,
        attempt,
        maxAttempts: maxRetries,
        metadata: { backoffDelay }
      }, `Waiting ${backoffDelay}ms before retry`);
      
      await new Promise(res => setTimeout(res, backoffDelay));
    }
  }
  
  throw new Error(`Failed to get completion from ${model.engine} after ${maxRetries} retries.`);
}

// --- Helper for Parsing and Validation ---
async function generateAndValidate<T, U>(
  model: Model,
  prompt: string,
  schema: z.ZodType<T>,
  transform?: (data: T) => U
): Promise<ChatCompletionResponse<U>> {
  const operation = 'VALIDATE_PARSE';
  const startTime = Date.now();
  
  llmLog({ 
    modelId: model.id, 
    engine: model.engine, 
    operation,
    metadata: { 
      schemaType: schema.constructor.name,
      hasTransform: !!transform
    }
  }, 'Starting content generation and validation');

  const { content, usage } = await generateChatCompletion(model, prompt, schema);
  if (!content) {
    throw new Error('LLM returned empty content.');
  }

  let jsonString: string = content;
  if (model.engine !== ModelEngine.OPENAI) {
    llmLog({ 
      modelId: model.id, 
      engine: model.engine, 
      operation,
      metadata: { parseMethod: 'manual_extraction' }
    }, 'Extracting JSON from non-OpenAI response');
    
    // 1. Look for a markdown-formatted JSON block first.
    const markdownMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
      jsonString = markdownMatch[1];
      llmLog({ 
        modelId: model.id, 
        engine: model.engine, 
        operation,
        metadata: { extractionMethod: 'markdown_block' }
      }, 'Extracted JSON from markdown code block', 'DEBUG');
    } else {
      // 2. Fallback to finding the first and largest JSON-like object.
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
        llmLog({ 
          modelId: model.id, 
          engine: model.engine, 
          operation,
          metadata: { extractionMethod: 'regex_match' }
        }, 'Extracted JSON using regex matching', 'DEBUG');
      } else {
        llmLog({ 
          modelId: model.id, 
          engine: model.engine, 
          operation,
          error: new Error('No JSON found in response'),
          metadata: { 
            contentPreview: content.substring(0, 200),
            contentLength: content.length
          }
        }, 'No JSON object found in LLM response', 'ERROR');
        throw new Error("No JSON object found in the LLM's response.");
      }
    }
  }

  try {
    const parseStartTime = Date.now();
    const parsedData = JSON.parse(jsonString);
    const parseTime = Date.now() - parseStartTime;
    
    llmLog({ 
      modelId: model.id, 
      engine: model.engine, 
      operation,
      duration: parseTime,
      metadata: { 
        jsonLength: jsonString.length,
        parsedSuccessfully: true
      }
    }, 'JSON parsing successful', 'DEBUG');
    
    const validationStartTime = Date.now();
    const parsed = schema.safeParse(parsedData);
    const validationTime = Date.now() - validationStartTime;
    
    if (!parsed.success) {
      llmLog({ 
        modelId: model.id, 
        engine: model.engine, 
        operation,
        duration: validationTime,
        error: parsed.error,
        metadata: { 
          validationErrors: parsed.error.errors,
          jsonPreview: jsonString.substring(0, 200)
        }
      }, 'Zod validation failed', 'ERROR');
      throw new Error(`Failed to validate response from ${model.id}: ${parsed.error.message}`);
    }

    const totalDuration = Date.now() - startTime;
    const finalData = transform ? transform(parsed.data) : parsed.data as unknown as U;
    
    llmLog({ 
      modelId: model.id, 
      engine: model.engine, 
      operation,
      duration: totalDuration,
      tokenUsage: {
        prompt: usage.promptTokens,
        completion: usage.completionTokens,
        total: usage.totalTokens
      },
      metadata: { 
        validationSuccessful: true,
        parseTime,
        validationTime,
        hasTransform: !!transform
      }
    }, 'Content generation and validation completed successfully');

    return { data: finalData, usage };
  } catch (parseError) {
    const totalDuration = Date.now() - startTime;
    llmLog({ 
      modelId: model.id, 
      engine: model.engine, 
      operation,
      duration: totalDuration,
      error: parseError,
      metadata: { 
        jsonStringPreview: jsonString.substring(0, 200),
        jsonStringLength: jsonString.length,
        originalContentLength: content.length
      }
    }, 'JSON parsing or validation failed', 'ERROR');
    throw parseError;
  }
}

// --- Public Service Functions ---

export interface CompetitorInfo {
  name: string;
  website: string;
}

export async function generateCompetitors(companyName: string, exampleCompetitor: string, industry: string | null): Promise<ChatCompletionResponse<CompetitorInfo[]>> {
  const model = getModelsByTask(ModelTask.COMPETITOR_ANALYSIS)[0];
  if (!model) throw new Error('Competitor analysis model not found in config.');

  const industryText = industry || 'Advertising/Marketing and Promotional Marketing';
  const prompt = `Generate a list of ${LLM_CONFIG.COMPETITOR_GENERATION_COUNT} potential competitor companies to my company, ${companyName}, such as ${exampleCompetitor}. Do a thorough search and identify as many competitors as you can in the ${industryText} industry. 

For each competitor, provide both the company name and their website URL. Return the result as a JSON object with this exact format:

{
  "competitors": [
    { "name": "Company Name", "website": "https://company.com" },
    { "name": "Another Company", "website": "https://another.com" }
  ]
}

Make sure each competitor entry is an object with both "name" and "website" properties. Do not return just company names as strings.`;
  
  const schema = z.object({
      competitors: CompetitorListSchema
  });

  return generateAndValidate(model, prompt, schema, data => data.competitors);
} 

export async function generateSentimentScores(companyName: string, industry: string, model: Model): Promise<ChatCompletionResponse<SentimentScores>> {
  const prompt = `Please provide a sentiment analysis for the company "${companyName}" operating in the "${industry}" industry.
  
Rate the company on a scale of 1 to 10 for the following five qualities:
1.  Perceived Quality
2.  Price/Value
3.  Brand Equity/Reputation
4.  Brand Trust
5.  Customer Service

After the ratings, provide a single, concise summary description.

Return your entire response as a single, valid JSON object with the following exact structure. Do not include any text or formatting outside of this JSON object.

{
  "companyName": "${companyName}",
  "industry": "${industry}",
  "ratings": [
    {
      "quality": <number>,
      "priceValue": <number>,
      "brandReputation": <number>,
      "brandTrust": <number>,
      "customerService": <number>,
      "summaryDescription": "<string>"
    }
  ]
}`;

  return generateAndValidate(model, prompt, SentimentScoresSchema);
}

export async function generateOverallSentimentSummary(companyName: string, sentiments: SentimentScores[]): Promise<ChatCompletionResponse<SentimentScores>> {
    const model = getModelsByTask(ModelTask.SENTIMENT_SUMMARY)[0];
    if (!model) throw new Error('Sentiment summary model not found in config.');

  const prompt = `You are a data analyst. Below is a set of sentiment analyses for the company "${companyName}" from various AI models. Your task is to synthesize this information into a single, authoritative, and balanced summary. Calculate the average for each numeric rating and write a new, comprehensive summary description that reflects the consensus and highlights any significant disagreements among the models.

  Data:
  ${JSON.stringify(sentiments, null, 2)}
  
  Please provide the final result as a single JSON object.`;

  return generateAndValidate(model, prompt, SentimentScoresSchema);
}

export async function generateVisibilityQuestions(productName: string, industryName: string): Promise<ChatCompletionResponse<string[]>> {
    const model = MODELS['gpt-4.1'];
    if (!model) throw new Error('Visibility question model not found in config.');

    const prompt = `Generate a list of ${LLM_CONFIG.VISIBILITY_QUESTIONS_COUNT} diverse, insightful, and non-obvious questions that reveal the online visibility of a "${productName}" product in the "${industryName}" industry. These questions will be used as search queries to assess brand presence. Focus on questions that would yield search results showing organic ranking, content marketing, social media presence, and user reviews that a normal human customer might ask. Return the result as a JSON object with a "questions" key containing an array of strings.`;
    
    const schema = z.object({ questions: z.array(z.string()) });
    
    return generateAndValidate(model, prompt, schema, data => data.questions);
}

export async function generateVisibilityResponse(question: string, model: Model): Promise<ChatCompletionResponse<string>> {
    const prompt = `You are a search engine. Provide a concise, factual, and unformatted text response to the following query. Emulate the raw text content of a search engine results page (SERP), including various sources like articles, forums, and social media.
    
    Query: "${question}"`;
    
    const { content, usage } = await generateChatCompletion(model, prompt);
    if (content === null) {
        throw new Error('LLM returned empty content for visibility response.');
    }
    
    return {
        data: content,
        usage: usage,
    };
}

export async function generateBenchmarkQuestionVariations(userQuestion: string, industryName: string, productName: string): Promise<ChatCompletionResponse<string[]>> {
    const model = MODELS['gpt-4.1'];
    if (!model) throw new Error('Benchmark question model not found in config.');
    
    const prompt = `Given the user's question "${userQuestion}" for the product "${productName}" in the "${industryName}" industry, generate ${LLM_CONFIG.BENCHMARK_VARIATIONS_COUNT} diverse and insightful variations of this question. These variations will be used to benchmark against competitors. Ensure the variations are distinct but conceptually related. Return the result as a JSON object with a "questions" key containing an array of strings.`;

    const schema = z.object({ questions: z.array(z.string()) });
    
    return generateAndValidate(model, prompt, schema, data => data.questions);
} 