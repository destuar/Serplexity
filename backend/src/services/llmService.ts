/**
 * @file llmService.ts
 * @description Direct PydanticAI implementation replacing legacy LLM service
 * 
 * This service provides a clean, production-ready interface for PydanticAI
 * without migration layers or backward compatibility concerns. It offers
 * structured output, multi-provider support, and superior AI regulation.
 * 
 * @architecture
 * - Direct PydanticAI agent execution
 * - Structured output with Pydantic models
 * - Multi-provider support with health monitoring
 * - Comprehensive error handling and retries
 * - Performance monitoring and optimization
 * 
 * @dependencies
 * - pydanticLlmService: Core PydanticAI service
 * - providerManager: Provider health and selection
 * - zod: Schema validation for TypeScript compatibility
 * 
 * @exports
 * - All functions with same signatures as legacy service
 * - Enhanced types and interfaces
 * - Comprehensive error handling
 */

import { z } from 'zod';
import logger from '../utils/logger';
import { pydanticLlmService, PydanticAgentOptions, PydanticResponse } from './pydanticLlmService';
import { providerManager } from '../config/pydanticProviders';
import { Model, ModelEngine, ModelTask } from '../config/models';

// --- Enhanced Type Definitions ---
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

export interface QuestionInput {
  id: string;
  text: string;
  systemPrompt?: string;
}

// --- Pydantic Schema Definitions ---
const SentimentRatingSchema = z.object({
  quality: z.number().min(1).max(10),
  priceValue: z.number().min(1).max(10),
  brandReputation: z.number().min(1).max(10),
  brandTrust: z.number().min(1).max(10),
  customerService: z.number().min(1).max(10),
  summaryDescription: z.string().min(10).max(500),
});

const SentimentScoresSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  ratings: z.array(SentimentRatingSchema).min(1),
});

const CompetitorSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().min(1),
});

const QuestionResponseSchema = z.object({
  response: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  sources: z.array(z.string()).optional(),
});

export type SentimentScores = z.infer<typeof SentimentScoresSchema>;

// --- Core Service Implementation ---

/**
 * Generate sentiment scores for a company using PydanticAI
 */
export async function generateSentimentScores(
  companyName: string,
  industry: string,
  model: Model
): Promise<ChatCompletionResponse<SentimentScores>> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting PydanticAI sentiment analysis', {
      companyName,
      industry,
      model: model.id
    });

    // Context for PydanticAI agent (embedded system prompt)
    const context = `Analyze sentiment for ${companyName} in ${industry} industry`;

    // Execute PydanticAI agent
    const result = await pydanticLlmService.executeAgent<SentimentScores>(
      'sentiment_agent.py',
      {
        company_name: companyName,
        industry,
        context,
        analysis_type: 'comprehensive'
      },
      SentimentScoresSchema,
      {
        modelId: model.id,
        temperature: 0.3,
        maxTokens: 2000,
        timeout: 30000
      }
    );

    // Performance tracking is now handled by PydanticAI agents internally

    const executionTime = Date.now() - startTime;
    
    logger.info('PydanticAI sentiment analysis completed', {
      companyName,
      industry,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      modelUsed: result.metadata.modelUsed,
      success: result.metadata.success
    });

    return {
      data: result.data,
      usage: {
        promptTokens: Math.floor(result.metadata.tokensUsed * 0.7),
        completionTokens: Math.floor(result.metadata.tokensUsed * 0.3),
        totalTokens: result.metadata.tokensUsed
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('PydanticAI sentiment analysis failed', {
      companyName,
      industry,
      executionTime,
      error: error instanceof Error ? error.message : String(error)
    });

    throw new Error(`Sentiment analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate overall sentiment summary using PydanticAI
 */
export async function generateOverallSentimentSummary(
  companyName: string,
  sentiments: SentimentScores[]
): Promise<ChatCompletionResponse<SentimentScores>> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting PydanticAI sentiment summary', {
      companyName,
      sentimentCount: sentiments.length
    });

    if (sentiments.length === 0) {
      throw new Error('No sentiment data provided for summary');
    }

    // Aggregate ratings for analysis
    const allRatings = sentiments.flatMap(s => s.ratings);
    const averages = {
      quality: Math.round(allRatings.reduce((sum, r) => sum + r.quality, 0) / allRatings.length),
      priceValue: Math.round(allRatings.reduce((sum, r) => sum + r.priceValue, 0) / allRatings.length),
      brandReputation: Math.round(allRatings.reduce((sum, r) => sum + r.brandReputation, 0) / allRatings.length),
      brandTrust: Math.round(allRatings.reduce((sum, r) => sum + r.brandTrust, 0) / allRatings.length),
      customerService: Math.round(allRatings.reduce((sum, r) => sum + r.customerService, 0) / allRatings.length)
    };

    // Generate summary using PydanticAI
    const result = await pydanticLlmService.executeAgent<SentimentScores>(
      'sentiment_summary_agent.py',
      {
        company_name: companyName,
        industry: sentiments[0].industry,
        aggregated_ratings: averages,
        individual_sentiments: sentiments,
        analysis_type: 'summary'
      },
      SentimentScoresSchema,
      {
        temperature: 0.4,
        maxTokens: 1500,
        timeout: 25000
      }
    );

    const executionTime = Date.now() - startTime;
    
    logger.info('PydanticAI sentiment summary completed', {
      companyName,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      success: result.metadata.success
    });

    return {
      data: result.data,
      usage: {
        promptTokens: Math.floor(result.metadata.tokensUsed * 0.7),
        completionTokens: Math.floor(result.metadata.tokensUsed * 0.3),
        totalTokens: result.metadata.tokensUsed
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('PydanticAI sentiment summary failed', {
      companyName,
      executionTime,
      error: error instanceof Error ? error.message : String(error)
    });

    throw new Error(`Sentiment summary failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate question response using PydanticAI
 */
export async function generateQuestionResponse(
  question: QuestionInput,
  model: Model
): Promise<ChatCompletionResponse<string>> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting PydanticAI question response', {
      questionId: question.id,
      questionLength: question.text.length,
      model: model.id
    });

    // Context for PydanticAI agent (embedded system prompt)
    const context = `Answer the following question professionally: ${question.text}`;

    // Execute PydanticAI agent
    const result = await pydanticLlmService.executeAgent<{ response: string }>(
      'question_agent.py',
      {
        question: question.text,
        system_prompt: question.systemPrompt,
        context,
        question_id: question.id
      },
      QuestionResponseSchema,
      {
        modelId: model.id,
        temperature: 0.7,
        maxTokens: 1500,
        timeout: 30000
      }
    );

    const executionTime = Date.now() - startTime;
    
    logger.info('PydanticAI question response completed', {
      questionId: question.id,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      success: result.metadata.success
    });

    return {
      data: result.data.response,
      usage: {
        promptTokens: Math.floor(result.metadata.tokensUsed * 0.6),
        completionTokens: Math.floor(result.metadata.tokensUsed * 0.4),
        totalTokens: result.metadata.tokensUsed
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('PydanticAI question response failed', {
      questionId: question.id,
      executionTime,
      error: error instanceof Error ? error.message : String(error)
    });

    throw new Error(`Question response failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate website enrichment for competitors using PydanticAI
 */
export async function generateWebsiteForCompetitors(
  competitorNames: string[]
): Promise<ChatCompletionResponse<CompetitorInfo[]>> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting PydanticAI website enrichment', {
      competitorCount: competitorNames.length
    });

    if (competitorNames.length === 0) {
      return {
        data: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };
    }

    // Context for PydanticAI agent (embedded system prompt)
    const context = `Find official websites for these competitors: ${competitorNames.join(', ')}`;

    // Execute PydanticAI agent
    const result = await pydanticLlmService.executeAgent<{ competitors: CompetitorInfo[] }>(
      'website_enrichment_agent.py',
      {
        competitor_names: competitorNames,
        context,
        search_depth: 'standard'
      },
      z.object({
        competitors: z.array(CompetitorSchema)
      }),
      {
        temperature: 0.2,
        maxTokens: 2000,
        timeout: 45000
      }
    );

    const executionTime = Date.now() - startTime;
    
    logger.info('PydanticAI website enrichment completed', {
      competitorCount: competitorNames.length,
      foundWebsites: result.data.competitors.length,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      success: result.metadata.success
    });

    return {
      data: result.data.competitors,
      usage: {
        promptTokens: Math.floor(result.metadata.tokensUsed * 0.8),
        completionTokens: Math.floor(result.metadata.tokensUsed * 0.2),
        totalTokens: result.metadata.tokensUsed
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('PydanticAI website enrichment failed', {
      competitorCount: competitorNames.length,
      executionTime,
      error: error instanceof Error ? error.message : String(error)
    });

    throw new Error(`Website enrichment failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generic chat completion function for PydanticAI
 */
export async function generateChatCompletion(
  model: Model,
  prompt: string,
  schema?: z.ZodType<any>
): Promise<{ content: string | null; usage: TokenUsage }> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting PydanticAI chat completion', {
      modelId: model.id,
      promptLength: prompt.length,
      hasSchema: !!schema
    });

    if (schema) {
      // Structured output with schema validation
      const result = await pydanticLlmService.executeAgent<any>(
        'generic_agent.py',
        {
          prompt,
          output_schema: schema,
          structured: true
        },
        schema,
        {
          modelId: model.id,
          temperature: 0.7,
          maxTokens: 2000,
          timeout: 30000
        }
      );

      return {
        content: JSON.stringify(result.data),
        usage: {
          promptTokens: Math.floor(result.metadata.tokensUsed * 0.7),
          completionTokens: Math.floor(result.metadata.tokensUsed * 0.3),
          totalTokens: result.metadata.tokensUsed
        }
      };
    } else {
      // Simple text completion
      const result = await pydanticLlmService.executeAgent<{ response: string }>(
        'text_agent.py',
        {
          prompt,
          structured: false
        },
        z.object({ response: z.string() }),
        {
          modelId: model.id,
          temperature: 0.7,
          maxTokens: 2000,
          timeout: 30000
        }
      );

      return {
        content: result.data.response,
        usage: {
          promptTokens: Math.floor(result.metadata.tokensUsed * 0.7),
          completionTokens: Math.floor(result.metadata.tokensUsed * 0.3),
          totalTokens: result.metadata.tokensUsed
        }
      };
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('PydanticAI chat completion failed', {
      modelId: model.id,
      executionTime,
      error: error instanceof Error ? error.message : String(error)
    });

    throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Enhanced generateAndValidate function using PydanticAI
 */
export async function generateAndValidate<T, U>(
  prompt: string,
  schema: z.ZodSchema<T>,
  model: Model,
  task: ModelTask,
  transform?: (data: T) => U,
  rescue?: (data: any) => any
): Promise<{ data: U; usage: TokenUsage }> {
  const startTime = Date.now();
  
  try {
    logger.info('Starting PydanticAI generate and validate', {
      modelId: model.id,
      task,
      promptLength: prompt.length
    });

    // Execute with PydanticAI agent
    const result = await pydanticLlmService.executeAgent<T>(
      'validation_agent.py',
      {
        prompt,
        task,
        validation_schema: schema,
        transform_enabled: !!transform,
        rescue_enabled: !!rescue
      },
      schema,
      {
        modelId: model.id,
        temperature: 0.3,
        maxTokens: 2000,
        timeout: 30000
      }
    );

    // Apply transformations if provided
    let finalData: U;
    if (transform) {
      finalData = transform(result.data);
    } else {
      finalData = result.data as unknown as U;
    }

    const executionTime = Date.now() - startTime;
    
    logger.info('PydanticAI generate and validate completed', {
      modelId: model.id,
      task,
      executionTime,
      tokensUsed: result.metadata.tokensUsed,
      success: result.metadata.success
    });

    return {
      data: finalData,
      usage: {
        promptTokens: Math.floor(result.metadata.tokensUsed * 0.7),
        completionTokens: Math.floor(result.metadata.tokensUsed * 0.3),
        totalTokens: result.metadata.tokensUsed
      }
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('PydanticAI generate and validate failed', {
      modelId: model.id,
      task,
      executionTime,
      error: error instanceof Error ? error.message : String(error)
    });

    throw new Error(`Generate and validate failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Service Health and Monitoring ---

/**
 * Get service health status
 */
export function getServiceHealth() {
  const providerHealth = providerManager.getHealthReport();
  const serviceStats = pydanticLlmService.getServiceStatistics();
  
  return {
    providers: providerHealth,
    activeExecutions: serviceStats.activeExecutions,
    poolSize: serviceStats.poolSize,
    overallHealth: providerHealth.filter(p => p.available).length / providerHealth.length
  };
}

/**
 * Get detailed service statistics
 */
export function getServiceStatistics() {
  return pydanticLlmService.getServiceStatistics();
}

logger.info('PydanticAI LLM service initialized successfully', {
  availableProviders: providerManager.getAvailableProviders().length,
  healthyProviders: providerManager.getHealthReport().filter(p => p.available).length
});