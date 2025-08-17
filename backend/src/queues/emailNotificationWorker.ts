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
import { SecretsProviderFactory, SmtpSecret } from "../services/secretsProvider";
import type { EmailNotificationJobData } from "./emailNotificationQueue";

// Queue name with environment prefix
const QUEUE_NAME = `email-notifications`;

// Email transporter for sending notifications
let emailTransporter: Transporter | null = null;
let isEmailConfigured = false;
let smtpSecret: SmtpSecret | null = null;

/**
 * Initialize email transporter with SMTP configuration
 */
async function initializeEmailTransporter(): Promise<void> {
  if (isEmailConfigured) return;
  
  try {
    // Try to get SMTP credentials from secrets provider first
    if (env.SMTP_SECRET_NAME && env.COMPUTED_SECRETS_PROVIDER !== "environment") {
      logger.info("[emailNotificationWorker] Attempting to load SMTP credentials from secrets provider");
      const secretsProvider = await SecretsProviderFactory.createFromEnvironment();
      const smtpSecretResult = await secretsProvider.getSmtpSecret(env.SMTP_SECRET_NAME);
      smtpSecret = smtpSecretResult.secret;
      
      const transportConfig = {
        host: smtpSecret.host,
        port: smtpSecret.port,
        secure: smtpSecret.secure || smtpSecret.port === 465,
        auth: {
          user: smtpSecret.user,
          pass: smtpSecret.password,
        },
        tls: { rejectUnauthorized: false },
      };
      
      logger.info("[emailNotificationWorker] Creating SMTP transporter with config", {
        host: transportConfig.host,
        port: transportConfig.port,
        secure: transportConfig.secure,
        user: transportConfig.auth.user,
        provider: smtpSecretResult.metadata.provider
      });
      
      emailTransporter = nodemailer.createTransport(transportConfig);
      isEmailConfigured = true;
      logger.info("[emailNotificationWorker] SMTP transporter configured from secrets provider");
      return;
    }
    
    // Fallback to environment variables
    if (
      env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASSWORD &&
      env.SMTP_FROM_EMAIL
    ) {
      logger.info("[emailNotificationWorker] Configuring SMTP from environment variables");
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
      logger.info("[emailNotificationWorker] Email notification transporter configured from environment");
    } else {
      logger.warn("[emailNotificationWorker] Email not configured - missing SMTP settings");
      isEmailConfigured = false;
    }
  } catch (error) {
    logger.error("[emailNotificationWorker] Failed to initialize email transporter", {
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
  
  // Calculate raw change (absolute difference)
  const rawChange = Math.abs(metricData.changeValue);
  const changeDirection = metricData.changeValue > 0 ? 'increase' : 'decrease';
  
  // Dashboard URL for overview
  const dashboardUrl = "https://serplexity.com/overview";
  
  // Format timestamp for display (convert string to Date if needed)
  const timestamp = typeof metricData.timestamp === 'string' 
    ? new Date(metricData.timestamp) 
    : metricData.timestamp;
  const formattedTimestamp = timestamp.toLocaleString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
  
  const text = `
${metricName} Alert - ${metricData.companyName}

Your ${metricName.toLowerCase()} has ${directionText.toLowerCase()} from ${previousFormatted} to ${currentFormatted}.

Change: ${rawChange.toFixed(1)} point ${changeDirection}

View detailed analytics: ${dashboardUrl}

Time: ${formattedTimestamp}

---
This is an automated notification from Serplexity. 
To manage your notification preferences, visit your dashboard settings.
  `.trim();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${metricName} Alert - Serplexity</title>
    </head>
    <body style="margin: 0; padding: 10px; background-color: #f6f9fc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 520px; margin: 0 auto; padding: 0; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb;">
      <!-- Header -->
      <div style="text-align: center; padding: 24px 16px 16px 16px; border-bottom: 1px solid #f1f5f9;">
        <table style="margin: 0 auto; border-collapse: collapse;">
          <tr>
            <td style="vertical-align: middle; padding-right: 12px;">
              <img src="https://www.serplexity.com/Serplexity.png" alt="Serplexity" width="32" height="32" style="width: 32px; height: 32px; display: block;" />
            </td>
            <td style="vertical-align: middle;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b; letter-spacing: -0.025em;">Serplexity</h1>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Main Content -->
      <div style="padding: 24px 16px;">
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0f172a; line-height: 1.2; text-align: center;">${metricName} Alert</h2>
        
        <p style="margin: 0 0 24px 0; padding: 0 16px; font-size: 16px; line-height: 1.6; color: #475569; text-align: center;">Your <strong>${metricName.toLowerCase()}</strong> for ${metricData.companyName} has ${directionText.toLowerCase()} from <strong>${previousFormatted}</strong> to <strong>${currentFormatted}</strong>.</p>
        
        <!-- Metrics Display -->
        <table style="width: 100%; margin: 32px 0; border-collapse: collapse;">
          <tr>
            <td style="width: 33.33%; padding: 16px 8px; background: #f8fafc; border-radius: 8px 0 0 8px; text-align: center; vertical-align: top;">
              <div style="margin-bottom: 8px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 500; letter-spacing: 0.5px; margin-bottom: 6px;">Previous</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e293b; line-height: 1.1;">${previousFormatted}</div>
              </div>
            </td>
            <td style="width: 33.33%; padding: 16px 8px; background: #f8fafc; text-align: center; vertical-align: top;">
              <div style="margin-bottom: 8px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 500; letter-spacing: 0.5px; margin-bottom: 6px;">Current</div>
                <div style="font-size: 20px; font-weight: 700; color: #1e293b; line-height: 1.1;">${currentFormatted}</div>
              </div>
            </td>
            <td style="width: 33.33%; padding: 16px 8px; background: #f8fafc; border-radius: 0 8px 8px 0; text-align: center; vertical-align: top;">
              <div style="margin-bottom: 8px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 500; letter-spacing: 0.5px; margin-bottom: 6px;">Change</div>
                <div style="font-size: 20px; font-weight: 700; color: ${metricData.changeValue > 0 ? '#059669' : '#dc2626'}; line-height: 1.1; white-space: nowrap;">
                  ${metricData.changeValue > 0 ? '↗' : '↘'}&nbsp;${rawChange.toFixed(1)}
                </div>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background-color: #000000; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Detailed Analytics</a>
        </div>
        
        <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 1.5; color: #94a3b8; text-align: center;">${formattedTimestamp}</p>
      </div>
      
      <!-- Footer -->
      <div style="padding: 16px; border-top: 1px solid #f1f5f9; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">© 2025 Serplexity. All rights reserved.</p>
      </div>
    </div>
    </body>
    </html>
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
  
  const fromEmail = smtpSecret?.fromEmail || env.SMTP_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("No FROM email address configured");
  }
  
  const successfulEmails: string[] = [];
  const failedEmails: string[] = [];

  // Send to each email individually to track success/failure per recipient
  for (const email of data.emails) {
    try {
      await emailTransporter.sendMail({
        from: `"Serplexity Alerts" <${fromEmail}>`,
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
    // Ensure email transporter is configured
    await initializeEmailTransporter();
    
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
(async () => {
  try {
    await initializeEmailTransporter();
  } catch (error) {
    logger.error("[emailNotificationWorker] Failed to initialize on startup", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
})();

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

// Debug: Log worker creation
logger.info("[emailNotificationWorker] Worker created and registered", {
  queueName: QUEUE_NAME,
  status: "ready"
});

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