/**
 * @file searchAgentController.ts
 * @description Controller for search agent with browser-optimized responses.
 * Integrates with PydanticAI search agent for natural, comprehensive search results
 * that mimic browser counterparts across different models.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - zod: For schema validation of request bodies.
 * - ../config/models: The configuration for LLM models.
 * - ../services/pythonAgentService: Service for calling Python agents.
 * - ../utils/logger: Centralized logging system.
 *
 * @exports
 * - searchWithAgent: Controller for executing search queries with optimized agents.
 */
import { Request, Response } from "express";
import { z } from "zod";
import { pydanticLlmService } from "../services/pydanticLlmService";
import logger from "../utils/logger";

// Interface for search agent response
interface SearchAgentResult {
  query: string;
  answer: string;
  confidence?: number;
  citations?: Array<{
    url: string;
    title: string;
    domain: string;
  }>;
  has_web_search: boolean;
  model_used: string;
  execution_time: number;
}

// Schema for search request validation
const searchSchema = z.object({
  query: z.string().min(1, "Query is required").max(2000, "Query too long"),
  modelId: z.string().min(1, "modelId is required"),
  enableWebSearch: z.boolean().optional().default(true),
  temperature: z.number().min(0).max(2).optional().default(0.7),
});

// Rate limit storage (in production, use Redis)
const searchCallMap: Record<string, number> = {};
const SEARCH_RATE_LIMIT_MS = 45000; // 45 seconds between search calls per model

/**
 * Search with optimized agent for browser-like responses
 */
export const searchWithAgent = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.info("Search agent request started", {
      requestId,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });

    const { query, modelId, enableWebSearch, temperature } = searchSchema.parse(req.body);

    // Rate limiting per model
    const now = Date.now();
    const lastCall = searchCallMap[modelId] || 0;
    if (now - lastCall < SEARCH_RATE_LIMIT_MS) {
      const waitTime = Math.ceil((SEARCH_RATE_LIMIT_MS - (now - lastCall)) / 1000);
      logger.warn("Search rate limit exceeded", { requestId, modelId, waitTime });
      return res.status(429).json({
        error: "Rate limit: please wait before searching again",
        retryAfter: waitTime,
      });
    }
    searchCallMap[modelId] = now;

    logger.info("Executing search agent", {
      requestId,
      modelId,
      queryLength: query.length,
      webSearchEnabled: enableWebSearch,
    });

    // Call search agent with optimized parameters
    const agentInput = {
      query,
      model_id: modelId,
      enable_web_search: enableWebSearch,
      temperature: temperature,
    };

    const agentResult = await pydanticLlmService.executeAgent(
      "search_agent.py",
      agentInput,
      null, // No schema validation, trust PydanticAI output
      {
        modelId,
        timeout: 90000, // 90 seconds for search operations
        retryAttempts: 2,
        metadata: { requestId, queryType: "search" }
      }
    );

    const searchResult = agentResult.data as SearchAgentResult;
    const latencyMs = Date.now() - startTime;

    // Validate search result structure
    if (!searchResult || !searchResult.answer) {
      logger.error("Search agent returned invalid result", {
        requestId,
        modelId,
        result: searchResult,
      });
      return res.status(500).json({
        error: "Search agent returned invalid response",
        requestId,
      });
    }

    logger.info("Search agent request completed", {
      requestId,
      modelId,
      latencyMs,
      queryLength: query.length,
      answerLength: searchResult.answer.length,
      citationsCount: searchResult.citations?.length || 0,
      webSearchUsed: searchResult.has_web_search,
    });

    // Transform response to match expected format for frontend
    const response = {
      engine: searchResult.model_used || modelId,
      answer: searchResult.answer,
      latencyMs: searchResult.execution_time || latencyMs,
      requestId,
      // Additional search-specific metadata with properly formatted citations
      citations: searchResult.citations || [],
      hasWebSearch: searchResult.has_web_search || false,
    };

    return res.status(200).json(response);

  } catch (err) {
    const latencyMs = Date.now() - startTime;

    if (err instanceof z.ZodError) {
      logger.warn("Search request validation failed", {
        requestId,
        errors: err.errors,
        latencyMs,
      });
      return res.status(400).json({
        error: "Validation failed",
        details: err.errors,
        requestId,
      });
    }

    logger.error("Search agent controller error", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      latencyMs,
    });

    return res.status(500).json({
      error: "Failed to process search query",
      requestId,
    });
  }
};

/**
 * Health check endpoint for search agent
 */
export const searchAgentHealth = async (req: Request, res: Response) => {
  try {
    // Simple health check by calling search agent with minimal input
    const healthInput = {
      query: "test",
      model_id: "gpt-4o",
      enable_web_search: false,
    };

    const startTime = Date.now();
    const result = await pydanticLlmService.executeAgent(
      "search_agent.py",
      healthInput,
      null,
      { timeout: 10000, retryAttempts: 1 }
    );
    const responseTime = Date.now() - startTime;

    if (!result.metadata.success) {
      return res.status(503).json({
        status: "unhealthy",
        error: "Search agent health check failed",
        responseTime,
      });
    }

    return res.status(200).json({
      status: "healthy",
      responseTime,
      agentId: "search_agent",
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    logger.error("Search agent health check failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return res.status(503).json({
      status: "unhealthy",
      error: err instanceof Error ? err.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
};