/**
 * @file emailNotificationWorker.ts
 * @description BullMQ worker for processing email notification jobs.
 * Handles email delivery, error recovery, and notification event logging.
 *
 * @dependencies
 * - bullmq: Worker management
 * - ../config/env: Environment configuration
 * - ../config/bullmq: BullMQ connection options
 * - ../config/database: Database client
 * - ../utils/logger: Structured logging
 * - nodemailer: Email delivery
 *
 * @exports
 * - emailNotificationWorker: Worker instance (auto-starts on import)
 */

import { Worker, Job } from "bullmq";
import env from "../config/env";
import { getBullMQOptions } from "../config/bullmq";
import { getDbClient } from "../config/database";
import logger from "../utils/logger";
import nodemailer, { Transporter } from "nodemailer";
import type { EmailNotificationJobData } from "./emailNotificationQueue";

// Queue name with environment prefix
const QUEUE_NAME = `${env.BULLMQ_QUEUE_PREFIX}email-notifications`;

// Email transporter for sending notifications
let emailTransporter: Transporter | null = null;
let isEmailConfigured = false;

/**
 * Initialize email transporter with SMTP configuration
 */
function initializeEmailTransporter(): void {
  try {
    if (
      env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASSWORD &&
      env.SMTP_FROM_EMAIL
    ) {
      emailTransporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
        tls: { rejectUnauthorized: false },
      });
      isEmailConfigured = true;
      logger.info("Email notification transporter configured successfully");
    } else {
      logger.warn("Email not configured - missing SMTP settings");
      isEmailConfigured = false;
    }
  } catch (error) {
    logger.error("Failed to initialize email transporter", {
      error: error instanceof Error ? error.message : String(error),
    });
    isEmailConfigured = false;
  }
}

/**
 * Format email subject for metric notifications
 */
function formatEmailSubject(data: EmailNotificationJobData): string {
  const { metricData } = data;
  const metricName = formatMetricName(metricData.metric);
  const directionText = formatDirectionText(metricData.direction);
  
  return `[Serplexity Alert] ${metricName} ${directionText}: ${metricData.companyName}`;
}

/**
 * Format human-readable metric names
 */
function formatMetricName(metric: string): string {
  const names: Record<string, string> = {
    RANKING: "Competitor Ranking",
    SOV_CHANGE: "Share of Voice",
    INCLUSION_RATE: "Inclusion Rate",
    SENTIMENT_SCORE: "Sentiment Score",
  };
  return names[metric] || metric;
}

/**
 * Format direction text for notifications
 */
function formatDirectionText(direction: string): string {
  const texts: Record<string, string> = {
    UP: "Increased",
    DOWN: "Decreased", 
    BETTER: "Improved",
    WORSE: "Declined",
    ANY: "Changed",
  };
  return texts[direction] || direction;
}

/**
 * Format email body with metric details
 */
function formatEmailBody(data: EmailNotificationJobData): { text: string; html: string } {
  const { metricData } = data;
  const metricName = formatMetricName(metricData.metric);
  const directionText = formatDirectionText(metricData.direction);
  
  // Format values based on metric type
  const formatValue = (value: number): string => {
    if (metricData.metric === "RANKING") {
      return `#${Math.round(value)}`;
    } else if (metricData.metric.includes("RATE") || metricData.metric === "SOV_CHANGE") {
      return `${value.toFixed(1)}%`;
    } else {
      return value.toFixed(2);
    }
  };

  const currentFormatted = formatValue(metricData.currentValue);
  const previousFormatted = formatValue(metricData.previousValue);
  const changeFormatted = metricData.changePercent.toFixed(1);
  
  // Dashboard URL for the company
  const dashboardUrl = `${env.FRONTEND_URL || "https://app.serplexity.com"}/dashboard/companies/${metricData.companyId}`;
  
  const text = `
${metricName} Alert - ${metricData.companyName}

Your ${metricName.toLowerCase()} has ${directionText.toLowerCase()}!

Current Value: ${currentFormatted}
Previous Value: ${previousFormatted}
Change: ${changeFormatted}% ${metricData.changeValue > 0 ? 'increase' : 'decrease'}

View detailed analytics: ${dashboardUrl}

Time: ${metricData.timestamp.toLocaleString()}

---
This is an automated notification from Serplexity. 
To manage your notification preferences, visit your dashboard settings.
  `.trim();

  const html = `
    <div style="font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1e293b; margin: 0; font-size: 24px; font-weight: 600;">
            ${metricName} Alert
          </h1>
          <p style="color: #64748b; margin: 8px 0 0 0; font-size: 16px;">
            ${metricData.companyName}
          </p>
        </div>
        
        <div style="background: ${metricData.changeValue > 0 ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${metricData.changeValue > 0 ? '#bbf7d0' : '#fecaca'}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 18px; font-weight: 500; color: ${metricData.changeValue > 0 ? '#15803d' : '#dc2626'};">
            Your ${metricName.toLowerCase()} has ${directionText.toLowerCase()}!
          </p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
          <div style="text-align: center; padding: 16px; background: #f8fafc; border-radius: 8px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 500;">Current</p>
            <p style="margin: 0; font-size: 24px; font-weight: 600; color: #1e293b;">${currentFormatted}</p>
          </div>
          <div style="text-align: center; padding: 16px; background: #f8fafc; border-radius: 8px;">
            <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 500;">Previous</p>
            <p style="margin: 0; font-size: 24px; font-weight: 600; color: #1e293b;">${previousFormatted}</p>
          </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #64748b;">
            <strong style="color: ${metricData.changeValue > 0 ? '#15803d' : '#dc2626'};">
              ${changeFormatted}% ${metricData.changeValue > 0 ? 'increase' : 'decrease'}
            </strong>
          </p>
        </div>
        
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${dashboardUrl}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            View Detailed Analytics
          </a>
        </div>
        
        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">
            ${metricData.timestamp.toLocaleString()}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">
            This is an automated notification from Serplexity.<br>
            To manage your notification preferences, visit your dashboard settings.
          </p>
        </div>
      </div>
    </div>
  `;

  return { text, html };
}

/**
 * Send email notification to recipients
 */
async function sendEmailNotification(data: EmailNotificationJobData): Promise<string[]> {
  if (!isEmailConfigured || !emailTransporter) {
    throw new Error("Email transporter not configured");
  }

  const subject = formatEmailSubject(data);
  const { text, html } = formatEmailBody(data);
  
  const successfulEmails: string[] = [];
  const failedEmails: string[] = [];

  // Send to each email individually to track success/failure per recipient
  for (const email of data.emails) {
    try {
      await emailTransporter.sendMail({
        from: env.SMTP_FROM_EMAIL,
        to: email,
        subject,
        text,
        html,
      });
      
      successfulEmails.push(email);
      logger.debug("Email notification sent successfully", {
        email,
        ruleId: data.ruleId,
        metric: data.metricData.metric,
        companyId: data.metricData.companyId,
      });
    } catch (error) {
      failedEmails.push(email);
      logger.error("Failed to send email notification", {
        email,
        ruleId: data.ruleId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // If no emails succeeded, throw error to trigger job retry
  if (successfulEmails.length === 0) {
    throw new Error(`Failed to send notification to any recipients. Failed emails: ${failedEmails.join(', ')}`);
  }

  // Log partial failures
  if (failedEmails.length > 0) {
    logger.warn("Email notification partially failed", {
      ruleId: data.ruleId,
      successful: successfulEmails.length,
      failed: failedEmails.length,
      failedEmails,
    });
  }

  return successfulEmails;
}

/**
 * Update notification event with delivery results
 */
async function updateNotificationEvent(
  dedupeKey: string,
  emailsSent: string[]
): Promise<void> {
  try {
    const prisma = await getDbClient();
    
    await prisma.notificationEvent.updateMany({
      where: { dedupeKey },
      data: { emailsSent },
    });

    logger.debug("Notification event updated with delivery results", {
      dedupeKey,
      emailsSent: emailsSent.length,
    });
  } catch (error) {
    logger.error("Failed to update notification event", {
      dedupeKey,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw here - the notification was sent successfully
  }
}

/**
 * Main job processor function
 */
async function processEmailNotificationJob(
  job: Job<EmailNotificationJobData>
): Promise<void> {
  const { data } = job;

  logger.info("Processing email notification job", {
    jobId: job.id,
    ruleId: data.ruleId,
    emails: data.emails.length,
    metric: data.metricData.metric,
    companyId: data.metricData.companyId,
  });

  try {
    // Send email notification
    const successfulEmails = await sendEmailNotification(data);

    // Update notification event with delivery results
    await updateNotificationEvent(data.dedupeKey, successfulEmails);

    logger.info("Email notification job completed successfully", {
      jobId: job.id,
      ruleId: data.ruleId,
      emailsSent: successfulEmails.length,
      metric: data.metricData.metric,
    });
  } catch (error) {
    logger.error("Email notification job failed", {
      jobId: job.id,
      ruleId: data.ruleId,
      error: error instanceof Error ? error.message : String(error),
      attemptsMade: job.attemptsMade,
    });
    throw error; // Re-throw to trigger BullMQ retry logic
  }
}

// Initialize email transporter
initializeEmailTransporter();

// Create and start the worker
export const emailNotificationWorker = new Worker<EmailNotificationJobData>(
  QUEUE_NAME,
  processEmailNotificationJob,
  {
    connection: getBullMQOptions().connection,
    concurrency: 5, // Process up to 5 jobs concurrently
    maxStalledCount: 1, // Maximum number of times a job can be recovered from stalled state
    stalledInterval: 30 * 1000, // Check for stalled jobs every 30 seconds
  }
);

// Worker event listeners
emailNotificationWorker.on("completed", (job) => {
  logger.info("Email notification worker completed job", {
    jobId: job.id,
    ruleId: job.data?.ruleId,
    duration: job.processedOn ? Date.now() - job.processedOn : 0,
  });
});

emailNotificationWorker.on("failed", (job, err) => {
  logger.error("Email notification worker job failed", {
    jobId: job?.id,
    ruleId: job?.data?.ruleId,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

emailNotificationWorker.on("error", (err) => {
  logger.error("Email notification worker error", {
    error: err.message,
    stack: err.stack,
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down email notification worker...");
  await emailNotificationWorker.close();
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down email notification worker...");
  await emailNotificationWorker.close();
});

export default emailNotificationWorker;