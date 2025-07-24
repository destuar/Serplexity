/**
 * @file reportGenerationQueue.ts
 * @description This file defines the BullMQ queue for report generation jobs.
 * It initializes the queue with predefined options and sets up event listeners for logging queue activities and errors.
 * This is the entry point for all report generation tasks, ensuring they are processed asynchronously and reliably.
 *
 * @dependencies
 * - bullmq: The BullMQ library for creating queues.
 * - ../config/env: Environment variable configuration.
 * - ../config/bullmq: BullMQ configuration options.
 *
 * @exports
 * - reportGenerationQueue: The BullMQ queue instance for report generation jobs.
 */
import { Queue } from "bullmq";
import env from "../config/env";
import { getBullMQOptions } from "../config/bullmq";

// Enhanced logging for queue setup
const queueLog = (
  message: string,
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO",
  metadata?: Record<string, unknown>,
) => {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}][ReportGenerationQueue][${level}] ${message}`;

  if (metadata && Object.keys(metadata).length > 0) {
    logLine += ` | Meta: ${JSON.stringify(metadata)}`;
  }

  console.log(logLine);
};

// Skip queue initialization in test environment to prevent Jest hanging
let reportGenerationQueue: Queue | null = null;

queueLog("Initializing report generation queue", "INFO", {
  redisHost: env.REDIS_HOST,
  redisPort: env.REDIS_PORT,
  queueName: "report-generation",
});

reportGenerationQueue = new Queue("report-generation", getBullMQOptions());

export { reportGenerationQueue };

// Log queue events for monitoring (only if queue exists)
if (reportGenerationQueue) {
  reportGenerationQueue.on("error", (error: Error) => {
    queueLog("Queue error occurred", "ERROR", {
      errorMessage: error.message,
      errorType: error.name,
      stack: error.stack,
    });
  });

  reportGenerationQueue.on("waiting", (job: { id: string; name: string; data?: { runId?: string; company?: { id: string } } }) => {
    queueLog("Job added to queue and waiting", "INFO", {
      jobId: job.id,
      jobName: job.name,
      runId: job.data?.runId,
      companyId: job.data?.company?.id,
      timestamp: new Date().toISOString(),
    });
  });

  queueLog("Report generation queue initialized successfully", "INFO", {
    queueName: reportGenerationQueue.name,
    redisConnection: `${env.REDIS_HOST}:${env.REDIS_PORT}`,
  });
}
