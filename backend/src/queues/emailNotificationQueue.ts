/**
 * @file emailNotificationQueue.ts
 * @description BullMQ queue for email notification delivery jobs.
 * Handles asynchronous email notification processing with retry logic and failure handling.
 *
 * @dependencies
 * - bullmq: Queue management
 * - ../config/env: Environment configuration
 * - ../config/bullmq: BullMQ connection options
 * - ../utils/logger: Structured logging
 *
 * @exports
 * - emailNotificationQueue: Queue instance
 * - addEmailNotificationJob: Function to add jobs to queue
 */

import { Queue } from "bullmq";
import { getBullMQOptions } from "../config/bullmq";
import logger from "../utils/logger";

// Job data interface for email notifications
export interface EmailNotificationJobData {
  ruleId: string;
  emails: string[];
  metricData: {
    metric: string;
    currentValue: number;
    previousValue: number;
    companyId: string;
    companyName: string;
    reportRunId?: string;
    timestamp: Date;
    changeValue: number;
    changePercent: number;
    direction: string;
  };
  dedupeKey: string;
}

// Queue name with environment prefix  
const QUEUE_NAME = `email-notifications`;

// Create the email notification queue
export const emailNotificationQueue = new Queue<EmailNotificationJobData>(
  QUEUE_NAME,
  {
    connection: getBullMQOptions().connection,
    defaultJobOptions: {
      attempts: 3, // Retry failed jobs up to 3 times
      backoff: {
        type: "exponential",
        delay: 2000, // Start with 2 second delay, exponentially increase
      },
      removeOnComplete: 50, // Keep last 50 completed jobs for monitoring
      removeOnFail: 100, // Keep last 100 failed jobs for debugging
    },
  }
);

// Add job function with proper typing
export async function addEmailNotificationJob(
  data: EmailNotificationJobData
): Promise<void> {
  try {
    await emailNotificationQueue.add("send-email-notification", data, {
      // Use dedupeKey as job ID to prevent duplicate jobs within the same hour
      jobId: data.dedupeKey,
      // Override default attempts for instant notifications
      attempts: 5,
      delay: 0, // Send immediately
    });

    logger.info("Email notification job queued", {
      ruleId: data.ruleId,
      emails: data.emails.length,
      metric: data.metricData.metric,
      companyId: data.metricData.companyId,
      dedupeKey: data.dedupeKey,
    });
  } catch (error) {
    logger.error("Failed to queue email notification job", {
      ruleId: data.ruleId,
      dedupeKey: data.dedupeKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Queue event listeners for monitoring and logging
// Note: BullMQ event listeners can be added here if needed for monitoring

emailNotificationQueue.on("error", (err) => {
  logger.error("Email notification queue error", {
    error: err.message,
    stack: err.stack,
  });
});

// Graceful cleanup on process exit
process.on("SIGINT", async () => {
  logger.info("Shutting down email notification queue...");
  await emailNotificationQueue.close();
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down email notification queue...");
  await emailNotificationQueue.close();
});

export default emailNotificationQueue;