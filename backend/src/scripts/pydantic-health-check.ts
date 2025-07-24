#!/usr/bin/env ts-node

/**
 * @file pydantic-health-check.ts
 * @description Health check script for PydanticAI system
 *
 * This script provides comprehensive health monitoring for the PydanticAI
 * system including provider health, service statistics, and performance metrics.
 */

import { getServiceHealth, getServiceStatistics } from "../services/llmService";
import { providerManager } from "../config/pydanticProviders";
// Modern PydanticAI uses embedded system prompts, not external prompt management
import logger from "../utils/logger";

interface HealthCheckResult {
  timestamp: string;
  overall: {
    status: "healthy" | "degraded" | "unhealthy";
    score: number;
  };
  providers: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    details: unknown[];
  };
  service: {
    activeExecutions: number;
    poolSize: number;
    status: string;
  };
  agents: {
    embedSystemPrompts: boolean;
    averagePerformance: number;
    status: string;
  };
  recommendations: string[];
}

async function runHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Get service health and statistics
    const serviceHealth = getServiceHealth();
    const serviceStats = getServiceStatistics();

    // Get provider health details
    const providerHealth = providerManager.getHealthReport();
    const _availableProviders = providerManager.getAvailableProviders();

    // Modern PydanticAI uses embedded system prompts - performance tracked in agents
    const avgPromptPerformance = serviceHealth.overallHealth;

    // Calculate provider health breakdown
    const healthyProviders = providerHealth.filter(
      (p) => p.available && p.errorCount < 5,
    );
    const degradedProviders = providerHealth.filter(
      (p) => p.available && p.errorCount >= 5,
    );
    const unhealthyProviders = providerHealth.filter((p) => !p.available);

    // Calculate overall health score
    const providerScore = healthyProviders.length / providerHealth.length;
    const serviceScore = serviceHealth.overallHealth;
    const promptScore = avgPromptPerformance;

    const overallScore =
      providerScore * 0.5 + serviceScore * 0.3 + promptScore * 0.2;

    // Determine overall status
    let overallStatus: "healthy" | "degraded" | "unhealthy";
    if (overallScore > 0.8) {
      overallStatus = "healthy";
    } else if (overallScore > 0.5) {
      overallStatus = "degraded";
    } else {
      overallStatus = "unhealthy";
    }

    // Generate recommendations
    const recommendations: string[] = [];

    if (unhealthyProviders.length > 0) {
      recommendations.push(
        `${unhealthyProviders.length} provider(s) are unhealthy. Check API keys and connectivity.`,
      );
    }

    if (degradedProviders.length > 0) {
      recommendations.push(
        `${degradedProviders.length} provider(s) have high error rates. Monitor for issues.`,
      );
    }

    if (serviceStats.activeExecutions > 20) {
      recommendations.push(
        "High number of active executions. Consider scaling up or optimizing performance.",
      );
    }

    if (avgPromptPerformance < 0.7) {
      recommendations.push(
        "Low agent performance detected. Review and optimize agent system prompts.",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "System is operating normally. No immediate action required.",
      );
    }

    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      overall: {
        status: overallStatus,
        score: overallScore,
      },
      providers: {
        total: providerHealth.length,
        healthy: healthyProviders.length,
        degraded: degradedProviders.length,
        unhealthy: unhealthyProviders.length,
        details: providerHealth.map((p) => ({
          id: p.id,
          available: p.available,
          errorCount: p.errorCount,
          avgResponseTime: p.avgResponseTime,
          lastChecked: p.lastChecked,
          status: p.available
            ? p.errorCount < 5
              ? "healthy"
              : "degraded"
            : "unhealthy",
        })),
      },
      service: {
        activeExecutions: serviceStats.activeExecutions,
        poolSize: serviceStats.poolSize,
        status:
          serviceHealth.overallHealth > 0.7
            ? "healthy"
            : serviceHealth.overallHealth > 0.3
              ? "degraded"
              : "unhealthy",
      },
      agents: {
        embedSystemPrompts: true,
        averagePerformance: avgPromptPerformance,
        status:
          avgPromptPerformance > 0.8
            ? "healthy"
            : avgPromptPerformance > 0.6
              ? "degraded"
              : "unhealthy",
      },
      recommendations,
    };

    const executionTime = Date.now() - startTime;
    logger.info("Health check completed", {
      executionTime,
      overallStatus,
      overallScore,
      providersHealthy: healthyProviders.length,
      providersTotal: providerHealth.length,
    });

    return result;
  } catch (error) {
    logger.error("Health check failed", { error });
    throw error;
  }
}

async function main() {
  try {
    console.log("🏥 PydanticAI Health Check\n");

    const healthResult = await runHealthCheck();

    // Display results
    console.log(
      `📊 Overall Health: ${healthResult.overall.status.toUpperCase()}`,
    );
    console.log(
      `🎯 Health Score: ${(healthResult.overall.score * 100).toFixed(1)}%`,
    );
    console.log(`⏰ Timestamp: ${healthResult.timestamp}\n`);

    console.log("🔗 Provider Health:");
    console.log(`  Total: ${healthResult.providers.total}`);
    console.log(`  Healthy: ${healthResult.providers.healthy}`);
    console.log(`  Degraded: ${healthResult.providers.degraded}`);
    console.log(`  Unhealthy: ${healthResult.providers.unhealthy}\n`);

    if (healthResult.providers.details.length > 0) {
      console.log("Provider Details:");
      healthResult.providers.details.forEach((provider) => {
        const statusEmoji =
          provider.status === "healthy"
            ? "✅"
            : provider.status === "degraded"
              ? "⚠️"
              : "❌";
        console.log(
          `  ${statusEmoji} ${provider.id}: ${provider.status} (errors: ${provider.errorCount})`,
        );
      });
      console.log();
    }

    console.log("⚙️ Service Status:");
    console.log(
      `  Active Executions: ${healthResult.service.activeExecutions}`,
    );
    console.log(`  Pool Size: ${healthResult.service.poolSize}`);
    console.log(`  Status: ${healthResult.service.status}\n`);

    console.log("🤖 Agent Performance:");
    console.log(
      `  Embedded System Prompts: ${healthResult.agents.embedSystemPrompts ? "Yes" : "No"}`,
    );
    console.log(
      `  Average Performance: ${(healthResult.agents.averagePerformance * 100).toFixed(1)}%`,
    );
    console.log(`  Status: ${healthResult.agents.status}\n`);

    console.log("💡 Recommendations:");
    healthResult.recommendations.forEach((rec) => {
      console.log(`  • ${rec}`);
    });

    // Exit with appropriate code
    process.exit(healthResult.overall.status === "unhealthy" ? 1 : 0);
  } catch (error) {
    console.error("❌ Health check failed:", error);
    process.exit(1);
  }
}

// Run the health check
if (require.main === module) {
  main();
}

export { runHealthCheck };
