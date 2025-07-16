/**
 * @file searchController.ts
 * @description Modern controller for direct interactions with PydanticAI language models.
 * It provides an endpoint for users to ask questions and receive answers, with rate limiting.
 * Uses modern PydanticAI architecture for superior error handling and structured output.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - zod: For schema validation of request bodies.
 * - ../config/models: The configuration for LLM models.
 * - ../services/llmService: Modern PydanticAI service for generating chat completions.
 * - ../utils/logger: Centralized logging system.
 *
 * @exports
 * - askModel: Controller for asking a question to a specific language model.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { MODELS } from '../config/models';
import { generateChatCompletion } from '../services/llmService';
import logger from '../utils/logger';

// Schema for request validation
const askSchema = z.object({
  query: z.string().min(1, 'Query is required').max(1000, 'Query too long'),
  modelId: z.string().min(1, 'modelId is required'),
});

// Rate limit storage (in production, use Redis)
const lastCallMap: Record<string, number> = {};
const RATE_LIMIT_MS = 30000; // 30 seconds between calls per model

export const askModel = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('Search controller request started', {
      requestId,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const { query, modelId } = askSchema.parse(req.body);

    const model = MODELS[modelId];
    if (!model) {
      logger.warn('Invalid model requested', { requestId, modelId, availableModels: Object.keys(MODELS) });
      return res.status(400).json({ 
        error: `Unknown modelId: ${modelId}`,
        availableModels: Object.keys(MODELS)
      });
    }

    // Simple in-memory rate limit (per model)
    const now = Date.now();
    const last = lastCallMap[modelId] || 0;
    if (now - last < RATE_LIMIT_MS) {
      const waitTime = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
      logger.warn('Rate limit exceeded', { requestId, modelId, waitTime });
      return res.status(429).json({ 
        error: 'Rate limit: wait before querying again',
        retryAfter: waitTime
      });
    }
    lastCallMap[modelId] = now;

    logger.info('Executing PydanticAI request', { 
      requestId, 
      modelId, 
      queryLength: query.length 
    });

    const { content: answer, usage } = await generateChatCompletion(model, query);
    
    if (!answer) {
      logger.error('PydanticAI returned null content', { requestId, modelId, usage });
      return res.status(500).json({ 
        error: 'AI model failed to generate response',
        requestId
      });
    }

    const latencyMs = Date.now() - startTime;
    
    logger.info('Search controller request completed', {
      requestId,
      modelId,
      latencyMs,
      tokensUsed: usage.totalTokens,
      queryLength: query.length,
      responseLength: answer.length
    });

    return res.status(200).json({ 
      engine: modelId,
      answer,
      latencyMs,
      tokensUsed: usage.totalTokens,
      requestId
    });

  } catch (err) {
    const latencyMs = Date.now() - startTime;
    
    if (err instanceof z.ZodError) {
      logger.warn('Request validation failed', { requestId, errors: err.errors, latencyMs });
      return res.status(400).json({ 
        error: 'Validation failed',
        details: err.errors,
        requestId
      });
    }

    logger.error('Search controller error', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      latencyMs
    });

    return res.status(500).json({ 
      error: 'Failed to generate answer',
      requestId
    });
  }
}; 