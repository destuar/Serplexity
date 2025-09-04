/**
 * @file reportStatusService.ts
 * @description Real-time report status tracking service with user-visible progress,
 * WebSocket updates, and granular step monitoring.
 *
 * @dependencies
 * - ../utils/logger: Application logging
 * - ../config/redis: Redis for real-time updates
 * - socket.io: WebSocket for real-time client updates
 *
 * @exports
 * - ReportStatusService: Main service class with progress tracking
 * - reportStatusService: Singleton instance
 */

import logger from "../utils/logger";
import { Redis } from "ioredis";
import { redis } from "../config/redis";
import { getDbClient } from "../config/database";

export interface ReportProgress {
  runId: string;
  companyId: string;
  companyName: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  currentStep: string;
  progress: number; // 0-100
  startedAt: Date;
  estimatedCompletion?: Date;
  steps: ReportStep[];
  metadata: {
    questionsTotal: number;
    questionsCompleted: number;
    modelsTotal: number;
    modelsCompleted: number;
    competitorsFound: number;
    sentimentAnalysesCompleted: number;
    totalTokens: number;
    totalCost: number;
  };
}

export interface ReportStep {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number; // 0-100
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  subSteps?: ReportSubStep[];
}

export interface ReportSubStep {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  details?: string;
}

export interface ProgressUpdate {
  runId: string;
  step: string;
  progress: number;
  message?: string;
  metadata?: Record<string, any>;
}

export class ReportStatusService {
  private static instance: ReportStatusService;
  private redis: Redis;
  private monitoringInterval?: NodeJS.Timeout;
  private readonly PROGRESS_KEY_PREFIX = "report:progress:";
  private readonly PROGRESS_TTL = 7 * 24 * 60 * 60; // 7 days
  private activeReports = new Map<string, ReportProgress>();

  private constructor() {
    this.redis = redis;
  }

  public static getInstance(): ReportStatusService {
    if (!ReportStatusService.instance) {
      ReportStatusService.instance = new ReportStatusService();
    }
    return ReportStatusService.instance;
  }

  /**
   * Initialize report progress tracking
   */
  public async initializeReport(
    runId: string,
    companyId: string,
    companyName: string,
    questionsCount: number,
    modelsCount: number
  ): Promise<void> {
    const progress: ReportProgress = {
      runId,
      companyId,
      companyName,
      status: "QUEUED",
      currentStep: "Initializing",
      progress: 0,
      startedAt: new Date(),
      steps: this.createReportSteps(questionsCount, modelsCount),
      metadata: {
        questionsTotal: questionsCount,
        questionsCompleted: 0,
        modelsTotal: modelsCount,
        modelsCompleted: 0,
        competitorsFound: 0,
        sentimentAnalysesCompleted: 0,
        totalTokens: 0,
        totalCost: 0,
      },
    };

    // Store in memory and Redis
    this.activeReports.set(runId, progress);
    await this.publishProgress(progress);

    logger.info(`[ReportStatus] Initialized tracking for report ${runId}`, {
      company: companyName,
      questions: questionsCount,
      models: modelsCount,
    });
  }

  /**
   * Create standardized report steps
   */
  private createReportSteps(questionsCount: number, modelsCount: number): ReportStep[] {
    return [
      {
        id: "initialization",
        name: "Initialization",
        description: "Setting up report generation",
        status: "pending",
        progress: 0,
      },
      {
        id: "question_generation",
        name: "Question Generation",
        description: "Researching company and generating target market questions",
        status: "pending",
        progress: 0,
        subSteps: [
          {
            id: "company_research",
            name: "Company Research",
            status: "pending",
            progress: 0,
          },
          {
            id: "question_creation",
            name: "Question Creation",
            status: "pending",
            progress: 0,
          },
        ],
      },
      {
        id: "answer_generation",
        name: "Answer Generation",
        description: `Generating answers for ${questionsCount} questions using ${modelsCount} AI models`,
        status: "pending",
        progress: 0,
        subSteps: [
          {
            id: "model_processing",
            name: "Model Processing",
            status: "pending",
            progress: 0,
            details: `0/${questionsCount * modelsCount} question-model combinations`,
          },
          {
            id: "brand_extraction",
            name: "Brand Extraction",
            status: "pending",
            progress: 0,
          },
        ],
      },
      {
        id: "sentiment_analysis",
        name: "Sentiment Analysis",
        description: "Analyzing sentiment across all responses",
        status: "pending",
        progress: 0,
      },
      {
        id: "competitor_enrichment",
        name: "Competitor Enrichment",
        description: "Enriching competitor data and websites",
        status: "pending",
        progress: 0,
      },
      {
        id: "finalization",
        name: "Finalization",
        description: "Computing metrics and completing report",
        status: "pending",
        progress: 0,
        subSteps: [
          {
            id: "metrics_computation",
            name: "Metrics Computation",
            status: "pending",
            progress: 0,
          },
          {
            id: "data_persistence",
            name: "Data Persistence",
            status: "pending",
            progress: 0,
          },
        ],
      },
    ];
  }

  /**
   * Update report progress
   */
  public async updateProgress(update: ProgressUpdate): Promise<void> {
    const progress = this.activeReports.get(update.runId);
    if (!progress) {
      logger.warn(`[ReportStatus] Progress update for unknown report: ${update.runId}`);
      return;
    }

    // Update overall progress
    progress.progress = update.progress;
    progress.currentStep = update.step;

    // Update step status
    const step = progress.steps.find(s => s.id === update.step);
    if (step) {
      step.status = "running";
      step.progress = update.progress;
      if (!step.startedAt) {
        step.startedAt = new Date();
      }
    }

    // Update metadata if provided
    if (update.metadata) {
      progress.metadata = { ...progress.metadata, ...update.metadata };
    }

    // Calculate estimated completion time
    progress.estimatedCompletion = this.calculateEstimatedCompletion(progress);

    // Update in memory and Redis
    this.activeReports.set(update.runId, progress);
    await this.publishProgress(progress);

    logger.debug(`[ReportStatus] Progress updated for ${update.runId}`, {
      step: update.step,
      progress: update.progress,
      message: update.message,
    });
  }

  /**
   * Mark step as completed
   */
  public async completeStep(runId: string, stepId: string, metadata?: Record<string, any>): Promise<void> {
    const progress = this.activeReports.get(runId);
    if (!progress) return;

    const step = progress.steps.find(s => s.id === stepId);
    if (step) {
      step.status = "completed";
      step.progress = 100;
      step.completedAt = new Date();

      // Mark all substeps as completed
      if (step.subSteps) {
        step.subSteps.forEach(subStep => {
          subStep.status = "completed";
          subStep.progress = 100;
        });
      }
    }

    // Update metadata
    if (metadata) {
      progress.metadata = { ...progress.metadata, ...metadata };
    }

    // Calculate overall progress based on completed steps
    const completedSteps = progress.steps.filter(s => s.status === "completed").length;
    progress.progress = Math.round((completedSteps / progress.steps.length) * 100);

    await this.publishProgress(progress);
  }

  /**
   * Mark step as failed
   */
  public async failStep(runId: string, stepId: string, error: string): Promise<void> {
    const progress = this.activeReports.get(runId);
    if (!progress) return;

    const step = progress.steps.find(s => s.id === stepId);
    if (step) {
      step.status = "failed";
      step.error = error;
    }

    progress.status = "FAILED";
    progress.currentStep = `Failed: ${error}`;

    await this.publishProgress(progress);
  }

  /**
   * Complete entire report
   */
  public async completeReport(runId: string, finalMetadata: Record<string, any>): Promise<void> {
    const progress = this.activeReports.get(runId);
    if (!progress) return;

    progress.status = "COMPLETED";
    progress.progress = 100;
    progress.currentStep = "Completed";
    progress.metadata = { ...progress.metadata, ...finalMetadata };

    // Mark all remaining steps as completed
    progress.steps.forEach(step => {
      if (step.status !== "failed") {
        step.status = "completed";
        step.progress = 100;
        if (!step.completedAt) {
          step.completedAt = new Date();
        }
      }
    });

    await this.publishProgress(progress);

    // Remove from active tracking after a delay
    setTimeout(() => {
      this.activeReports.delete(runId);
    }, 60000); // Keep for 1 minute after completion
  }

  /**
   * Update question processing progress
   */
  public async updateQuestionProgress(
    runId: string, 
    questionsCompleted: number, 
    questionsTotal: number,
    modelsCompleted: number,
    modelsTotal: number
  ): Promise<void> {
    const combinationsCompleted = questionsCompleted * modelsTotal + modelsCompleted;
    const combinationsTotal = questionsTotal * modelsTotal;
    const progress = Math.round((combinationsCompleted / combinationsTotal) * 100);

    await this.updateProgress({
      runId,
      step: "answer_generation",
      progress,
      message: `Processing ${questionsCompleted}/${questionsTotal} questions, ${modelsCompleted}/${modelsTotal} models`,
      metadata: {
        questionsCompleted,
        modelsCompleted,
      },
    });

    // Update substep details
    const reportProgress = this.activeReports.get(runId);
    if (reportProgress) {
      const answerStep = reportProgress.steps.find(s => s.id === "answer_generation");
      if (answerStep?.subSteps) {
        const modelStep = answerStep.subSteps.find(s => s.id === "model_processing");
        if (modelStep) {
          modelStep.progress = progress;
          modelStep.details = `${combinationsCompleted}/${combinationsTotal} question-model combinations`;
        }
      }
    }
  }

  /**
   * Get current progress for a report
   */
  public async getReportProgress(runId: string): Promise<ReportProgress | null> {
    // Try memory first
    const memoryProgress = this.activeReports.get(runId);
    if (memoryProgress) {
      return memoryProgress;
    }

    // Try Redis
    try {
      const redisData = await this.redis.get(`${this.PROGRESS_KEY_PREFIX}${runId}`);
      if (redisData) {
        return JSON.parse(redisData);
      }
    } catch (error) {
      logger.warn(`[ReportStatus] Failed to get progress from Redis for ${runId}:`, error);
    }

    return null;
  }

  /**
   * Get progress for all reports by company
   */
  public async getCompanyReports(companyId: string): Promise<ReportProgress[]> {
    const reports: ReportProgress[] = [];

    // Get from memory
    for (const progress of this.activeReports.values()) {
      if (progress.companyId === companyId) {
        reports.push(progress);
      }
    }

    // Get recent reports from database if not in memory
    try {
      const prisma = await getDbClient();
      const recentRuns = await prisma.reportRun.findMany({
        where: {
          companyId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          company: { select: { name: true } },
        },
      });

      for (const run of recentRuns) {
        // Skip if already in memory
        if (reports.some(r => r.runId === run.id)) continue;

        // Try to get from Redis
        try {
          const redisData = await this.redis.get(`${this.PROGRESS_KEY_PREFIX}${run.id}`);
          if (redisData) {
            reports.push(JSON.parse(redisData));
          } else {
            // Create basic progress from database data
            reports.push(this.createProgressFromDatabase(run));
          }
        } catch {
          reports.push(this.createProgressFromDatabase(run));
        }
      }
    } catch (error) {
      logger.error(`[ReportStatus] Failed to get company reports for ${companyId}:`, error);
    }

    return reports.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Create progress object from database record
   */
  private createProgressFromDatabase(run: any): ReportProgress {
    let progress = 0;
    let currentStep = run.stepStatus || "Unknown";

    // Determine progress based on status
    switch (run.status) {
      case "QUEUED":
        progress = 5;
        currentStep = "Queued for processing";
        break;
      case "RUNNING":
        progress = 50; // Estimate
        break;
      case "COMPLETED":
        progress = 100;
        currentStep = "Completed";
        break;
      case "FAILED":
        progress = 0;
        currentStep = `Failed: ${run.stepStatus}`;
        break;
    }

    return {
      runId: run.id,
      companyId: run.companyId,
      companyName: run.company?.name || "Unknown",
      status: run.status,
      currentStep,
      progress,
      startedAt: run.createdAt,
      steps: [], // Empty steps for database-only records
      metadata: {
        questionsTotal: 0,
        questionsCompleted: 0,
        modelsTotal: 0,
        modelsCompleted: 0,
        competitorsFound: 0,
        sentimentAnalysesCompleted: 0,
        totalTokens: run.totalTokens || 0,
        totalCost: run.totalCost || 0,
      },
    };
  }

  /**
   * Calculate estimated completion time
   */
  private calculateEstimatedCompletion(progress: ReportProgress): Date {
    const elapsed = Date.now() - progress.startedAt.getTime();
    const progressRatio = Math.max(progress.progress / 100, 0.01); // Avoid division by zero
    const estimatedTotal = elapsed / progressRatio;
    const remaining = estimatedTotal - elapsed;
    
    return new Date(Date.now() + remaining);
  }

  /**
   * Publish progress to Redis for real-time updates
   */
  private async publishProgress(progress: ReportProgress): Promise<void> {
    try {
      // Store in Redis with TTL
      await this.redis.setex(
        `${this.PROGRESS_KEY_PREFIX}${progress.runId}`,
        this.PROGRESS_TTL,
        JSON.stringify(progress)
      );

      // Publish to subscribers for real-time updates
      await this.redis.publish(
        `report:progress:${progress.companyId}`,
        JSON.stringify({
          type: "progress_update",
          data: progress,
        })
      );

      // Update database step status
      try {
        const prisma = await getDbClient();
        await prisma.reportRun.update({
          where: { id: progress.runId },
          data: {
            status: progress.status,
            stepStatus: `${progress.currentStep} (${progress.progress}% - Q:${progress.metadata.questionsCompleted}/${progress.metadata.questionsTotal} M:${progress.metadata.modelsCompleted}/${progress.metadata.modelsTotal})`,
          },
        });
      } catch (dbError) {
        logger.warn(`[ReportStatus] Failed to update database status:`, dbError);
      }

    } catch (error) {
      logger.error(`[ReportStatus] Failed to publish progress for ${progress.runId}:`, error);
    }
  }

  /**
   * Subscribe to progress updates for a company
   */
  public async subscribeToCompanyUpdates(
    companyId: string,
    callback: (progress: ReportProgress) => void
  ): Promise<() => void> {
    const subscriber = this.redis.duplicate();
    
    subscriber.subscribe(`report:progress:${companyId}`);
    
    subscriber.on("message", (channel, message) => {
      try {
        const update = JSON.parse(message);
        if (update.type === "progress_update") {
          callback(update.data);
        }
      } catch (error) {
        logger.error(`[ReportStatus] Failed to parse progress update:`, error);
      }
    });

    // Return unsubscribe function
    return () => {
      subscriber.unsubscribe(`report:progress:${companyId}`);
      subscriber.quit();
    };
  }

  /**
   * Get all active reports across the system
   */
  public async getAllActiveReports(): Promise<ReportProgress[]> {
    const reports: ReportProgress[] = [];

    // Get from memory
    reports.push(...Array.from(this.activeReports.values()));

    // Get recent active reports from database
    try {
      const prisma = await getDbClient();
      const activeRuns = await prisma.reportRun.findMany({
        where: {
          status: { in: ["QUEUED", "RUNNING"] },
        },
        include: {
          company: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const run of activeRuns) {
        // Skip if already in memory
        if (reports.some(r => r.runId === run.id)) continue;

        reports.push(this.createProgressFromDatabase(run));
      }
    } catch (error) {
      logger.error(`[ReportStatus] Failed to get active reports:`, error);
    }

    return reports;
  }

  /**
   * Clean up completed or old progress records
   */
  public async cleanup(olderThanHours: number = 24): Promise<{ removed: number }> {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    let removed = 0;

    try {
      // Clean up memory
      for (const [runId, progress] of this.activeReports.entries()) {
        if (progress.status === "COMPLETED" || progress.status === "FAILED") {
          const age = Date.now() - progress.startedAt.getTime();
          if (age > cutoffTime) {
            this.activeReports.delete(runId);
            removed++;
          }
        }
      }

      // Clean up Redis keys
      const pattern = `${this.PROGRESS_KEY_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        try {
          const data = await this.redis.get(key);
          if (data) {
            const progress: ReportProgress = JSON.parse(data);
            const age = Date.now() - new Date(progress.startedAt).getTime();
            
            if ((progress.status === "COMPLETED" || progress.status === "FAILED") && age > cutoffTime) {
              await this.redis.del(key);
              removed++;
            }
          }
        } catch {
          // Remove invalid keys
          await this.redis.del(key);
          removed++;
        }
      }

      logger.info(`[ReportStatus] Cleanup complete: removed ${removed} old progress records`);
      return { removed };
      
    } catch (error) {
      logger.error(`[ReportStatus] Cleanup failed:`, error);
      return { removed: 0 };
    }
  }

  /**
   * Get service health status
   */
  public getHealthStatus(): { status: string; activeReports: number; details: any } {
    try {
      return {
        status: "healthy",
        activeReports: this.activeReports.size,
        details: {
          memoryReports: this.activeReports.size,
          monitoringActive: !!this.monitoringInterval,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        activeReports: 0,
        details: {
          error: error instanceof Error ? error.message : error,
        },
      };
    }
  }

  /**
   * Shutdown service
   */
  public async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    try {
      await this.redis.quit();
      logger.info(`[ReportStatus] Service shutdown complete`);
    } catch (error) {
      logger.error(`[ReportStatus] Shutdown failed:`, error);
    }
  }
}

// Export singleton instance
export const reportStatusService = ReportStatusService.getInstance();

// Cleanup on process exit
process.on('SIGTERM', () => reportStatusService.shutdown());
process.on('SIGINT', () => reportStatusService.shutdown());