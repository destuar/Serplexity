/**
 * @file deadLetterQueueService.ts
 * @description Dead letter queue implementation for failed job recovery with intelligent
 * retry logic and manual recovery UI support.
 *
 * @dependencies
 * - bullmq: Queue management
 * - ../utils/logger: Application logging
 * - ../config/redis: Redis connection
 *
 * @exports
 * - DeadLetterQueueService: Main service class with recovery operations
 * - deadLetterQueueService: Singleton instance
 */

import { Queue, Job, Worker } from "bullmq";
import logger from "../utils/logger";
import { getBullMQOptions } from "../config/bullmq";
import { getDbClient } from "../config/database";

export interface FailedJobData {
  id: string;
  name: string;
  data: any;
  failedAt: Date;
  error: string;
  stack?: string;
  attemptsMade: number;
  maxAttempts: number;
  runId: string;
  companyId: string;
  companyName: string;
  classification: FailureClassification;
  canRetry: boolean;
  nextRetryAt?: Date;
  metadata: {
    originalQueue: string;
    failureType: string;
    errorCode?: string;
    duration: number;
    resourcesUsed?: {
      memoryMB: number;
      executionTimeMs: number;
    };
  };
}

export enum FailureClassification {
  TRANSIENT = "transient",           // Temporary failure - safe to retry
  RESOURCE = "resource",             // Resource exhaustion - retry with limits
  CONFIGURATION = "configuration",   // Config/env issue - needs manual fix
  PERMANENT = "permanent",           // Logic error - no retry
  CIRCUIT_OPEN = "circuit_open",     // Circuit breaker protection
  TIMEOUT = "timeout",               // Execution timeout
  DEPENDENCY = "dependency",         // External service failure
}

export interface RecoveryStats {
  totalFailed: number;
  byClassification: Record<FailureClassification, number>;
  retryable: number;
  awaitingManualReview: number;
  oldestFailure?: Date;
  averageFailureAge: number;
  successfulRecoveries: number;
  permanentFailures: number;
}

export class DeadLetterQueueService {
  private static instance: DeadLetterQueueService;
  private deadLetterQueue!: Queue;
  private recoveryWorker!: Worker;
  private readonly QUEUE_NAME = "dead-letter-reports";
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private readonly CLASSIFICATION_KEYWORDS = {
    [FailureClassification.TRANSIENT]: [
      "timeout", "network", "connection", "temporary", "rate limit", "503", "502", "504"
    ],
    [FailureClassification.RESOURCE]: [
      "memory", "cpu", "disk", "resource", "limit exceeded", "out of memory", "heap"
    ],
    [FailureClassification.CONFIGURATION]: [
      "config", "environment", "missing", "not found", "invalid", "unauthorized", "401", "403"
    ],
    [FailureClassification.CIRCUIT_OPEN]: [
      "circuit breaker", "circuit open", "service unavailable", "degraded"
    ],
    [FailureClassification.TIMEOUT]: [
      "timeout", "timed out", "deadline", "cancelled"
    ],
    [FailureClassification.DEPENDENCY]: [
      "python", "pydantic", "external", "api", "service", "provider"
    ],
  };

  private constructor() {
    this.initializeQueues();
  }

  public static getInstance(): DeadLetterQueueService {
    if (!DeadLetterQueueService.instance) {
      DeadLetterQueueService.instance = new DeadLetterQueueService();
    }
    return DeadLetterQueueService.instance;
  }

  /**
   * Initialize dead letter queue and recovery worker
   */
  private initializeQueues(): void {
    this.deadLetterQueue = new Queue(this.QUEUE_NAME, getBullMQOptions());
    
    // Recovery worker processes retryable failed jobs
    this.recoveryWorker = new Worker(
      this.QUEUE_NAME,
      async (job: Job) => {
        return this.processRecoveryJob(job);
      },
      {
        ...getBullMQOptions(),
        concurrency: 2, // Conservative concurrency for recovery
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
        stalledInterval: 30000,
        maxStalledCount: 1,
      }
    );

    this.recoveryWorker.on("completed", (job: Job) => {
      logger.info(`[DeadLetter] Recovery job ${job.id} completed successfully`);
    });

    this.recoveryWorker.on("failed", (job: Job | undefined, err: Error) => {
      logger.error(`[DeadLetter] Recovery job ${job?.id} failed:`, err);
    });

    logger.info(`[DeadLetter] Dead letter queue service initialized`);
  }

  /**
   * Classify failure based on error message and context
   */
  public classifyFailure(error: Error, jobData: any, attempts: number): FailureClassification {
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || "";
    const fullText = `${errorMessage} ${errorStack}`;

    // Check for specific patterns in order of specificity
    for (const [classification, keywords] of Object.entries(this.CLASSIFICATION_KEYWORDS)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        return classification as FailureClassification;
      }
    }

    // Logic-based classification
    if (attempts >= 3) {
      // Multiple failures suggest permanent issue
      return FailureClassification.PERMANENT;
    }

    // Default to transient for unknown errors (conservative retry)
    return FailureClassification.TRANSIENT;
  }

  /**
   * Add failed job to dead letter queue with intelligent classification
   */
  public async addFailedJob(
    originalJob: Job,
    error: Error,
    classification?: FailureClassification
  ): Promise<void> {
    const failedAt = new Date();
    const attemptsMade = originalJob.attemptsMade || 0;
    const maxAttempts = originalJob.opts?.attempts || 3;
    
    // Auto-classify if not provided
    const finalClassification = classification || this.classifyFailure(error, originalJob.data, attemptsMade);
    
    // Determine if job can be retried
    const canRetry = this.canJobBeRetried(finalClassification, attemptsMade, maxAttempts);
    
    // Calculate next retry time with exponential backoff
    const nextRetryAt = canRetry ? this.calculateNextRetryTime(attemptsMade, finalClassification) : undefined;

    const failedJobData: FailedJobData = {
      id: originalJob.id || `failed-${Date.now()}`,
      name: originalJob.name || "unknown",
      data: originalJob.data,
      failedAt,
      error: error.message,
      stack: error.stack,
      attemptsMade,
      maxAttempts,
      runId: originalJob.data?.runId || "unknown",
      companyId: originalJob.data?.company?.id || "unknown",
      companyName: originalJob.data?.company?.name || "unknown",
      classification: finalClassification,
      canRetry,
      nextRetryAt,
      metadata: {
        originalQueue: originalJob.queueName || "report-generation",
        failureType: error.constructor.name,
        errorCode: (error as any).code,
        duration: Date.now() - originalJob.timestamp,
        resourcesUsed: (originalJob as any).resourcesUsed,
      },
    };

    // Store in dead letter queue
    await this.deadLetterQueue.add(
      "failed-job",
      failedJobData,
      {
        delay: canRetry && nextRetryAt ? nextRetryAt.getTime() - Date.now() : undefined,
        removeOnComplete: false, // Keep for audit trail
        removeOnFail: false,
        attempts: canRetry ? this.MAX_RECOVERY_ATTEMPTS : 1,
        backoff: {
          type: "exponential",
          delay: 30000, // 30 seconds base delay
        },
      }
    );

    // Update report status to reflect failure
    try {
      const prisma = await getDbClient();
      await prisma.reportRun.update({
        where: { id: failedJobData.runId },
        data: {
          status: "FAILED",
          stepStatus: `Failed: ${error.message} (DLQ: ${failedJobData.id})`,
        },
      });
    } catch (dbError) {
      logger.error(`[DeadLetter] Failed to update report status:`, dbError);
    }

    logger.warn(`[DeadLetter] Job ${originalJob.id} added to dead letter queue`, {
      classification: finalClassification,
      canRetry,
      nextRetryAt: nextRetryAt?.toISOString(),
      company: failedJobData.companyName,
    });
  }

  /**
   * Determine if job can be retried based on classification and attempts
   */
  private canJobBeRetried(
    classification: FailureClassification,
    attemptsMade: number,
    maxAttempts: number
  ): boolean {
    // Never retry permanent failures
    if (classification === FailureClassification.PERMANENT) {
      return false;
    }

    // Don't retry if already exceeded max attempts
    if (attemptsMade >= maxAttempts) {
      return false;
    }

    // Configuration issues need manual intervention
    if (classification === FailureClassification.CONFIGURATION) {
      return false;
    }

    // Other failures can be retried
    return true;
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetryTime(attempts: number, classification: FailureClassification): Date {
    let baseDelay: number;

    // Different base delays for different failure types
    switch (classification) {
      case FailureClassification.TRANSIENT:
        baseDelay = 60000; // 1 minute
        break;
      case FailureClassification.RESOURCE:
        baseDelay = 300000; // 5 minutes
        break;
      case FailureClassification.CIRCUIT_OPEN:
        baseDelay = 120000; // 2 minutes
        break;
      case FailureClassification.TIMEOUT:
        baseDelay = 180000; // 3 minutes
        break;
      case FailureClassification.DEPENDENCY:
        baseDelay = 240000; // 4 minutes
        break;
      default:
        baseDelay = 300000; // 5 minutes
    }

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, Math.min(attempts, 5));
    const jitter = Math.random() * 0.2 * exponentialDelay; // ±20% jitter
    const finalDelay = exponentialDelay + jitter;

    return new Date(Date.now() + finalDelay);
  }

  /**
   * Process recovery job - retry failed report generation
   */
  private async processRecoveryJob(job: Job): Promise<void> {
    const failedJobData: FailedJobData = job.data;
    
    logger.info(`[DeadLetter] Processing recovery for job ${failedJobData.id}`, {
      classification: failedJobData.classification,
      attemptsMade: failedJobData.attemptsMade,
      company: failedJobData.companyName,
    });

    try {
      // Import the original queue to retry the job
      const originalQueue = new Queue(failedJobData.metadata.originalQueue, getBullMQOptions());
      
      // Add job back to original queue with updated configuration
      const retryJob = await originalQueue.add(
        failedJobData.name,
        failedJobData.data,
        {
          attempts: Math.max(1, failedJobData.maxAttempts - failedJobData.attemptsMade),
          backoff: {
            type: "exponential",
            delay: 60000, // 1 minute base delay
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
          // Add metadata to track this is a recovery attempt
          jobId: `recovery-${failedJobData.id}-${Date.now()}`,
        }
      );

      // Update report status to reflect retry attempt
      try {
        const prisma = await getDbClient();
        await prisma.reportRun.update({
          where: { id: failedJobData.runId },
          data: {
            status: "QUEUED",
            stepStatus: `Retrying after failure recovery (Job: ${retryJob.id})`,
          },
        });
      } catch (dbError) {
        logger.error(`[DeadLetter] Failed to update report status during recovery:`, dbError);
      }

      await originalQueue.close();
      
      logger.info(`[DeadLetter] Successfully queued recovery job ${retryJob.id} for ${failedJobData.companyName}`);
      
    } catch (error) {
      logger.error(`[DeadLetter] Recovery failed for job ${failedJobData.id}:`, error);
      
      // Mark as permanent failure after recovery attempts fail
      try {
        const prisma = await getDbClient();
        await prisma.reportRun.update({
          where: { id: failedJobData.runId },
          data: {
            status: "FAILED",
            stepStatus: `Recovery failed - manual intervention required: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      } catch (dbError) {
        logger.error(`[DeadLetter] Failed to update report status after recovery failure:`, dbError);
      }

      throw error;
    }
  }

  /**
   * Get all failed jobs with filtering and pagination
   */
  public async getFailedJobs(options: {
    classification?: FailureClassification;
    companyId?: string;
    canRetry?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: "failedAt" | "company" | "classification";
    sortOrder?: "asc" | "desc";
  } = {}): Promise<{
    jobs: FailedJobData[];
    total: number;
    stats: RecoveryStats;
  }> {
    const {
      classification,
      companyId,
      canRetry,
      limit = 50,
      offset = 0,
      sortBy = "failedAt",
      sortOrder = "desc",
    } = options;

    // Get all failed jobs from dead letter queue
    const allFailedJobs = await this.deadLetterQueue.getJobs(["failed", "waiting"], 0, -1);
    
    // Filter jobs based on criteria
    const filteredJobs = allFailedJobs
      .map(job => job.data as FailedJobData)
      .filter(jobData => {
        if (classification && jobData.classification !== classification) return false;
        if (companyId && jobData.companyId !== companyId) return false;
        if (canRetry !== undefined && jobData.canRetry !== canRetry) return false;
        return true;
      });

    // Sort jobs
    filteredJobs.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "failedAt":
          comparison = a.failedAt.getTime() - b.failedAt.getTime();
          break;
        case "company":
          comparison = a.companyName.localeCompare(b.companyName);
          break;
        case "classification":
          comparison = a.classification.localeCompare(b.classification);
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    // Calculate statistics
    const stats = this.calculateRecoveryStats(filteredJobs);

    // Apply pagination
    const paginatedJobs = filteredJobs.slice(offset, offset + limit);

    return {
      jobs: paginatedJobs,
      total: filteredJobs.length,
      stats,
    };
  }

  /**
   * Calculate recovery statistics
   */
  private calculateRecoveryStats(jobs: FailedJobData[]): RecoveryStats {
    const byClassification = {} as Record<FailureClassification, number>;
    
    // Initialize all classifications
    Object.values(FailureClassification).forEach(classification => {
      byClassification[classification] = 0;
    });

    let retryable = 0;
    let awaitingManualReview = 0;
    let oldestFailure: Date | undefined;
    let totalAge = 0;
    const successfulRecoveries = 0;
    let permanentFailures = 0;

    for (const job of jobs) {
      byClassification[job.classification]++;
      
      if (job.canRetry) {
        retryable++;
      } else {
        awaitingManualReview++;
      }

      if (job.classification === FailureClassification.PERMANENT) {
        permanentFailures++;
      }

      const age = Date.now() - job.failedAt.getTime();
      totalAge += age;

      if (!oldestFailure || job.failedAt < oldestFailure) {
        oldestFailure = job.failedAt;
      }
    }

    return {
      totalFailed: jobs.length,
      byClassification,
      retryable,
      awaitingManualReview,
      oldestFailure,
      averageFailureAge: jobs.length > 0 ? totalAge / jobs.length : 0,
      successfulRecoveries,
      permanentFailures,
    };
  }

  /**
   * Manually retry a specific failed job
   */
  public async retryJob(jobId: string, options: {
    priority?: number;
    delay?: number;
    forceRetry?: boolean;
  } = {}): Promise<{ success: boolean; newJobId?: string; error?: string }> {
    try {
      // Find the failed job
      const failedJobs = await this.deadLetterQueue.getJobs(["failed", "waiting"], 0, -1);
      const targetJob = failedJobs.find(job => (job.data as FailedJobData).id === jobId);

      if (!targetJob) {
        return { success: false, error: "Job not found in dead letter queue" };
      }

      const failedJobData: FailedJobData = targetJob.data;

      // Check if job can be retried
      if (!failedJobData.canRetry && !options.forceRetry) {
        return { 
          success: false, 
          error: `Job cannot be retried (classification: ${failedJobData.classification})` 
        };
      }

      // Add back to original queue
      const originalQueue = new Queue(failedJobData.metadata.originalQueue, getBullMQOptions());
      
      const retryJob = await originalQueue.add(
        failedJobData.name,
        failedJobData.data,
        {
          priority: options.priority || 10, // Higher priority for manual retries
          delay: options.delay || 0,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 30000,
          },
          jobId: `manual-retry-${jobId}-${Date.now()}`,
        }
      );

      // Update report status
      try {
        const prisma = await getDbClient();
        await prisma.reportRun.update({
          where: { id: failedJobData.runId },
          data: {
            status: "QUEUED",
            stepStatus: `Manual retry initiated (Job: ${retryJob.id})`,
          },
        });
      } catch (dbError) {
        logger.error(`[DeadLetter] Failed to update report status during manual retry:`, dbError);
      }

      // Remove from dead letter queue
      await targetJob.remove();
      await originalQueue.close();

      logger.info(`[DeadLetter] Manual retry initiated for job ${jobId} → ${retryJob.id}`);
      
      return { success: true, newJobId: retryJob.id };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[DeadLetter] Manual retry failed for job ${jobId}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Bulk retry jobs by classification or criteria
   */
  public async bulkRetryJobs(criteria: {
    classification?: FailureClassification;
    companyId?: string;
    olderThan?: Date;
    maxJobs?: number;
  }): Promise<{
    attempted: number;
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const { classification, companyId, olderThan, maxJobs = 50 } = criteria;
    
    const failedJobs = await this.getFailedJobs({
      classification,
      companyId,
      canRetry: true,
      limit: maxJobs,
    });

    let attempted = 0;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const jobData of failedJobs.jobs) {
      // Check age filter
      if (olderThan && jobData.failedAt > olderThan) {
        continue;
      }

      attempted++;
      const result = await this.retryJob(jobData.id);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
        errors.push(`Job ${jobData.id}: ${result.error}`);
      }
    }

    logger.info(`[DeadLetter] Bulk retry complete`, {
      attempted,
      successful,
      failed,
      criteria,
    });

    return { attempted, successful, failed, errors };
  }

  /**
   * Permanently mark jobs as non-retryable
   */
  public async markAsPermanentFailure(jobIds: string[], reason: string): Promise<void> {
    for (const jobId of jobIds) {
      try {
        const failedJobs = await this.deadLetterQueue.getJobs(["failed", "waiting"], 0, -1);
        const targetJob = failedJobs.find(job => (job.data as FailedJobData).id === jobId);

        if (targetJob) {
          const jobData: FailedJobData = {
            ...targetJob.data,
            classification: FailureClassification.PERMANENT,
            canRetry: false,
            metadata: {
              ...targetJob.data.metadata,
              markedPermanent: true,
              permanentReason: reason,
              markedAt: new Date().toISOString(),
            },
          };

          // Update the job data
          await targetJob.update(jobData);
          
          logger.info(`[DeadLetter] Job ${jobId} marked as permanent failure: ${reason}`);
        }
      } catch (error) {
        logger.error(`[DeadLetter] Failed to mark job ${jobId} as permanent:`, error);
      }
    }
  }

  /**
   * Get health status of dead letter queue
   */
  public async getHealthStatus(): Promise<{
    status: string;
    queueHealth: {
      failed: number;
      waiting: number;
      retryable: number;
      oldestFailure?: string;
    };
    workerHealth: {
      isRunning: boolean;
      processed: number;
      failed: number;
    };
  }> {
    try {
      const failedJobs = await this.deadLetterQueue.getJobs(["failed"], 0, 100);
      const waitingJobs = await this.deadLetterQueue.getJobs(["waiting"], 0, 100);
      
      const retryableCount = [...failedJobs, ...waitingJobs]
        .map(job => job.data as FailedJobData)
        .filter(jobData => jobData.canRetry).length;

      const oldestFailedJob = failedJobs
        .map(job => job.data as FailedJobData)
        .sort((a, b) => a.failedAt.getTime() - b.failedAt.getTime())[0];

      // Worker metrics not available, use queue metrics instead

      const status = failedJobs.length > 50 ? "degraded" : "healthy";

      return {
        status,
        queueHealth: {
          failed: failedJobs.length,
          waiting: waitingJobs.length,
          retryable: retryableCount,
          oldestFailure: oldestFailedJob?.failedAt.toISOString(),
        },
        workerHealth: {
          isRunning: this.recoveryWorker.isRunning(),
          processed: 0, // Metrics not available
          failed: 0, // Metrics not available
        },
      };
    } catch (error) {
      logger.error(`[DeadLetter] Health check failed:`, error);
      return {
        status: "unhealthy",
        queueHealth: { failed: 0, waiting: 0, retryable: 0 },
        workerHealth: { isRunning: false, processed: 0, failed: 0 },
      };
    }
  }

  /**
   * Cleanup old completed/failed recovery jobs
   */
  public async cleanup(olderThanDays: number = 30): Promise<{ removed: number }> {
    const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    try {
      const completedJobs = await this.deadLetterQueue.getJobs(["completed"], 0, -1);
      const oldJobs = completedJobs.filter(job => job.timestamp < cutoffDate);
      
      let removed = 0;
      for (const job of oldJobs) {
        await job.remove();
        removed++;
      }

      logger.info(`[DeadLetter] Cleanup complete: removed ${removed} old jobs`);
      return { removed };
      
    } catch (error) {
      logger.error(`[DeadLetter] Cleanup failed:`, error);
      return { removed: 0 };
    }
  }

  /**
   * Cleanup resources on shutdown
   */
  public async shutdown(): Promise<void> {
    try {
      await this.recoveryWorker.close();
      await this.deadLetterQueue.close();
      logger.info(`[DeadLetter] Service shutdown complete`);
    } catch (error) {
      logger.error(`[DeadLetter] Shutdown failed:`, error);
    }
  }
}

// Export singleton instance
export const deadLetterQueueService = DeadLetterQueueService.getInstance();

// Cleanup on process exit
process.on('SIGTERM', () => deadLetterQueueService.shutdown());
process.on('SIGINT', () => deadLetterQueueService.shutdown());