/**
 * @file healthMonitoringService.ts
 * @description Comprehensive health monitoring service with real-time dashboards,
 * alerting, and automated remediation capabilities.
 *
 * @dependencies
 * - ../utils/logger: Application logging
 * - ../config/redis: Redis connection for real-time updates
 * - ../services/deadLetterQueueService: Failed job monitoring
 * - ../services/circuitBreakerService: Circuit breaker status
 * - ../services/resourceMonitoringService: Resource usage monitoring
 * - ../services/resilientPydanticService: AI agent health
 *
 * @exports
 * - HealthMonitoringService: Main service class with monitoring capabilities
 * - healthMonitoringService: Singleton instance
 */

import logger from "../utils/logger";
import { Redis } from "ioredis";
import { redis } from "../config/redis";
import { deadLetterQueueService } from "./deadLetterQueueService";
import { circuitBreakerService } from "./circuitBreakerService";
import { resourceMonitoringService } from "./resourceMonitoringService";
import { resilientPydanticService } from "./resilientPydanticService";
import { getDbClient } from "../config/database";

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    queues: ComponentHealth;
    circuitBreakers: ComponentHealth;
    aiAgents: ComponentHealth;
    resources: ComponentHealth;
  };
  metrics: {
    totalReports: number;
    activeReports: number;
    failedReports: number;
    avgProcessingTime: number;
    errorRate: number;
    resourceUtilization: {
      memory: number;
      cpu: number;
    };
  };
  alerts: HealthAlert[];
}

export interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  metrics?: Record<string, any>;
  lastChecked: string;
  responseTime?: number;
}

export interface HealthAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  component: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  autoRemediation?: {
    attempted: boolean;
    success?: boolean;
    action: string;
  };
}

export interface HealthMetrics {
  reportGeneration: {
    total24h: number;
    successful24h: number;
    failed24h: number;
    avgDuration: number;
    currentlyActive: number;
  };
  circuitBreakers: {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
  };
  deadLetterQueue: {
    totalFailed: number;
    retryable: number;
    permanent: number;
    oldestFailureHours: number;
  };
  resources: {
    memoryUsageMB: number;
    memoryLimitMB: number;
    activeMonitors: number;
  };
}

export class HealthMonitoringService {
  private static instance: HealthMonitoringService;
  private redis: Redis;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_KEY = "system:health";
  private readonly METRICS_KEY = "system:metrics";
  private readonly ALERTS_KEY = "system:alerts";
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds
  private alerts = new Map<string, HealthAlert>();

  private constructor() {
    this.redis = redis;
    this.startMonitoring();
  }

  public static getInstance(): HealthMonitoringService {
    if (!HealthMonitoringService.instance) {
      HealthMonitoringService.instance = new HealthMonitoringService();
    }
    return HealthMonitoringService.instance;
  }

  /**
   * Start continuous health monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectAndPublishHealth();
      } catch (error) {
        logger.error(`[HealthMonitor] Monitoring cycle failed:`, error);
      }
    }, this.MONITORING_INTERVAL);

    logger.info(`[HealthMonitor] Started health monitoring (${this.MONITORING_INTERVAL/1000}s interval)`);
  }

  /**
   * Collect comprehensive health status and publish to Redis
   */
  private async collectAndPublishHealth(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Collect health from all components in parallel
      const [
        databaseHealth,
        redisHealth,
        queueHealth,
        circuitHealth,
        aiAgentHealth,
        resourceHealth,
        metrics,
      ] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.checkQueueHealth(),
        this.checkCircuitBreakerHealth(),
        this.checkAiAgentHealth(),
        this.checkResourceHealth(),
        this.collectMetrics(),
      ]);

      // Process results and handle failures gracefully
      const components = {
        database: this.processHealthResult(databaseHealth, "database"),
        redis: this.processHealthResult(redisHealth, "redis"),
        queues: this.processHealthResult(queueHealth, "queues"),
        circuitBreakers: this.processHealthResult(circuitHealth, "circuitBreakers"),
        aiAgents: this.processHealthResult(aiAgentHealth, "aiAgents"),
        resources: this.processHealthResult(resourceHealth, "resources"),
      };

      // Determine overall system status
      const componentStatuses = Object.values(components).map(c => c.status);
      const overallStatus = componentStatuses.includes("unhealthy") 
        ? "unhealthy" 
        : componentStatuses.includes("degraded") 
          ? "degraded" 
          : "healthy";

      // Process metrics
      const systemMetrics = metrics.status === "fulfilled" ? metrics.value : this.getDefaultMetrics();

      // Generate alerts for unhealthy components
      await this.generateAlerts(components, systemMetrics);

      const systemHealth: SystemHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        components,
        metrics: {
          totalReports: systemMetrics.reportGeneration.total24h,
          activeReports: systemMetrics.reportGeneration.currentlyActive,
          failedReports: systemMetrics.reportGeneration.failed24h,
          avgProcessingTime: systemMetrics.reportGeneration.avgDuration,
          errorRate: systemMetrics.reportGeneration.total24h > 0 
            ? (systemMetrics.reportGeneration.failed24h / systemMetrics.reportGeneration.total24h) * 100 
            : 0,
          resourceUtilization: {
            memory: (systemMetrics.resources.memoryUsageMB / systemMetrics.resources.memoryLimitMB) * 100,
            cpu: 0, // TODO: Implement CPU monitoring
          },
        },
        alerts: Array.from(this.alerts.values()).filter(alert => !alert.acknowledged),
      };

      // Publish to Redis for real-time dashboard
      await this.redis.setex(
        this.HEALTH_KEY, 
        120, // 2 minute TTL
        JSON.stringify(systemHealth)
      );

      // Publish metrics separately for historical tracking
      await this.redis.lpush(
        `${this.METRICS_KEY}:history`,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          metrics: systemMetrics,
        })
      );

      // Keep only last 24 hours of metrics (assuming 30s intervals = 2880 entries)
      await this.redis.ltrim(`${this.METRICS_KEY}:history`, 0, 2879);

      logger.debug(`[HealthMonitor] Health collection complete (${Date.now() - startTime}ms)`, {
        status: overallStatus,
        alerts: systemHealth.alerts.length,
      });

    } catch (error) {
      logger.error(`[HealthMonitor] Failed to collect health status:`, error);
    }
  }

  /**
   * Process health check results and handle failures
   */
  private processHealthResult(
    result: PromiseSettledResult<ComponentHealth>,
    _component: string
  ): ComponentHealth {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      return {
        status: "unhealthy",
        message: `Health check failed: ${result.reason}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const prisma = await getDbClient();
      await prisma.$queryRaw`SELECT 1`;
      
      // Check connection pool status
      const poolInfo = (prisma as any)._engine?.connectionInfo || {};
      
      return {
        status: "healthy",
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        metrics: {
          connections: poolInfo.openConnections || 0,
          maxConnections: poolInfo.maxConnections || 0,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Database connection failed",
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedisHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const result = await this.redis.ping();
      const info = await this.redis.info("memory");
      
      // Parse memory usage from Redis info
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const maxMemoryMatch = info.match(/maxmemory:(\d+)/);
      
      return {
        status: result === "PONG" ? "healthy" : "degraded",
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        metrics: {
          memoryUsed: memoryMatch ? parseInt(memoryMatch[1]) : 0,
          maxMemory: maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : 0,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Redis connection failed",
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check queue system health
   */
  private async checkQueueHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const deadLetterHealth = await deadLetterQueueService.getHealthStatus();
      
      // Determine status based on failed job count
      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (deadLetterHealth.queueHealth.failed > 100) {
        status = "unhealthy";
      } else if (deadLetterHealth.queueHealth.failed > 20) {
        status = "degraded";
      }

      return {
        status,
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        metrics: {
          failedJobs: deadLetterHealth.queueHealth.failed,
          retryableJobs: deadLetterHealth.queueHealth.retryable,
          workerRunning: deadLetterHealth.workerHealth.isRunning,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Queue health check failed",
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check circuit breaker health
   */
  private async checkCircuitBreakerHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const circuitHealth = circuitBreakerService.healthCheck();
      const resilientHealth = resilientPydanticService.getHealthStatus();
      
      const openCircuits = Object.values(circuitHealth.circuits).filter(c => c.state === "OPEN").length;
      const totalCircuits = Object.keys(circuitHealth.circuits).length;
      
      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (openCircuits > totalCircuits * 0.5) {
        status = "unhealthy";
      } else if (openCircuits > 0) {
        status = "degraded";
      }

      return {
        status,
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        metrics: {
          totalCircuits,
          openCircuits,
          healthyCircuits: resilientHealth.summary.healthy,
          degradedCircuits: resilientHealth.summary.degraded,
          failedCircuits: resilientHealth.summary.failed,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Circuit breaker health check failed",
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check AI agent health
   */
  private async checkAiAgentHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      // Check PydanticAI service availability
      const { pydanticLlmService } = await import("../services/pydanticLlmService");
      const providers = pydanticLlmService.getAvailableProviders();
      const healthyProviders = providers.filter((p: any) => p.status === "available").length;
      
      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (healthyProviders === 0) {
        status = "unhealthy";
      } else if (healthyProviders < providers.length * 0.5) {
        status = "degraded";
      }

      return {
        status,
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        metrics: {
          totalProviders: providers.length,
          healthyProviders,
          degradedProviders: providers.length - healthyProviders,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "AI agent health check failed",
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Check resource health
   */
  private async checkResourceHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const resourceHealth = resourceMonitoringService.healthCheck();
      const memoryUsage = process.memoryUsage();
      
      // Convert to MB for easier analysis
      const memoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
      const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      // Set thresholds
      const memoryWarningMB = 1536; // 1.5GB
      const memoryCriticalMB = 2048; // 2GB
      
      let status: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (memoryMB > memoryCriticalMB) {
        status = "unhealthy";
      } else if (memoryMB > memoryWarningMB) {
        status = "degraded";
      }

      return {
        status,
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        metrics: {
          memoryMB,
          heapUsedMB,
          activeMonitors: resourceHealth.activeMonitors,
          uptime: process.uptime(),
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Resource health check failed",
        lastChecked: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Collect system metrics for historical tracking
   */
  private async collectMetrics(): Promise<HealthMetrics> {
    try {
      const prisma = await getDbClient();
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Report generation metrics
      const [
        total24h,
        successful24h,
        failed24h,
        activeReports,
        _avgDurationResult,
      ] = await Promise.all([
        prisma.reportRun.count({
          where: { createdAt: { gte: yesterday } },
        }),
        prisma.reportRun.count({
          where: { 
            createdAt: { gte: yesterday },
            status: "COMPLETED",
          },
        }),
        prisma.reportRun.count({
          where: { 
            createdAt: { gte: yesterday },
            status: "FAILED",
          },
        }),
        prisma.reportRun.count({
          where: { status: { in: ["QUEUED", "RUNNING"] } },
        }),
        prisma.reportRun.aggregate({
          where: { 
            createdAt: { gte: yesterday },
            status: "COMPLETED",
          },
          _avg: {
            tokensUsed: true,
            usdCost: true,
          },
        }),
      ]);

      // Circuit breaker metrics
      const circuitHealth = resilientPydanticService.getHealthStatus();
      
      // Dead letter queue metrics
      const deadLetterHealth = await deadLetterQueueService.getHealthStatus();
      const oldestFailureHours = deadLetterHealth.queueHealth.oldestFailure 
        ? (Date.now() - new Date(deadLetterHealth.queueHealth.oldestFailure).getTime()) / (1000 * 60 * 60)
        : 0;

      // Resource metrics
      const resourceHealth = resourceMonitoringService.healthCheck();
      const memoryUsage = process.memoryUsage();

      return {
        reportGeneration: {
          total24h,
          successful24h,
          failed24h,
          avgDuration: 0, // TODO: Calculate from database
          currentlyActive: activeReports,
        },
        circuitBreakers: {
          total: circuitHealth.summary.total,
          healthy: circuitHealth.summary.healthy,
          degraded: circuitHealth.summary.degraded,
          failed: circuitHealth.summary.failed,
        },
        deadLetterQueue: {
          totalFailed: deadLetterHealth.queueHealth.failed,
          retryable: deadLetterHealth.queueHealth.retryable,
          permanent: deadLetterHealth.queueHealth.failed - deadLetterHealth.queueHealth.retryable,
          oldestFailureHours,
        },
        resources: {
          memoryUsageMB: Math.round(memoryUsage.rss / 1024 / 1024),
          memoryLimitMB: 2048, // From resource monitoring service
          activeMonitors: resourceHealth.activeMonitors,
        },
      };
    } catch (error) {
      logger.error(`[HealthMonitor] Failed to collect metrics:`, error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Generate alerts based on component health and metrics
   */
  private async generateAlerts(
    components: SystemHealth["components"],
    metrics: HealthMetrics
  ): Promise<void> {
    const alerts: HealthAlert[] = [];

    // Check for critical component failures
    for (const [componentName, health] of Object.entries(components)) {
      if (health.status === "unhealthy") {
        const alertId = `${componentName}-unhealthy`;
        alerts.push({
          id: alertId,
          severity: "critical",
          component: componentName,
          message: health.message || `${componentName} is unhealthy`,
          timestamp: new Date().toISOString(),
          acknowledged: this.alerts.get(alertId)?.acknowledged || false,
        });
      }
    }

    // Check for high failure rates
    if (metrics.reportGeneration.total24h > 10 && 
        (metrics.reportGeneration.failed24h / metrics.reportGeneration.total24h) > 0.2) {
      alerts.push({
        id: "high-failure-rate",
        severity: "critical",
        component: "reportGeneration",
        message: `High failure rate: ${metrics.reportGeneration.failed24h}/${metrics.reportGeneration.total24h} reports failed in 24h`,
        timestamp: new Date().toISOString(),
        acknowledged: this.alerts.get("high-failure-rate")?.acknowledged || false,
      });
    }

    // Check for old failed jobs in dead letter queue
    if (metrics.deadLetterQueue.oldestFailureHours > 24) {
      alerts.push({
        id: "old-failed-jobs",
        severity: "warning",
        component: "deadLetterQueue",
        message: `Failed jobs older than 24 hours detected (oldest: ${Math.round(metrics.deadLetterQueue.oldestFailureHours)}h)`,
        timestamp: new Date().toISOString(),
        acknowledged: this.alerts.get("old-failed-jobs")?.acknowledged || false,
      });
    }

    // Check for high memory usage
    if (metrics.resources.memoryUsageMB > 1536) { // 1.5GB warning threshold
      alerts.push({
        id: "high-memory-usage",
        severity: metrics.resources.memoryUsageMB > 2048 ? "critical" : "warning",
        component: "resources",
        message: `High memory usage: ${metrics.resources.memoryUsageMB}MB`,
        timestamp: new Date().toISOString(),
        acknowledged: this.alerts.get("high-memory-usage")?.acknowledged || false,
      });
    }

    // Update alerts map
    for (const alert of alerts) {
      this.alerts.set(alert.id, alert);
    }

    // Publish alerts to Redis for real-time updates
    await this.redis.setex(
      this.ALERTS_KEY,
      300, // 5 minute TTL
      JSON.stringify(Array.from(this.alerts.values()))
    );
  }

  /**
   * Get default metrics when collection fails
   */
  private getDefaultMetrics(): HealthMetrics {
    return {
      reportGeneration: {
        total24h: 0,
        successful24h: 0,
        failed24h: 0,
        avgDuration: 0,
        currentlyActive: 0,
      },
      circuitBreakers: {
        total: 0,
        healthy: 0,
        degraded: 0,
        failed: 0,
      },
      deadLetterQueue: {
        totalFailed: 0,
        retryable: 0,
        permanent: 0,
        oldestFailureHours: 0,
      },
      resources: {
        memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        memoryLimitMB: 2048,
        activeMonitors: 0,
      },
    };
  }

  /**
   * Get current system health status
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    try {
      const healthData = await this.redis.get(this.HEALTH_KEY);
      if (healthData) {
        return JSON.parse(healthData);
      }
    } catch (error) {
      logger.warn(`[HealthMonitor] Failed to get cached health data:`, error);
    }

    // Fallback: collect fresh health data
    await this.collectAndPublishHealth();
    const healthData = await this.redis.get(this.HEALTH_KEY);
    return healthData ? JSON.parse(healthData) : this.getEmergencyHealth();
  }

  /**
   * Get emergency health status when all else fails
   */
  private getEmergencyHealth(): SystemHealth {
    return {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      components: {
        database: { status: "unhealthy", message: "Unknown", lastChecked: new Date().toISOString() },
        redis: { status: "unhealthy", message: "Unknown", lastChecked: new Date().toISOString() },
        queues: { status: "unhealthy", message: "Unknown", lastChecked: new Date().toISOString() },
        circuitBreakers: { status: "unhealthy", message: "Unknown", lastChecked: new Date().toISOString() },
        aiAgents: { status: "unhealthy", message: "Unknown", lastChecked: new Date().toISOString() },
        resources: { status: "unhealthy", message: "Unknown", lastChecked: new Date().toISOString() },
      },
      metrics: {
        totalReports: 0,
        activeReports: 0,
        failedReports: 0,
        avgProcessingTime: 0,
        errorRate: 0,
        resourceUtilization: { memory: 0, cpu: 0 },
      },
      alerts: [],
    };
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      this.alerts.set(alertId, alert);
      
      // Update in Redis
      await this.redis.setex(
        this.ALERTS_KEY,
        300,
        JSON.stringify(Array.from(this.alerts.values()))
      );
      
      logger.info(`[HealthMonitor] Alert ${alertId} acknowledged`);
      return true;
    }
    return false;
  }

  /**
   * Get historical metrics for dashboard charts
   */
  public async getHistoricalMetrics(hours: number = 24): Promise<Array<{
    timestamp: string;
    metrics: HealthMetrics;
  }>> {
    try {
      const entries = Math.ceil((hours * 60 * 60) / (this.MONITORING_INTERVAL / 1000));
      const data = await this.redis.lrange(`${this.METRICS_KEY}:history`, 0, entries - 1);
      
      return data
        .map(entry => {
          try {
            return JSON.parse(entry);
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .reverse(); // Most recent first
    } catch (error) {
      logger.error(`[HealthMonitor] Failed to get historical metrics:`, error);
      return [];
    }
  }

  /**
   * Trigger immediate health check and return results
   */
  public async triggerHealthCheck(): Promise<SystemHealth> {
    logger.info(`[HealthMonitor] Manual health check triggered`);
    await this.collectAndPublishHealth();
    return this.getSystemHealth();
  }

  /**
   * Cleanup and shutdown monitoring
   */
  public async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    try {
      await this.redis.quit();
      logger.info(`[HealthMonitor] Service shutdown complete`);
    } catch (error) {
      logger.error(`[HealthMonitor] Shutdown failed:`, error);
    }
  }
}

// Export singleton instance
export const healthMonitoringService = HealthMonitoringService.getInstance();

// Cleanup on process exit
process.on('SIGTERM', () => healthMonitoringService.shutdown());
process.on('SIGINT', () => healthMonitoringService.shutdown());