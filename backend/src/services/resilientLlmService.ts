/**
 * @file resilientLlmService.ts
 * @description This file implements `ResilientLlmService`, a robust service designed to make LLM calls more reliable.
 * It incorporates automatic retry mechanisms with exponential backoff, intelligent rate limit handling, and a fallback
 * system that attempts to use alternative models if the primary one fails. It also integrates with the `alertingService`
 * to notify administrators of fallback usage or critical failures. This service is crucial for ensuring the continuous
 * operation of AI-powered features even in the face of transient LLM provider issues.
 *
 * @dependencies
 * - zod: For schema validation.
 * - ../config/models: LLM model configuration and task mapping.
 * - ./llmService: Core LLM interaction functions.
 * - ./alertingService: Service for sending alerts.
 *
 * @exports
 * - ResilientLlmService: The main class providing resilient LLM functionalities.
 * - generateResilientQuestionResponse: Resilient function for generating question responses.
 * - generateResilientChatCompletion: Resilient function for general chat completions.
 * - generateAndValidateResilient: Resilient function for generating and validating LLM output.
 * - ResilientCallOptions: Interface for options to configure resilient calls.
 */
import { z } from 'zod';
import { Model, ModelTask, getModelsByTask, LLM_CONFIG } from '../config/models';
import { generateChatCompletion, generateAndValidate, QuestionInput, ChatCompletionResponse, TokenUsage } from './llmService';
import { alertingService } from './alertingService';

interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

interface ResilientCallOptions {
  retryConfig?: Partial<RetryConfig>;
  enableFallbacks?: boolean;
  alertOnFallback?: boolean;
  context?: string; // For logging and alerts
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

// Define fallback priorities for different AI model engines
const ENGINE_FALLBACK_PRIORITY = {
  'openai': ['anthropic', 'google', 'perplexity'],
  'anthropic': ['openai', 'google', 'perplexity'],
  'google': ['openai', 'anthropic', 'perplexity'],
  'perplexity': ['openai', 'anthropic', 'google']
};

/**
 * Enhanced LLM service with automatic fallbacks and resilient error handling
 */
class ResilientLlmService {
  
  /**
   * Make a resilient chat completion call with automatic fallbacks
   */
  static async generateResilientChatCompletion(
    model: Model,
    prompt: string,
    schema?: z.ZodType<any>,
    options: ResilientCallOptions = {}
  ): Promise<{ content: string | null; usage: TokenUsage }> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    const context = options.context || 'unknown';
    
    console.log(`[ResilientLLM] Starting resilient call for ${model.id} (context: ${context})`);
    
    // Try primary model first
    try {
      return await this.callWithRetry(model, prompt, schema, config, context);
    } catch (primaryError) {
      console.warn(`[ResilientLLM] Primary model ${model.id} failed:`, primaryError instanceof Error ? primaryError.message : String(primaryError));
      
      // If fallbacks are disabled, throw the original error
      if (!options.enableFallbacks) {
        throw primaryError;
      }
      
      // Try fallback models
      const fallbackModels = await this.getFallbackModels(model);
      
      if (fallbackModels.length === 0) {
        console.warn(`[ResilientLLM] No fallback models available for ${model.id}`);
        throw primaryError;
      }
      
      for (const fallbackModel of fallbackModels) {
        try {
          console.log(`[ResilientLLM] Trying fallback model: ${fallbackModel.id}`);
          
          const result = await this.callWithRetry(fallbackModel, prompt, schema, config, `${context}_fallback_${fallbackModel.id}`);
          
          // Alert about successful fallback
          if (options.alertOnFallback) {
            await alertingService.alertSystemIssue({
              component: 'AI_MODELS',
              message: `AI model fallback successful: ${model.id} → ${fallbackModel.id}`,
              details: {
                primaryModel: model.id,
                fallbackModel: fallbackModel.id,
                context,
                primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError)
              },
              timestamp: new Date()
            }).catch(alertError => {
              console.error('[ResilientLLM] Failed to send fallback success alert:', alertError);
            });
          }
          
          console.log(`[ResilientLLM] Fallback model ${fallbackModel.id} succeeded for context: ${context}`);
          return result;
          
        } catch (fallbackError) {
          console.warn(`[ResilientLLM] Fallback model ${fallbackModel.id} also failed:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          continue;
        }
      }
      
      // All models failed - send critical alert
      await alertingService.alertSystemIssue({
        component: 'AI_MODELS',
        message: `All AI models failed for task: ${context}`,
        details: {
          primaryModel: model.id,
          fallbackModels: fallbackModels.map(m => m.id),
          context,
          primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError)
        },
        timestamp: new Date()
      }).catch(alertError => {
        console.error('[ResilientLLM] Failed to send critical AI failure alert:', alertError);
      });
      
      throw new Error(`All AI models failed for context: ${context}. Primary error: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
    }
  }
  
  /**
   * Enhanced version of generateAndValidate with resilience
   */
  static async generateAndValidateResilient<T, U>(
    prompt: string,
    schema: z.ZodSchema<T>,
    model: Model,
    task: ModelTask,
    transform?: (data: T) => U,
    rescue?: (data: any) => any,
    options: ResilientCallOptions = {}
  ): Promise<{ data: U; usage: TokenUsage }> {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options.retryConfig };
    const context = options.context || `task_${task}`;
    
    // Try primary model first
    try {
      return await generateAndValidate(prompt, schema, model, task, transform, rescue);
    } catch (primaryError) {
      console.warn(`[ResilientLLM] Primary model validation failed for ${model.id}:`, primaryError instanceof Error ? primaryError.message : String(primaryError));
      
      if (!options.enableFallbacks) {
        throw primaryError;
      }
      
      // Get fallback models for this task
      const fallbackModels = await this.getFallbackModelsForTask(task, model);
      
      for (const fallbackModel of fallbackModels) {
        try {
          console.log(`[ResilientLLM] Trying validation fallback: ${fallbackModel.id}`);
          
          const result = await generateAndValidate(prompt, schema, fallbackModel, task, transform, rescue);
          
          if (options.alertOnFallback) {
            await alertingService.alertSystemIssue({
              component: 'AI_MODELS',
              message: `AI model validation fallback successful: ${model.id} → ${fallbackModel.id}`,
              details: {
                primaryModel: model.id,
                fallbackModel: fallbackModel.id,
                task,
                context,
                primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError)
              },
              timestamp: new Date()
            }).catch(alertError => {
              console.error('[ResilientLLM] Failed to send validation fallback alert:', alertError);
            });
          }
          
          return result;
          
        } catch (fallbackError) {
          console.warn(`[ResilientLLM] Validation fallback ${fallbackModel.id} failed:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          continue;
        }
      }
      
      throw primaryError;
    }
  }
  
  /**
   * Wrapper for question response generation with resilience
   */
  static async generateQuestionResponseResilient(
    question: QuestionInput,
    model: Model,
    options: ResilientCallOptions = {}
  ): Promise<ChatCompletionResponse<string>> {
    const context = `question_response_${question.text.substring(0, 50)}`;
    
    try {
      const result = await this.generateResilientChatCompletion(
        model,
        `SYSTEM PROMPT: ${question.systemPrompt || 'Answer the following question comprehensively.'}\nQUESTION: "${question.text}"\nANSWER:`,
        undefined,
        { ...options, context }
      );
      
      if (!result.content) {
        throw new Error('LLM returned empty content for question response.');
      }
      
      return {
        data: result.content,
        usage: result.usage,
      };
    } catch (error) {
      console.error(`[ResilientLLM] Question response generation failed:`, error);
      throw error;
    }
  }
  
  /**
   * Check if rate limit error and calculate appropriate wait time
   */
  private static isRateLimitError(error: any): { isRateLimit: boolean; waitTimeMs?: number } {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || error?.status;
    
    // OpenAI rate limits
    if (errorCode === 429 || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      // Extract retry-after header if available
      const retryAfter = error?.response?.headers?.['retry-after'];
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 1 minute
      return { isRateLimit: true, waitTimeMs: Math.min(waitTime, 300000) }; // Max 5 minutes
    }
    
    // Anthropic rate limits
    if (errorMessage.includes('rate_limit_error')) {
      return { isRateLimit: true, waitTimeMs: 60000 };
    }
    
    // Google/Gemini rate limits
    if (errorMessage.includes('quota exceeded') || errorMessage.includes('resource has been exhausted')) {
      return { isRateLimit: true, waitTimeMs: 60000 };
    }
    
    return { isRateLimit: false };
  }
  
  /**
   * Make API call with intelligent retry logic
   */
  private static async callWithRetry(
    model: Model,
    prompt: string,
    schema: z.ZodType<any> | undefined,
    config: RetryConfig,
    context: string
  ): Promise<{ content: string | null; usage: TokenUsage }> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        return await generateChatCompletion(model, prompt, schema);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const isLastAttempt = attempt === config.maxRetries;
        const rateLimitInfo = this.isRateLimitError(error);
        
        console.warn(`[ResilientLLM] Attempt ${attempt}/${config.maxRetries} failed for ${model.id} (${context}):`, lastError.message);
        
        if (isLastAttempt) {
          break;
        }
        
        // Calculate delay based on error type
        let delayMs: number;
        
        if (rateLimitInfo.isRateLimit) {
          delayMs = rateLimitInfo.waitTimeMs || config.baseDelayMs;
          console.log(`[ResilientLLM] Rate limit detected, waiting ${delayMs}ms before retry`);
        } else {
          // Exponential backoff for other errors
          delayMs = Math.min(
            config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
            config.maxDelayMs
          );
        }
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw lastError || new Error(`Failed after ${config.maxRetries} attempts`);
  }
  
  /**
   * Get fallback models for a specific model based on engine compatibility
   */
  private static async getFallbackModels(primaryModel: Model): Promise<Model[]> {
    // For now, return empty array. In production, you might want to:
    // 1. Check which models are currently healthy
    // 2. Return models from different engines as fallbacks
    // 3. Prioritize based on cost/performance characteristics
    
    const primaryEngine = primaryModel.engine;
    const fallbackEngines = ENGINE_FALLBACK_PRIORITY[primaryEngine as keyof typeof ENGINE_FALLBACK_PRIORITY] || [];
    
    // This would need to be implemented based on your model configuration
    // For now, return empty to avoid complex fallback logic
    return [];
  }
  
  /**
   * Get fallback models for a specific task, excluding the primary model
   */
  private static async getFallbackModelsForTask(task: ModelTask, primaryModel: Model): Promise<Model[]> {
    const allModelsForTask = getModelsByTask(task);
    return allModelsForTask.filter(model => model.id !== primaryModel.id);
  }
}

// Export convenience functions that match the original API but with resilience
export const generateResilientQuestionResponse = (
  question: QuestionInput,
  model: Model,
  options: ResilientCallOptions = { enableFallbacks: true, alertOnFallback: true }
) => ResilientLlmService.generateQuestionResponseResilient(question, model, options);

export const generateResilientChatCompletion = (
  model: Model,
  prompt: string,
  schema?: z.ZodType<any>,
  options: ResilientCallOptions = { enableFallbacks: true, alertOnFallback: true }
) => ResilientLlmService.generateResilientChatCompletion(model, prompt, schema, options);

export const generateAndValidateResilient = <T, U>(
  prompt: string,
  schema: z.ZodSchema<T>,
  model: Model,
  task: ModelTask,
  transform?: (data: T) => U,
  rescue?: (data: any) => any,
  options: ResilientCallOptions = { enableFallbacks: true, alertOnFallback: true }
) => ResilientLlmService.generateAndValidateResilient(prompt, schema, model, task, transform, rescue, options);

export { ResilientLlmService, type ResilientCallOptions };