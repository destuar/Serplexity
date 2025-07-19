/**
 * @file healthRoutes.ts
 * @description Health check routes for PydanticAI system monitoring
 *
 * This module provides comprehensive health check endpoints for monitoring
 * the PydanticAI migration status, provider health, and system performance.
 *
 * @endpoints
 * - GET /health/pydantic - PydanticAI system health
 * - GET /health/providers - Provider health status
 * - GET /health/migration - Migration statistics
 * - GET /health/overall - Overall system health
 *
 * @dependencies
 * - express: Web framework
 * - migrationService: PydanticAI migration service
 * - providerManager: Provider management service
 * - pydanticLlmService: Core PydanticAI service
 *
 * @exports
 * - router: Express router with health check routes
 */

import { Router, Request, Response } from "express";
import { getServiceStatistics, getServiceHealth } from "../services/llmService";
import { providerManager } from "../config/pydanticProviders";
import { pydanticLlmService } from "../services/pydanticLlmService";
// Modern PydanticAI uses embedded system prompts, not external prompt management
import logger from "../utils/logger";

const router = Router();

/**
 * PydanticAI system health check
 * GET /health/pydantic
 */
router.get("/pydantic", async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Get service statistics
    const serviceStats = getServiceStatistics();
    const serviceHealth = getServiceHealth();

    // Calculate health score
    const healthScore = serviceHealth.overallHealth;

    const responseTime = Date.now() - startTime;

    const health = {
      status:
        healthScore > 0.7
          ? "healthy"
          : healthScore > 0.3
            ? "degraded"
            : "unhealthy",
      timestamp: new Date().toISOString(),
      responseTime,
      healthScore,
      pydanticAI: {
        enabled: true,
        activeExecutions: serviceStats.activeExecutions,
        poolSize: serviceStats.poolSize,
        providers: serviceHealth.providers.length,
      },
      providers: {
        available: serviceHealth.providers.filter((p) => p.available).length,
        total: serviceHealth.providers.length,
        health: serviceHealth.overallHealth,
      },
    };

    logger.info("PydanticAI health check completed", {
      status: health.status,
      healthScore,
      responseTime,
      activeExecutions: serviceStats.activeExecutions,
    });

    res
      .status(
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 202
            : 503,
      )
      .json(health);
  } catch (error) {
    logger.error("PydanticAI health check failed", { error });

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      pydanticAI: {
        enabled: false,
        activeExecutions: 0,
        poolSize: 0,
        providers: 0,
      },
    });
  }
});

/**
 * Provider health status
 * GET /health/providers
 */
router.get("/providers", async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    const providerHealth = providerManager.getHealthReport();
    const availableProviders = providerManager.getAvailableProviders();

    const healthyProviders = providerHealth.filter((p) => p.available);
    const unhealthyProviders = providerHealth.filter((p) => !p.available);

    const overallHealth = healthyProviders.length / providerHealth.length;
    const status =
      overallHealth > 0.7
        ? "healthy"
        : overallHealth > 0.3
          ? "degraded"
          : "unhealthy";

    const responseTime = Date.now() - startTime;

    const health = {
      status,
      timestamp: new Date().toISOString(),
      responseTime,
      summary: {
        total: providerHealth.length,
        healthy: healthyProviders.length,
        unhealthy: unhealthyProviders.length,
        overallHealth,
      },
      providers: providerHealth.map((provider) => ({
        id: provider.id,
        available: provider.available,
        lastChecked: provider.lastChecked,
        errorCount: provider.errorCount,
        avgResponseTime: provider.avgResponseTime,
        status: provider.available ? "healthy" : "unhealthy",
        statusMessage: provider.statusMessage,
      })),
      availableProviders: availableProviders.map((p) => ({
        id: p.id,
        name: p.name,
        priority: p.priority,
        capabilities: p.capabilities,
      })),
    };

    logger.info("Provider health check completed", {
      status,
      healthyProviders: healthyProviders.length,
      unhealthyProviders: unhealthyProviders.length,
      responseTime,
    });

    res
      .status(status === "healthy" ? 200 : status === "degraded" ? 202 : 503)
      .json(health);
  } catch (error) {
    logger.error("Provider health check failed", { error });

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      providers: [],
    });
  }
});

/**
 * PydanticAI service statistics
 * GET /health/service
 */
router.get("/service", async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    const serviceStats = getServiceStatistics();
    const serviceHealth = getServiceHealth();

    const responseTime = Date.now() - startTime;

    const health = {
      status:
        serviceHealth.overallHealth > 0.7
          ? "healthy"
          : serviceHealth.overallHealth > 0.3
            ? "degraded"
            : "unhealthy",
      timestamp: new Date().toISOString(),
      responseTime,
      service: {
        enabled: true,
        activeExecutions: serviceStats.activeExecutions,
        poolSize: serviceStats.poolSize,
        providerHealth: serviceHealth.providers,
        overallHealth: serviceHealth.overallHealth,
      },
    };

    logger.info("Service health check completed", {
      status: health.status,
      overallHealth: serviceHealth.overallHealth,
      responseTime,
    });

    res
      .status(
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 202
            : 503,
      )
      .json(health);
  } catch (error) {
    logger.error("Service health check failed", { error });

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      service: {
        enabled: false,
        activeExecutions: 0,
        poolSize: 0,
      },
    });
  }
});

/**
 * Overall system health
 * GET /health/overall
 */
router.get("/overall", async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Get all health components
    const serviceStats = getServiceStatistics();
    const serviceHealth = getServiceHealth();
    const providerHealth = providerManager.getHealthReport();

    // Calculate component health scores
    const pydanticHealth = serviceHealth.overallHealth;
    const providerHealthScore =
      providerHealth.filter((p) => p.available).length / providerHealth.length;

    // Calculate overall health
    const overallHealth = pydanticHealth * 0.6 + providerHealthScore * 0.4;
    const status =
      overallHealth > 0.7
        ? "healthy"
        : overallHealth > 0.3
          ? "degraded"
          : "unhealthy";

    const responseTime = Date.now() - startTime;

    const health = {
      status,
      timestamp: new Date().toISOString(),
      responseTime,
      overallHealth,
      components: {
        pydanticAI: {
          status:
            pydanticHealth > 0.7
              ? "healthy"
              : pydanticHealth > 0.3
                ? "degraded"
                : "unhealthy",
          score: pydanticHealth,
          enabled: true,
          activeExecutions: serviceStats.activeExecutions,
        },
        providers: {
          status:
            providerHealthScore > 0.7
              ? "healthy"
              : providerHealthScore > 0.3
                ? "degraded"
                : "unhealthy",
          score: providerHealthScore,
          healthy: providerHealth.filter((p) => p.available).length,
          total: providerHealth.length,
        },
      },
      summary: {
        activeExecutions: serviceStats.activeExecutions,
        poolSize: serviceStats.poolSize,
        availableProviders: providerHealth.filter((p) => p.available).length,
        totalProviders: providerHealth.length,
      },
    };

    logger.info("Overall health check completed", {
      status,
      overallHealth,
      pydanticHealth,
      providerHealthScore,
      responseTime,
    });

    res
      .status(status === "healthy" ? 200 : status === "degraded" ? 202 : 503)
      .json(health);
  } catch (error) {
    logger.error("Overall health check failed", { error });

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      overallHealth: 0,
      components: {
        pydanticAI: { status: "error", score: 0 },
        providers: { status: "error", score: 0 },
      },
    });
  }
});

/**
 * Agent performance health (replaces legacy prompt management)
 * GET /health/agents
 */
router.get("/agents", async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    const serviceStats = getServiceStatistics();
    const serviceHealth = getServiceHealth();

    const responseTime = Date.now() - startTime;

    const health = {
      status:
        serviceHealth.overallHealth > 0.8
          ? "healthy"
          : serviceHealth.overallHealth > 0.6
            ? "degraded"
            : "unhealthy",
      timestamp: new Date().toISOString(),
      responseTime,
      agents: {
        activeExecutions: serviceStats.activeExecutions,
        poolSize: serviceStats.poolSize,
        overallHealth: serviceHealth.overallHealth,
        providerHealth: serviceHealth.providers.length,
      },
      note: "Modern PydanticAI uses embedded system prompts in agents, not external prompt management",
    };

    logger.info("Agent health check completed", {
      status: health.status,
      overallHealth: serviceHealth.overallHealth,
      responseTime,
    });

    res
      .status(
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 202
            : 503,
      )
      .json(health);
  } catch (error) {
    logger.error("Agent health check failed", { error });

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      agents: {
        activeExecutions: 0,
        poolSize: 0,
        overallHealth: 0,
      },
    });
  }
});

export default router;
