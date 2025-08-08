/**
 * @file healthCheckScheduler.ts
 * @description Proactive health monitoring with automatic recovery
 * 
 * This scheduler runs continuous health checks and automatically triggers
 * recovery when database authentication issues are detected.
 * 
 * 10x Engineer Features:
 * - Proactive detection of password rotation before user impact
 * - Configurable check intervals based on environment
 * - Integration with monitoring systems
 * - Automatic escalation for persistent failures
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger';
import env from '../config/env';
import { healthCheckWithRecovery } from '../middleware/autoRecovery';
import { databaseService } from '../config/database';

interface HealthCheckJobData {
  checkType: 'database' | 'full';
  triggeredBy: 'scheduler' | 'manual' | 'alert';
}

interface HealthCheckResult {
  timestamp: number;
  status: 'healthy' | 'recovering' | 'unhealthy';
  checks: {
    database: boolean;
    recovery?: {
      status: string;
      attemptCount: number;
      lastAttempt: number;
      cooldownRemaining: number;
      attemptsRemaining: number;
    };
  };
  duration: number;
}

class HealthCheckScheduler {
  private queue: Queue;
  private worker: Worker;
  private redis: Redis;
  
  // Configuration
  private readonly QUEUE_NAME = 'health-check';
  private readonly CHECK_INTERVAL = env.NODE_ENV === 'production' ? 60 * 1000 : 30 * 1000; // 1min prod, 30s dev
  private readonly FAILURE_THRESHOLD = 3; // Escalate after 3 consecutive failures
  private readonly ALERT_COOLDOWN = 15 * 60 * 1000; // 15 minutes between alerts

  private consecutiveFailures = 0;
  private lastAlertTime = 0;

  constructor(redis: Redis) {
    this.redis = redis;
    this.queue = new Queue(this.QUEUE_NAME, { 
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 10, // Keep last 10 results
        removeOnFail: 50, // Keep last 50 failures for debugging
        attempts: 1, // Don't retry health checks
      },
    });

    this.worker = new Worker(
      this.QUEUE_NAME,
      this.processHealthCheck.bind(this),
      { 
        connection: redis,
        concurrency: 1, // Process one at a time
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Start the health check scheduler
   */
  async start(): Promise<void> {
    try {
      // Clear any existing recurring jobs
      await this.queue.obliterate({ force: true });
      
      // Schedule recurring health checks
      await this.queue.add(
        'database-health-check',
        { 
          checkType: 'database',
          triggeredBy: 'scheduler',
        },
        {
          repeat: {
            every: this.CHECK_INTERVAL,
          },
          jobId: 'recurring-health-check', // Prevent duplicates
        }
      );

      logger.info(`[HealthCheckScheduler] Started with ${this.CHECK_INTERVAL}ms interval`);
    } catch (error) {
      logger.error('[HealthCheckScheduler] Failed to start scheduler', { error });
      throw error;
    }
  }

  /**
   * Stop the health check scheduler
   */
  async stop(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    logger.info('[HealthCheckScheduler] Stopped');
  }

  /**
   * Trigger manual health check
   */
  async triggerManualCheck(): Promise<HealthCheckResult> {
    const job = await this.queue.add(
      'manual-health-check',
      {
        checkType: 'full',
        triggeredBy: 'manual',
      },
      {
        priority: 10, // High priority for manual checks
      }
    );

    // Wait for job completion
    const result = await job.waitUntilFinished(this.queue.events);
    return result as HealthCheckResult;
  }

  /**
   * Process health check job
   */
  private async processHealthCheck(job: Job<HealthCheckJobData>): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const { checkType, triggeredBy } = job.data;

    logger.debug(`[HealthCheckScheduler] Running ${checkType} health check (${triggeredBy})`);

    try {
      // Perform health check with automatic recovery
      const healthResult = await healthCheckWithRecovery();
      
      const result: HealthCheckResult = {
        timestamp: startTime,
        status: healthResult.status,
        checks: {
          database: healthResult.database,
          recovery: healthResult.recovery,
        },
        duration: Date.now() - startTime,
      };

      // Handle the result
      await this.handleHealthCheckResult(result, triggeredBy);

      return result;
    } catch (error) {
      logger.error('[HealthCheckScheduler] Health check failed', { error, checkType, triggeredBy });
      
      const result: HealthCheckResult = {
        timestamp: startTime,
        status: 'unhealthy',
        checks: {
          database: false,
        },
        duration: Date.now() - startTime,
      };

      await this.handleHealthCheckResult(result, triggeredBy);
      return result;
    }
  }

  /**
   * Handle health check results and trigger alerts if needed
   */
  private async handleHealthCheckResult(
    result: HealthCheckResult,
    triggeredBy: string
  ): Promise<void> {
    const isHealthy = result.status === 'healthy';
    
    if (isHealthy) {
      // Reset failure counter on successful check
      if (this.consecutiveFailures > 0) {
        logger.info(`[HealthCheckScheduler] Health restored after ${this.consecutiveFailures} failures`);
        this.consecutiveFailures = 0;
      }
    } else {
      this.consecutiveFailures++;
      
      logger.warn(`[HealthCheckScheduler] Health check failed (${this.consecutiveFailures}/${this.FAILURE_THRESHOLD})`, {
        status: result.status,
        database: result.checks.database,
        recovery: result.checks.recovery,
      });

      // Escalate if threshold reached
      if (this.consecutiveFailures >= this.FAILURE_THRESHOLD) {
        await this.escalateHealthIssue(result);
      }
    }

    // Store result for monitoring (optional)
    await this.storeHealthResult(result);
  }

  /**
   * Escalate persistent health issues
   */
  private async escalateHealthIssue(result: HealthCheckResult): Promise<void> {
    const now = Date.now();
    
    // Check alert cooldown
    if (now - this.lastAlertTime < this.ALERT_COOLDOWN) {
      return;
    }

    this.lastAlertTime = now;

    logger.error(`[HealthCheckScheduler] ESCALATION: ${this.consecutiveFailures} consecutive health check failures`, {
      result,
      environment: env.NODE_ENV,
    });

    // Here you could integrate with:
    // - PagerDuty
    // - Slack webhooks  
    // - Email alerts
    // - AWS SNS
    
    // For now, just log the escalation
    if (env.ALERT_WEBHOOK_URL) {
      try {
        // Send webhook alert (implement based on your alerting system)
        logger.info('[HealthCheckScheduler] Alert webhook would be triggered', {
          webhookUrl: env.ALERT_WEBHOOK_URL,
          failures: this.consecutiveFailures,
        });
      } catch (error) {
        logger.error('[HealthCheckScheduler] Failed to send alert', { error });
      }
    }
  }

  /**
   * Store health check result for monitoring
   */
  private async storeHealthResult(result: HealthCheckResult): Promise<void> {
    try {
      const key = `health:results:${Math.floor(result.timestamp / 60000)}`; // Group by minute
      await this.redis.setex(key, 3600, JSON.stringify(result)); // Keep for 1 hour
    } catch (error) {
      logger.warn('[HealthCheckScheduler] Failed to store health result', { error });
    }
  }

  /**
   * Setup event handlers for the worker
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      logger.debug(`[HealthCheckScheduler] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`[HealthCheckScheduler] Job ${job?.id} failed`, { error: err });
    });

    this.worker.on('error', (err) => {
      logger.error('[HealthCheckScheduler] Worker error', { error: err });
    });
  }

  /**
   * Get current health status for API endpoints
   */
  async getCurrentStatus(): Promise<{
    consecutiveFailures: number;
    lastCheck: HealthCheckResult | null;
    nextCheckIn: number;
  }> {
    // Get last result from Redis
    const lastMinute = Math.floor(Date.now() / 60000);
    let lastResult: HealthCheckResult | null = null;
    
    try {
      const stored = await this.redis.get(`health:results:${lastMinute}`);
      if (stored) {
        lastResult = JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('[HealthCheckScheduler] Failed to get last result', { error });
    }

    return {
      consecutiveFailures: this.consecutiveFailures,
      lastCheck: lastResult,
      nextCheckIn: this.CHECK_INTERVAL,
    };
  }
}

// Export for integration with server startup
export { HealthCheckScheduler };

// Auto-register scheduler when imported
let healthCheckScheduler: HealthCheckScheduler | null = null;

export const initializeHealthCheckScheduler = async (redis: Redis): Promise<void> => {
  if (healthCheckScheduler) {
    logger.warn('[HealthCheckScheduler] Scheduler already initialized');
    return;
  }

  healthCheckScheduler = new HealthCheckScheduler(redis);
  await healthCheckScheduler.start();
  
  logger.info('[HealthCheckScheduler] Health monitoring initialized');
};

export const getHealthCheckScheduler = (): HealthCheckScheduler | null => {
  return healthCheckScheduler;
};