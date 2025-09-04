/**
 * @file adminController.ts
 * @description Admin API endpoints for dead letter queue management and system health monitoring
 */

import { Request, Response } from "express";
import { z } from "zod";
import { deadLetterQueueService, FailureClassification } from "../services/deadLetterQueueService";
import { resilientPydanticService } from "../services/resilientPydanticService";
import { healthMonitoringService } from "../services/healthMonitoringService";
import { reportStatusService } from "../services/reportStatusService";
import logger from "../utils/logger";

// Validation schemas
const bulkRetrySchema = z.object({
  classification: z.nativeEnum(FailureClassification).optional(),
  companyId: z.string().optional(),
  olderThanDays: z.number().min(0).max(90).optional(),
  maxJobs: z.number().min(1).max(100).default(50),
});

const retryJobSchema = z.object({
  priority: z.number().min(1).max(100).optional(),
  delay: z.number().min(0).max(3600000).optional(), // Max 1 hour delay
  forceRetry: z.boolean().default(false),
});

const markPermanentSchema = z.object({
  jobIds: z.array(z.string()).min(1).max(20),
  reason: z.string().min(10).max(500),
});

/**
 * Get failed jobs with filtering and pagination
 */
export async function getFailedJobs(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query;
    
    const options = {
      classification: query.classification as FailureClassification | undefined,
      companyId: query.companyId as string | undefined,
      canRetry: query.canRetry === "true" ? true : query.canRetry === "false" ? false : undefined,
      limit: query.limit ? parseInt(query.limit as string) : 50,
      offset: query.offset ? parseInt(query.offset as string) : 0,
      sortBy: (query.sortBy as "failedAt" | "company" | "classification") || "failedAt",
      sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
    };

    const result = await deadLetterQueueService.getFailedJobs(options);
    
    res.json({
      success: true,
      data: result,
      meta: {
        limit: options.limit,
        offset: options.offset,
        total: result.total,
        hasMore: result.total > (options.offset + options.limit),
      },
    });
  } catch (error) {
    logger.error(`[Admin] Failed to get failed jobs:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Retry a specific failed job
 */
export async function retryFailedJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const body = retryJobSchema.parse(req.body);
    
    const result = await deadLetterQueueService.retryJob(jobId, body);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          originalJobId: jobId,
          newJobId: result.newJobId,
          message: "Job queued for retry",
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error(`[Admin] Failed to retry job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Bulk retry jobs based on criteria
 */
export async function bulkRetryJobs(req: Request, res: Response): Promise<void> {
  try {
    const criteria = bulkRetrySchema.parse(req.body);
    
    // Convert olderThanDays to Date if provided
    const olderThan = criteria.olderThanDays 
      ? new Date(Date.now() - (criteria.olderThanDays * 24 * 60 * 60 * 1000))
      : undefined;

    const result = await deadLetterQueueService.bulkRetryJobs({
      ...criteria,
      olderThan,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`[Admin] Bulk retry failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Mark jobs as permanent failures
 */
export async function markJobsAsPermanent(req: Request, res: Response): Promise<void> {
  try {
    const { jobIds, reason } = markPermanentSchema.parse(req.body);
    
    await deadLetterQueueService.markAsPermanentFailure(jobIds, reason);
    
    res.json({
      success: true,
      data: {
        markedCount: jobIds.length,
        reason,
      },
    });
  } catch (error) {
    logger.error(`[Admin] Failed to mark jobs as permanent:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get comprehensive system health status
 */
export async function getSystemHealth(req: Request, res: Response): Promise<void> {
  try {
    const systemHealth = await healthMonitoringService.getSystemHealth();
    
    res.json({
      success: true,
      data: systemHealth,
    });
  } catch (error) {
    logger.error(`[Admin] System health check failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get historical metrics for dashboard charts
 */
export async function getHistoricalMetrics(req: Request, res: Response): Promise<void> {
  try {
    const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;
    
    if (hours < 1 || hours > 168) { // Max 1 week
      res.status(400).json({
        success: false,
        error: "Hours must be between 1 and 168",
      });
      return;
    }

    const metrics = await healthMonitoringService.getHistoricalMetrics(hours);
    
    res.json({
      success: true,
      data: {
        metrics,
        meta: {
          hours,
          dataPoints: metrics.length,
          timeRange: {
            start: metrics[metrics.length - 1]?.timestamp,
            end: metrics[0]?.timestamp,
          },
        },
      },
    });
  } catch (error) {
    logger.error(`[Admin] Failed to get historical metrics:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Acknowledge a system alert
 */
export async function acknowledgeAlert(req: Request, res: Response): Promise<void> {
  try {
    const { alertId } = req.params;
    
    const success = await healthMonitoringService.acknowledgeAlert(alertId);
    
    if (success) {
      res.json({
        success: true,
        data: {
          alertId,
          acknowledged: true,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }
  } catch (error) {
    logger.error(`[Admin] Failed to acknowledge alert ${req.params.alertId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Trigger manual health check
 */
export async function triggerHealthCheck(req: Request, res: Response): Promise<void> {
  try {
    const systemHealth = await healthMonitoringService.triggerHealthCheck();
    
    res.json({
      success: true,
      data: systemHealth,
      meta: {
        triggered: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`[Admin] Manual health check failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get all active reports with progress tracking
 */
export async function getActiveReports(req: Request, res: Response): Promise<void> {
  try {
    const reports = await reportStatusService.getAllActiveReports();
    
    res.json({
      success: true,
      data: {
        reports,
        total: reports.length,
        byStatus: {
          queued: reports.filter(r => r.status === "QUEUED").length,
          running: reports.filter(r => r.status === "RUNNING").length,
          completed: reports.filter(r => r.status === "COMPLETED").length,
          failed: reports.filter(r => r.status === "FAILED").length,
        },
      },
    });
  } catch (error) {
    logger.error(`[Admin] Failed to get active reports:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Get report progress for specific report
 */
export async function getReportProgress(req: Request, res: Response): Promise<void> {
  try {
    const { runId } = req.params;
    const progress = await reportStatusService.getReportProgress(runId);
    
    if (progress) {
      res.json({
        success: true,
        data: progress,
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Report progress not found",
      });
    }
  } catch (error) {
    logger.error(`[Admin] Failed to get report progress for ${req.params.runId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Force recovery of all circuit breakers
 */
export async function forceCircuitRecovery(req: Request, res: Response): Promise<void> {
  try {
    const success = resilientPydanticService.forceRecovery();
    
    if (success) {
      res.json({
        success: true,
        data: {
          message: "All circuit breakers forced to CLOSED state",
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to force recovery of some circuit breakers",
      });
    }
  } catch (error) {
    logger.error(`[Admin] Force circuit recovery failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Cleanup old dead letter queue entries
 */
export async function cleanupDeadLetterQueue(req: Request, res: Response): Promise<void> {
  try {
    const olderThanDays = req.body.olderThanDays || 30;
    
    if (olderThanDays < 7) {
      res.status(400).json({
        success: false,
        error: "Cannot cleanup jobs newer than 7 days",
      });
      return;
    }

    const result = await deadLetterQueueService.cleanup(olderThanDays);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(`[Admin] Dead letter queue cleanup failed:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}