/**
 * @file webAuditWorker.ts
 * @description Background worker for processing web audit jobs
 * 
 * Handles queued web audit requests and processes them asynchronously.
 * Integrates with BullMQ for reliable background job processing.
 */

import { Worker, Job } from 'bullmq';
import logger from '../utils/logger';
import { webAuditService } from '../services/webAudit/webAuditService';
import { redis } from '../config/redis';
import env from '../config/env';

// Define job data interface
interface WebAuditJobData {
  auditId: string;
  url: string;
  options: {
    includePerformance: boolean;
    includeSEO: boolean;
    includeGEO: boolean;
    includeAccessibility: boolean;
    includeSecurity: boolean;
  };
  companyId: string;
}

const WEB_AUDIT_QUEUE_NAME = `${env.BULLMQ_QUEUE_PREFIX}web-audit`;

/**
 * Process web audit job
 */
async function processWebAuditJob(job: Job<WebAuditJobData>): Promise<void> {
  const { auditId, url, options, companyId } = job.data;
  
  logger.info(`Processing web audit job`, {
    jobId: job.id,
    auditId,
    url,
    companyId,
    options
  });

  try {
    // Update job progress
    await job.updateProgress(10);

    // Process the audit using the service
    const result = await webAuditService.processAudit(auditId, url, options, companyId);

    // Update job progress
    await job.updateProgress(100);

    logger.info(`Web audit job completed successfully`, {
      jobId: job.id,
      auditId,
      url,
      overallScore: result.scores.overall
    });

  } catch (error) {
    logger.error(`Web audit job failed`, {
      jobId: job.id,
      auditId,
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Mark audit as failed in database
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      await prisma.webAuditRun.update({
        where: { id: auditId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });

      await prisma.$disconnect();
    } catch (dbError) {
      logger.error('Failed to update audit status to failed', {
        auditId,
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
    }

    throw error;
  }
}

/**
 * Create and configure the web audit worker
 */
const webAuditWorker = new Worker<WebAuditJobData>(
  WEB_AUDIT_QUEUE_NAME,
  processWebAuditJob,
  {
    connection: redis,
    concurrency: 2,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
    maxStalledCount: 3,
    stalledInterval: 30 * 1000, // 30 seconds
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        // Exponential backoff: 2^attempt * 1000ms
        return Math.min(Math.pow(2, attemptsMade) * 1000, 60000);
      },
    }
  }
);

// Worker event handlers
webAuditWorker.on('completed', (job: Job<WebAuditJobData>) => {
  logger.info(`Web audit worker completed job`, {
    jobId: job.id,
    auditId: job.data.auditId,
    url: job.data.url,
    duration: Date.now() - job.timestamp
  });
});

webAuditWorker.on('failed', (job: Job<WebAuditJobData> | undefined, err: Error) => {
  logger.error(`Web audit worker failed job`, {
    jobId: job?.id,
    auditId: job?.data?.auditId,
    url: job?.data?.url,
    error: err.message,
    attempts: job?.attemptsMade || 0
  });
});

webAuditWorker.on('stalled', (jobId: string) => {
  logger.warn(`Web audit worker job stalled`, { jobId });
});

webAuditWorker.on('error', (err: Error) => {
  logger.error(`Web audit worker error`, {
    error: err.message,
    stack: err.stack
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down web audit worker...');
  await webAuditWorker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down web audit worker...');
  await webAuditWorker.close();
  process.exit(0);
});

export { webAuditWorker, WEB_AUDIT_QUEUE_NAME };