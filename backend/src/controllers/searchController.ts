/**
 * @file searchController.ts
 * @description This file contains the controller for handling direct interactions with the language models.
 * It provides an endpoint for users to ask questions and receive answers, with a simple in-memory rate limiter to prevent abuse.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - zod: For schema validation of request bodies.
 * - ../config/models: The configuration for LLM models.
 * - ../services/llmService: Service for generating chat completions.
 *
 * @exports
 * - askModel: Controller for asking a question to a specific language model.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import { MODELS } from '../config/models';
import { generateChatCompletion } from '../services/llmService';

// Schema for request validation
const askSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  modelId: z.string().min(1, 'modelId is required'),
});

// Rate limit storage
const lastCallMap: Record<string, number> = {};

export const askModel = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { query, modelId } = askSchema.parse(req.body);

    const model = MODELS[modelId];
    if (!model) {
      return res.status(400).json({ error: `Unknown modelId: ${modelId}` });
    }

    // Simple in-memory rate limit (per model)
    const now = Date.now();
    const last = lastCallMap[modelId] || 0;
    if (now - last < 30000) {
      return res.status(429).json({ error: 'Rate limit: wait before querying again' });
    }
    lastCallMap[modelId] = now;

    const { content: answer } = await generateChatCompletion(model, query);
    const latencyMs = Date.now() - startTime;

    return res.status(200).json({ engine: modelId, answer, latencyMs });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error('[SearchController] askModel error', err);
    return res.status(500).json({ error: 'Failed to generate answer' });
  }
}; 