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
const BRAND_TAG_INSTRUCTION = `
IMPORTANT: When you mention any company or brand name in your response, you MUST wrap it in <brand> XML tags.
For example:
- "I would recommend <brand>Apple</brand> for its user-friendly interface."
- "The main competitors are <brand>Samsung</brand> and <brand>Google</brand>."
- "<brand>Nike</brand> and <brand>Adidas</brand> are leaders in the athletic apparel market."
This is a strict requirement for parsing the output. Do not forget to do this for every brand you mention.
`;

const CompetitorSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().min(1),
});

// Schema for individual sentiment rating
const SentimentRatingSchema = z.object({
  quality: z.number().min(1).max(10),
  priceValue: z.number().min(1).max(10),
  brandReputation: z.number().min(1).max(10),
  brandTrust: z.number().min(1).max(10),
  customerService: z.number().min(1).max(10),
  summaryDescription: z.string(),
});

// Schema for sentiment scores - simplified to always expect array format
const SentimentScoresSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  ratings: z.array(SentimentRatingSchema).min(1, "At least one rating must be provided"),
});

export type SentimentScores = z.infer<typeof SentimentScoresSchema>;

// --- Schemas for Question Answering ---
export interface QuestionInput {
    id: string;
    text: string;
}

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
              max_tokens: LLM_CONFIG.MAX_TOKENS,
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
            max_tokens: LLM_CONFIG.MAX_TOKENS,
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
          }, 'Using Anthropic messages API');

          if (schema) {
            const toolName = "structured_response";
            llmLog({
                modelId: model.id, engine: model.engine, operation, attempt, maxAttempts: maxRetries,
                metadata: { method: 'tool_calling', toolName }
            }, 'Using Anthropic tool calling for structured response');

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
            generationConfig: { 
              responseMimeType: 'application/json',
              maxOutputTokens: LLM_CONFIG.MAX_TOKENS
            },
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
      
      let backoffDelay = LLM_CONFIG.RETRY_BACKOFF_BASE * attempt;

      // Check for rate limit error with a specific header and adapt the backoff
      if (error && typeof error === 'object' && 'status' in error && error.status === 429 && 'headers' in error && typeof error.headers === 'object' && error.headers && 'retry-after' in error.headers) {
          const retryAfterSeconds = parseInt(error.headers['retry-after'] as string, 10);
          if (!isNaN(retryAfterSeconds)) {
              backoffDelay = retryAfterSeconds * 1000 + 500; // Convert to ms and add a 500ms buffer
              llmLog({
                  modelId: model.id,
                  engine: model.engine,
                  operation,
                  attempt,
                  maxAttempts: maxRetries,
                  metadata: { backoffDelay, source: 'retry-after-header' }
              }, `Rate limit hit. Adapting to 'retry-after' header.`);
          }
      }
      
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

// Helper function to find all valid JSON objects within a string
function findAllJsonObjects(text: string): any[] {
    const objects: any[] = [];
    const regex = /\{[^{}]*\}/g; // A simple regex to find potential objects
    let match;

    while ((match = regex.exec(text)) !== null) {
        try {
            const potentialJson = match[0];
            const parsed = JSON.parse(potentialJson);
            objects.push(parsed);
        } catch (e) {
            // Ignore non-JSON matches
        }
    }
    return objects;
}

// --- Helper for Parsing and Validation ---
function extractAndCleanJSON(response: string): string | null {
    let text = response.trim();

    const markdownMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    if (markdownMatch) {
        text = markdownMatch[1].trim();
    }
    
    // Attempt to parse the whole string first
    try {
        const cleaned = cleanControlCharacters(text);
        JSON.parse(cleaned);
        return cleaned;
    } catch (e) {
        // If it fails, proceed to find the largest valid JSON object inside
    }

    // Try to find the start of a JSON object or array
    const startIndex = text.search(/[\{\[]/);
    if (startIndex === -1) return null;

    const startChar = text[startIndex];
    const endChar = startChar === '{' ? '}' : ']';
    
    let depth = 0;
    let inString = false;
    let escaped = false;
    let endIndex = -1;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];
        
        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        // Toggle inString state if we encounter a quote that is not escaped
        if (char === '"') {
            inString = !inString;
        }

        if (inString) continue;

        if (char === startChar) {
            depth++;
        } else if (char === endChar) {
            depth--;
        }

        if (depth === 0) {
            endIndex = i;
            break;
        }
    }
    
    // If we can't find a complete object, try to repair the truncated JSON
    if (endIndex === -1) {
        // Fallback to finding ANY valid json object in the string if truncated
        const foundObjects = findAllJsonObjects(text);
        if (foundObjects.length > 0) {
            // Heuristic: assume the largest object is the one we want
            foundObjects.sort((a,b) => JSON.stringify(b).length - JSON.stringify(a).length);
            return JSON.stringify(foundObjects[0]);
        }
        return null;
    }

    let jsonString = text.substring(startIndex, endIndex + 1);
    
    // Clean control characters before attempting to parse
    jsonString = cleanControlCharacters(jsonString);
    
    try {
        JSON.parse(jsonString);
        return jsonString;
    } catch (e) {
        // Try additional common fixes if control character cleaning wasn't enough
        try {
            let repaired = jsonString
                .replace(/,\s*([\}\]])/g, '$1')  // Remove trailing commas
                .replace(/([{,]\s*)"([^"]+)"\s*:\s*"([^"]*)"/g, '$1"$2":"$3"')  // Fix quote spacing
                .replace(/([{,]\s*)"([^"]+)"\s*:\s*([^",}]+)/g, '$1"$2":"$3"'); // Add missing quotes around values
            
            JSON.parse(repaired);
            return repaired;
        } catch (e2) {
            return null;
        }
    }
}

// Helper function to clean control characters from JSON strings
function cleanControlCharacters(jsonString: string): string {
    // First, fix control characters within JSON string values
    return jsonString.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
        // Clean control characters within the string content
        const cleaned = content
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove most control chars
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r')   // Escape carriage returns  
            .replace(/\t/g, '\\t')   // Escape tabs
            .replace(/\f/g, '\\f')   // Escape form feeds
            .replace(/\b/g, '\\b')   // Escape backspaces
            .replace(/\v/g, '\\v');  // Escape vertical tabs
        
        return `"${cleaned}"`;
    });
}

// Enhanced generateAndValidate that tries multiple parsing approaches and includes retries
async function generateAndValidate<T, U>(
    prompt: string,
    schema: z.ZodSchema<T>,
    model: Model,
    task: ModelTask,
    transform?: (data: T) => U,
    rescue?: (data: any) => any,
): Promise<{ data: U; usage: TokenUsage }> {
    const maxRetries = LLM_CONFIG.MAX_RETRIES;
    const operation = 'VALIDATED_COMPLETION';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const attemptStartTime = Date.now();
        
        try {
            const result = await generateChatCompletion(model, prompt);
            
            // First attempt: Direct JSON parsing
            let parsedData: any;
            let parseErrors: string[] = [];
            
            try {
                parsedData = JSON.parse(result.content || '');
            } catch (directError) {
                parseErrors.push(`Direct parse: ${directError}`);
                
                // Second attempt: Extract and clean JSON
                const cleanedJSON = extractAndCleanJSON(result.content || '');
                if (cleanedJSON) {
                    try {
                        parsedData = JSON.parse(cleanedJSON);
                    } catch (cleanError) {
                        parseErrors.push(`Cleaned parse: ${cleanError}`);
                        
                        // Log the problematic response for debugging
                        llmLog({
                            modelId: model.id,
                            engine: model.engine,
                            operation: 'JSON_PARSE_FAILURE',
                            metadata: {
                                responseLength: result.content?.length || 0,
                                responsePreview: result.content?.slice(0, 500),
                                parseErrors,
                                cleanedJsonPreview: cleanedJSON.slice(0, 200)
                            }
                        }, `JSON parsing failed after repair attempts`, 'ERROR');
                        
                        throw new Error(`JSON parsing failed: ${parseErrors.join('; ')}`);
                    }
                } else {
                    // Log detailed failure information
                    llmLog({
                        modelId: model.id,
                        engine: model.engine,
                        operation: 'JSON_EXTRACTION_FAILURE',
                        metadata: {
                            responseLength: result.content?.length || 0,
                            responseStart: result.content?.slice(0, 200),
                            responseEnd: result.content?.slice(-200),
                            parseErrors
                        }
                    }, `Could not extract valid JSON from response`, 'ERROR');
                    
                    throw new Error(`Could not find a valid JSON object in the response. Response length: ${result.content?.length || 0}. Parse errors: ${parseErrors.join('; ')}`);
                }
            }
            
            // Validate with schema, with a rescue attempt
            let validationResult = schema.safeParse(parsedData);
            if (!validationResult.success && rescue) {
                const rescuedData = rescue(parsedData);
                const rescueValidationResult = schema.safeParse(rescuedData);
                if (rescueValidationResult.success) {
                    validationResult = rescueValidationResult;
                    llmLog({
                        modelId: model.id,
                        engine: model.engine,
                        operation: 'SCHEMA_RESCUE',
                        metadata: { 
                            originalData: JSON.stringify(parsedData).slice(0, 200),
                            rescuedData: JSON.stringify(rescuedData).slice(0, 200)
                        }
                    }, 'Successfully rescued data using rescue function', 'DEBUG');
                }
            }

            if (!validationResult.success) {
                llmLog({
                    modelId: model.id,
                    engine: model.engine,
                    operation: 'SCHEMA_VALIDATION_FAILURE',
                    metadata: {
                        validationErrors: validationResult.error.errors,
                        receivedData: JSON.stringify(parsedData).slice(0, 300),
                        schemaInfo: schema.description || 'No description available'
                    }
                }, `Schema validation failed`, 'ERROR');
                
                throw new Error(`Schema validation failed: ${validationResult.error.message}`);
            }
            
            // Only log success if validation passed
            if (result.content !== JSON.stringify(validationResult.data)) {
                llmLog({
                    modelId: model.id,
                    engine: model.engine,
                    operation: 'JSON_REPAIR_SUCCESS',
                    metadata: { 
                        originalLength: result.content?.length || 0,
                        repairedLength: JSON.stringify(validationResult.data).length
                    }
                }, 'Successfully repaired and validated JSON response', 'DEBUG');
            }
            
            // Apply transformation if provided
            const finalData = transform ? transform(validationResult.data) : (validationResult.data as unknown as U);
            
            return {
                data: finalData,
                usage: {
                    promptTokens: result.usage.promptTokens,
                    completionTokens: result.usage.completionTokens,
                    totalTokens: result.usage.totalTokens
                }
            };
            
        } catch (error) {
            const attemptDuration = Date.now() - attemptStartTime;
            const isLastAttempt = attempt === maxRetries;
            
            llmLog({
                modelId: model.id,
                engine: model.engine,
                operation: operation,
                attempt,
                maxAttempts: maxRetries,
                duration: attemptDuration,
                error
            }, `Generation/validation failed on attempt ${attempt}/${maxRetries}${isLastAttempt ? ' (final attempt)' : ''}`, 'ERROR');

            if (isLastAttempt) {
                throw new Error(`Failed to get and validate completion from ${model.engine} for task ${task} after ${maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`);
            }
            
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
    
    throw new Error(`LLM generation failed for task ${task} after ${maxRetries} attempts.`);
}

// --- Public Service Functions ---

export interface CompetitorInfo {
  name: string;
  website: string;
}

export async function generatePersonalQuestionsFromWebsite(companyName: string, websiteUrl: string, count: number): Promise<ChatCompletionResponse<string[]>> {
  // --- Step 1: Analyze website content to extract key themes as raw text ---
  const analysisModel = getModelsByTask(ModelTask.WEBSITE_ANALYSIS)[0];
  if (!analysisModel) {
    throw new Error('No model found for the WEBSITE_ANALYSIS task.');
  }

  const analysisPrompt = `You are an expert market analyst. Your task is to analyze the company '${companyName}' by thoroughly examining its website at '${websiteUrl}'. Perform a web search focused on this site. 
  
Provide a detailed text summary of the company's offerings, slogans, target audience, unique selling points, primary services, and overall value proposition. Capture as much detail as possible. The goal is to create a rich block of text that can be used to generate targeted questions that will lead an AI assistant to recommend '${companyName}' based on unique identifiers.`;

  const { content: analysisResult, usage: analysisUsage } = await generateChatCompletion(
    analysisModel,
    analysisPrompt
  );

  if (!analysisResult) {
    throw new Error('Website analysis failed to return content.');
  }

  // --- Step 2: Generate questions based on the analysis ---
  const questionModel = getModelsByTask(ModelTask.PERSONAL_QUESTION_GENERATION)[0];
  if (!questionModel) {
    throw new Error('No model found for the PERSONAL_QUESTION_GENERATION task.');
  }

  const questionPrompt = `You are an expert at crafting strategic, targeted questions. Your goal is to generate questions that are highly likely to lead an AI assistant (with search capabilities) to recommend '${companyName}'.

Based on this detailed text analysis of '${companyName}':
---
${analysisResult}
---

Generate ${count} questions that a potential customer might realistically ask. 

**Crucial Instructions:**
1.  **Try not to use the name '${companyName}' in the questions.**
2.  **Weave in Specifics:** Embed details, services, and selling points from the text analysis directly into the questions. They should be questions that a potential customer might ask.
3.  **Create "Soft-Leading" Questions:** The questions should sound natural but be constructed in a way that makes '${companyName}' the most logical answer. Frame it as a search for a provider with a very specific combination of strengths identified in the analysis.
4.  **Action-Oriented:** End each question with a clear directive for an AI to include a list of companies that are recommended for that question.

Return the result as a JSON object with a "questions" key containing an array of strings.

**Example 1:**
Company: "Zapier" (Automation platform that connects over 5,000 apps, no-code solutions, workflow automation)
Input Analysis: "Zapier specializes in workflow automation connecting thousands of applications without coding. They focus on small to medium businesses with easy drag-and-drop interfaces and pre-built templates."
Output:
{
  "questions": [
    "I need a no-code automation platform that can connect over 5,000 different apps with drag-and-drop workflows for my small business. Which companies offer this?",
    "What are the best workflow automation tools that don't require coding and come with pre-built templates for SMBs? Please list the top providers.",
    "I'm looking for an automation solution that can handle complex multi-app integrations with an intuitive interface. Which companies should I consider?"
  ]
}

**Example 2:**  
Company: "Notion" (All-in-one workspace with databases, wikis, docs, and project management)
Input Analysis: "Notion provides an all-in-one workspace combining notes, databases, kanban boards, wikis, and calendars. Popular with teams for its flexibility and block-based editing system."
Output:
{
  "questions": [
    "I need an all-in-one workspace that combines databases, wikis, and project management with flexible block-based editing. What companies offer this?",
    "Which tools provide kanban boards, note-taking, and team wikis all in one platform with customizable templates? List the best options.",
    "I'm looking for a collaborative workspace that can replace multiple tools like databases, docs, and project trackers. Which companies specialize in this?"
  ]
}

**Your Task:**
Company: "${companyName}"  
Generate ${count} questions based on the analysis above. Follow the exact JSON structure shown in the examples.`;

  const questionSchema = z.object({
    questions: z.array(z.string()).length(count),
  });

  const rescue = (data: any) => {
    if (Array.isArray(data)) return { questions: data };
    return data;
  }

  const { data: questions, usage: questionUsage } = await generateAndValidate(
    questionPrompt,
    questionSchema,
    questionModel,
    ModelTask.PERSONAL_QUESTION_GENERATION,
    (data) => data.questions,
    rescue
  );

  // Combine token usage from both steps
  const totalUsage = {
    promptTokens: analysisUsage.promptTokens + questionUsage.promptTokens,
    completionTokens: analysisUsage.completionTokens + questionUsage.completionTokens,
    totalTokens: analysisUsage.totalTokens + questionUsage.totalTokens,
  };

  return { data: questions, usage: totalUsage };
}

// Generate sentiment scores for a company
export async function generateSentimentScores(companyName: string, industry: string, model: Model): Promise<ChatCompletionResponse<SentimentScores>> {
  llmLog({
    modelId: model.id,
    engine: model.engine,
    operation: 'SENTIMENT_GENERATION',
    metadata: { companyName, industry }
  }, `Generating sentiment scores for ${companyName}`);

  const prompt = `
    You are an expert market research analyst. Your task is to analyze the public sentiment for a company based on web data.

    **Company:** "${companyName}"
    **Industry:** "${industry}"

    **Instructions:**
    1.  Provide a sentiment rating on a scale of 1 to 10 for each category below.
        -   **1:** Extremely Negative
        -   **5:** Neutral / Mixed
        -   **10:** Extremely Positive
    2.  Provide a concise summary (2-3 sentences) of the overall public sentiment, justifying your scores.
    3.  Your response MUST be a single JSON object that strictly adheres to the specified schema.

    **Rating Category Definitions:**
    -   **Quality:** Perceptions of the product/service quality, reliability, and performance.
    -   **Price/Value:** Sentiment regarding pricing, value for money, and discounts.
    -   **Brand Reputation:** Overall public image, brand recognition, and corporate responsibility.
    -   **Brand Trust:** Customer confidence in the brand's promises, ethics, and data privacy.
    -   **Customer Service:** Experiences with support, responsiveness, and problem resolution.

    **Example 1:**
    Company: "Netflix"
    Industry: "Streaming Services"
    Output:
    {
      "companyName": "Netflix",
      "industry": "Streaming Services",
      "ratings": [{
        "quality": 8,
        "priceValue": 6,
        "brandReputation": 7,
        "brandTrust": 7,
        "customerService": 5,
        "summaryDescription": "Netflix is widely praised for its vast library of high-quality original content. However, there is growing concern over recent price increases and password sharing crackdowns, which has impacted its value perception. While the brand is a household name, its customer service is often seen as average and impersonal."
      }]
    }

    **Example 2:**
    Company: "Apple"
    Industry: "Technology"
    Output:
    {
      "companyName": "Apple",
      "industry": "Technology",
      "ratings": [{
        "quality": 9,
        "priceValue": 4,
        "brandReputation": 9,
        "brandTrust": 8,
        "customerService": 7,
        "summaryDescription": "Apple consistently receives high marks for product quality and innovation, with strong brand loyalty and trust. However, the company faces significant criticism for premium pricing that many consider excessive for the value provided. Customer service is generally regarded as helpful but can be inconsistent across different channels."
      }]
    }

    **Your Task:**
    Company: "${companyName}"
    Industry: "${industry}"
    Follow the exact JSON structure shown in the examples above. Ensure all ratings are integers between 1-10.
  `;

  // Rescue function to handle cases where the model returns only the ratings array
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

export async function generateOverallSentimentSummary(companyName: string, sentiments: SentimentScores[]): Promise<ChatCompletionResponse<SentimentScores>> {
  const model = getModelsByTask(ModelTask.SENTIMENT_SUMMARY)[0];
  if (!model) throw new Error(`No models found for task: ${ModelTask.SENTIMENT_SUMMARY}`);

  // Calculate mathematical averages from all sentiment data
  const allRatings = sentiments.flatMap(s => s.ratings);
  
  if (allRatings.length === 0) {
    throw new Error('No sentiment ratings found to summarize');
  }

  // Calculate averages for each category
  const averages = {
    quality: Math.round(allRatings.reduce((sum, r) => sum + r.quality, 0) / allRatings.length),
    priceValue: Math.round(allRatings.reduce((sum, r) => sum + r.priceValue, 0) / allRatings.length),
    brandReputation: Math.round(allRatings.reduce((sum, r) => sum + r.brandReputation, 0) / allRatings.length),
    brandTrust: Math.round(allRatings.reduce((sum, r) => sum + r.brandTrust, 0) / allRatings.length),
    customerService: Math.round(allRatings.reduce((sum, r) => sum + r.customerService, 0) / allRatings.length)
  };

  // Use LLM only to generate a descriptive summary
  const prompt = `You are an expert data analyst specializing in sentiment analysis. 

**Company:** "${companyName}"
**Industry:** "${sentiments[0]?.industry || ''}"

**Calculated Average Scores (1-10 scale):**
- Quality: ${averages.quality}/10
- Price/Value: ${averages.priceValue}/10  
- Brand Reputation: ${averages.brandReputation}/10
- Brand Trust: ${averages.brandTrust}/10
- Customer Service: ${averages.customerService}/10

**Raw Data from ${sentiments.length} AI Models:**
${sentiments.map((s, i) => `Model ${i + 1}: Quality(${s.ratings[0]?.quality}), Price(${s.ratings[0]?.priceValue}), Reputation(${s.ratings[0]?.brandReputation}), Trust(${s.ratings[0]?.brandTrust}), Service(${s.ratings[0]?.customerService})`).join('\n')}

**Instructions:**
Write a comprehensive 2-3 sentence summary that explains the overall sentiment findings. Focus on:
- Which areas the company performs best/worst in
- Any notable patterns across the different AI models and why they might be different
- Overall market perception and sentiment trends

**Important:** Return ONLY the summary text. Do not include JSON formatting, numbers, or any other structured data.`;

  const { content: summaryText, usage } = await generateChatCompletion(model, prompt);
  
  if (!summaryText) {
    throw new Error('Failed to generate sentiment summary text');
  }

  // Combine calculated averages with LLM-generated summary
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

/*
 * Generates a list of visibility questions for a given product and industry.
 * @param productName - The name of the product.
 * @param industryName - The industry of the product.
 * @param count - The exact number of questions to generate.
 * @returns A promise that resolves to a list of questions.
 */
export async function generateVisibilityQuestions(productName: string, industryName: string, count: number): Promise<ChatCompletionResponse<string[]>> {
    const model = getModelsByTask(ModelTask.VISIBILITY)[0];
    const prompt = `Generate a list of exactly ${count} diverse, insightful questions a user might ask an AI assistant to learn about the best ${industryName} companies and products. Focus on questions related to products like "${productName}" in the ${industryName} industry and what companies might be the best to consider. The questions should cover a range of topics including features, comparisons, price, and user sentiment, but ultimately should ask for company recommendations.

Return the result as a JSON object with a "questions" key containing an array of strings.
    
**Example 1:**
Product: "Meal Kits", Industry: "Food Delivery"
Output:
{
  "questions": [
    "What are the best meal kit delivery services for a family of four? Which companies do you recommend?",
    "Where can I find the most affordable meal kit subscriptions with organic ingredients?",
    "Which meal kit companies offer the most diverse international cuisine options?",
    "What are the top-rated meal delivery services for people with dietary restrictions?"
  ]
}

**Example 2:**
Product: "Security Cameras", Industry: "Home Security"
Output:
{
  "questions": [
    "Which companies make the best wireless security cameras for outdoor use?",
    "What are the top-rated home security camera systems with mobile app integration?",
    "Which security camera brands offer the best night vision and motion detection?",
    "What companies provide the most reliable cloud storage for security footage?"
  ]
}

**Your Task:**
Product: "${productName}"
Industry: "${industryName}"
Generate exactly ${count} questions. Follow the exact JSON format shown in the examples above.

`;

    const schema = z.object({
        questions: z.array(z.string()).length(count)
    });
    
    const rescue = (data: any) => {
        if (Array.isArray(data)) return { questions: data };
        return data;
    }

    return generateAndValidate(prompt, schema, model, ModelTask.VISIBILITY, data => data.questions, rescue);
}

/**
 * Generates a response for a single question using web search capabilities.
 * This replaces the complex batching approach with simple, reliable single-question processing.
 * @param question The question object with id and text.
 * @param model The language model to use for generating the response.
 * @returns A promise that resolves to a response with the answer and token usage.
 */
export async function generateQuestionResponse(
    question: QuestionInput, 
    model: Model
): Promise<ChatCompletionResponse<string>> {
    const systemPrompt = `
You are a helpful AI assistant providing unbiased recommendations. 
Answer the following question thoroughly and directly, but keep it short and concise (no longer than a paragraph or two max). Do not return JSON, it should be a plain text answer with the following format (see examples below):

${BRAND_TAG_INSTRUCTION}
`;

    const prompt = `
SYSTEM PROMPT: ${systemPrompt}
QUESTION: "${question.text}"
ANSWER:
`;
    
    // This function should return raw text, so no schema is provided.
    const { content, usage: rawUsage } = await generateChatCompletion(model, prompt);

    if (!content) {
        throw new Error('LLM returned empty content for question response.');
    }

    return {
        data: content,
        usage: rawUsage,
    };
}

/**
 * @param userQuestion - The base question from the user.
 * @param industryName - The industry for context.
 * @param productName - The user's product for context.
 * @param count - The exact number of variations to generate.
 * @returns A promise that resolves to a list of question variations.
 */
export async function generateBenchmarkQuestionVariations(userQuestion: string, industryName: string, productName: string, count: number): Promise<ChatCompletionResponse<string[]>> {
    const model = getModelsByTask(ModelTask.BENCHMARKING)[0];
    const prompt = `Based on the user's question "${userQuestion}" for the product "${productName}" in the "${industryName}" industry, generate ${count} diverse and insightful variations. These variations should explore different facets of the original question, such as cost, quality, features, and customer experience. Frame them as if a curious customer is asking. Return a JSON array of strings.

**Example 1:**
Original Question: "What are the best project management tools for small teams?"
Product: "Project Management Software", Industry: "Business Software"  
Output:
{
  "questions": [
    "Which project management platforms offer the best value for teams under 10 people?",
    "What are the most user-friendly project tracking tools with collaborative features?",
    "Which companies provide project management software with the best mobile apps and integrations?",
    "What are customer reviews saying about the most popular team collaboration platforms?"
  ]
}

**Example 2:**
Original Question: "Which electric cars have the longest range?"
Product: "Electric Vehicles", Industry: "Automotive"
Output:
{
  "questions": [
    "What are the top-rated electric vehicles for long-distance driving and which companies make them?",
    "Which electric car manufacturers offer the best charging infrastructure and battery technology?",
    "How do the latest electric vehicles compare in terms of range, price, and reliability across different brands?",
    "What are real-world reviews saying about the battery performance of leading electric car companies?"
  ]
}

**Your Task:**
Original Question: "${userQuestion}"
Product: "${productName}"
Industry: "${industryName}"
Generate exactly ${count} question variations. Follow the exact JSON format shown in the examples above.

    `;
    
    const schema = z.object({
        questions: z.array(z.string()).length(count)
    });
    
    const rescue = (data: any) => {
        if (Array.isArray(data)) return { questions: data };
        return data;
    }
    
    return generateAndValidate(prompt, schema, model, ModelTask.BENCHMARKING, data => data.questions, rescue);
}

/**
 * Optimized function to generate websites for competitors using batched parallel processing.
 * Processes companies in batches of 20 to maximize throughput while staying within token limits.
 * @param competitorNames Array of company names to enrich with websites
 * @returns Promise resolving to enriched competitor data with aggregated token usage
 */
export async function generateWebsiteForCompetitors(competitorNames: string[]): Promise<ChatCompletionResponse<CompetitorInfo[]>> {
    const model = getModelsByTask(ModelTask.WEBSITE_ENRICHMENT)[0];
    if (!model) {
        throw new Error("No model configured for website enrichment task.");
    }

    // Configuration
    const BATCH_SIZE = 20;
    const totalCompanies = competitorNames.length;
    
    // Early return for empty input
    if (totalCompanies === 0) {
        return {
            data: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        };
    }

    llmLog({
        modelId: model.id,
        engine: model.engine,
        operation: 'BATCHED_WEBSITE_ENRICHMENT',
        metadata: {
            totalCompanies,
            batchSize: BATCH_SIZE,
            expectedBatches: Math.ceil(totalCompanies / BATCH_SIZE)
        }
    }, `Starting batched website enrichment for ${totalCompanies} companies`);

    // Split companies into batches of 20
    const batches: string[][] = [];
    for (let i = 0; i < totalCompanies; i += BATCH_SIZE) {
        batches.push(competitorNames.slice(i, i + BATCH_SIZE));
    }

    // Process all batches in parallel for maximum efficiency
    const batchPromises = batches.map((batch, batchIndex) => 
        processSingleBatch(batch, model, batchIndex + 1, batches.length)
    );

    const batchResults = await Promise.allSettled(batchPromises);

    // Aggregate results and handle failures gracefully
    const allCompetitors: CompetitorInfo[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let successfulBatches = 0;
    let failedBatches = 0;

    for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const batchNumber = i + 1;
        
        if (result.status === 'fulfilled') {
            allCompetitors.push(...result.value.data);
            totalPromptTokens += result.value.usage.promptTokens;
            totalCompletionTokens += result.value.usage.completionTokens;
            successfulBatches++;
            
            llmLog({
                modelId: model.id,
                engine: model.engine,
                operation: 'BATCH_SUCCESS',
                metadata: {
                    batchNumber,
                    companiesInBatch: batches[i].length,
                    enrichedCount: result.value.data.length,
                    tokenUsage: result.value.usage
                }
            }, `Batch ${batchNumber}/${batches.length} completed: ${result.value.data.length} companies enriched`, 'DEBUG');
        } else {
            failedBatches++;
            llmLog({
                modelId: model.id,
                engine: model.engine,
                operation: 'BATCH_FAILURE',
                error: result.reason,
                metadata: {
                    batchNumber,
                    companiesInBatch: batches[i].length,
                    companiesLost: batches[i]
                }
            }, `Batch ${batchNumber}/${batches.length} failed`, 'ERROR');
        }
    }

    const aggregatedUsage = {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens
    };

    llmLog({
        modelId: model.id,
        engine: model.engine,
        operation: 'BATCHED_ENRICHMENT_COMPLETE',
        tokenUsage: {
            prompt: aggregatedUsage.promptTokens,
            completion: aggregatedUsage.completionTokens,
            total: aggregatedUsage.totalTokens
        },
        metadata: {
            totalInput: totalCompanies,
            totalEnriched: allCompetitors.length,
            successfulBatches,
            failedBatches,
            successRate: Math.round((successfulBatches / batches.length) * 100),
            avgCompaniesPerBatch: Math.round(totalCompanies / batches.length)
        }
    }, `Batched enrichment complete: ${allCompetitors.length}/${totalCompanies} companies enriched (${Math.round((allCompetitors.length / totalCompanies) * 100)}% success rate)`);

    return {
        data: allCompetitors,
        usage: aggregatedUsage
    };
}

/**
 * Internal function to process a single batch of companies for website enrichment.
 * Optimized prompt with few-shot examples for better accuracy and consistency.
 */
async function processSingleBatch(
    companyBatch: string[], 
    model: Model, 
    batchNumber: number, 
    totalBatches: number
): Promise<ChatCompletionResponse<CompetitorInfo[]>> {
    const startTime = Date.now();
    
    const prompt = `You are an expert at finding official company websites. Find the official website URL for each company in the list below.

**Important Instructions:**
1. Return a JSON object with "competitors" key containing an array of objects
2. Each object must have "name" and "website" fields
3. Use exact company names from the input list
4. Ensure websites start with "https://" or "http://"
5. If you cannot find a website for a company, OMIT it from the results (do not include null/empty websites)
6. Focus on finding the PRIMARY official website, not subdomains or product pages

**Company Batch ${batchNumber}/${totalBatches} (${companyBatch.length} companies):**
${companyBatch.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}

**Example 1:**
Input: ["Spotify", "Apple Music", "Amazon Music"]
Output:
{
  "competitors": [
    { "name": "Spotify", "website": "https://spotify.com" },
    { "name": "Apple Music", "website": "https://music.apple.com" },
    { "name": "Amazon Music", "website": "https://music.amazon.com" }
  ]
}

**Example 2:**
Input: ["Tesla", "Ford", "General Motors", "BMW", "NonExistentCompany123"]
Output:
{
  "competitors": [
    { "name": "Tesla", "website": "https://tesla.com" },
    { "name": "Ford", "website": "https://ford.com" },
    { "name": "General Motors", "website": "https://gm.com" },
    { "name": "BMW", "website": "https://bmw.com" }
  ]
}

**Your Task:**
Find the official websites for the ${companyBatch.length} companies listed above. Return results in the exact JSON format shown in examples.`;

    const schema = z.object({
        competitors: z.array(CompetitorSchema),
    });

    try {
        const result = await generateAndValidate(
            prompt, 
            schema, 
            model, 
            ModelTask.WEBSITE_ENRICHMENT,
            (data) => data as { competitors: CompetitorInfo[] }
        );

        const duration = Date.now() - startTime;
        llmLog({
            modelId: model.id,
            engine: model.engine,
            operation: 'SINGLE_BATCH_SUCCESS',
            duration,
            tokenUsage: {
                prompt: result.usage.promptTokens,
                completion: result.usage.completionTokens,
                total: result.usage.totalTokens
            },
            metadata: {
                batchNumber,
                inputCount: companyBatch.length,
                outputCount: result.data.competitors.length,
                enrichmentRate: Math.round((result.data.competitors.length / companyBatch.length) * 100)
            }
        }, `Single batch processing successful: ${result.data.competitors.length}/${companyBatch.length} companies enriched`, 'DEBUG');

        return {
            data: result.data.competitors,
            usage: result.usage
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        llmLog({
            modelId: model.id,
            engine: model.engine,
            operation: 'SINGLE_BATCH_ERROR',
            duration,
            error,
            metadata: {
                batchNumber,
                inputCount: companyBatch.length,
                companiesLost: companyBatch
            }
        }, `Single batch processing failed for batch ${batchNumber}`, 'ERROR');
        
        throw new Error(`Batch ${batchNumber} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
} 