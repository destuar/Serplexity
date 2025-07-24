/**
 * @file alertingService.ts
 * @description This file defines the `AlertingService`, a comprehensive system for sending various types of alerts
 * (report failures, system issues, scheduler failures, Redis/database failures) via email and webhooks.
 * It includes logic for determining alert levels, formatting messages, and logging alerts. This service is crucial
 * for maintaining the operational health and reliability of the application by proactively notifying administrators
 * of critical events.
 *
 * @dependencies
 * - nodemailer: For sending emails.
 * - axios: For making HTTP requests to webhooks.
 * - ../config/env: Environment variable configuration.
 * - ../config/db: The singleton Prisma client instance (for logging alerts to DB).
 *
 * @exports
 * - alertingService: A singleton instance of the AlertingService.
 */
import nodemailer from "nodemailer";
import axios from "axios";
import env from "../config/env";
import { getDbClient } from "../config/database";

interface AlertLevel {
  level: "CRITICAL" | "WARNING" | "INFO";
  emoji: string;
  color: string;
}

const ALERT_LEVELS: Record<string, AlertLevel> = {
  CRITICAL: { level: "CRITICAL", emoji: "🚨", color: "#FF0000" },
  WARNING: { level: "WARNING", emoji: "⚠️", color: "#FFA500" },
  INFO: { level: "INFO", emoji: "ℹ️", color: "#0066CC" },
};

interface ReportFailureAlert {
  runId: string;
  companyId: string;
  companyName: string;
  stage: string;
  errorMessage: string;
  progress?: number;
  timestamp: Date;
  attemptNumber?: number;
}

interface SystemAlert {
  component: "SCHEDULER" | "REDIS" | "DATABASE" | "AI_MODELS" | "QUEUE_WORKER";
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

class AlertingService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private isEmailConfigured = false;

  constructor() {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter() {
    try {
      if (
        env.SMTP_HOST &&
        env.SMTP_USER &&
        env.SMTP_PASSWORD &&
        env.SMTP_FROM_EMAIL
      ) {
        this.emailTransporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT || 587,
          secure: env.SMTP_PORT === 465,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASSWORD,
          },
          tls: {
            rejectUnauthorized: false, // For development/testing
          },
        });
        this.isEmailConfigured = true;
        console.log(
          "[AlertingService] Email transporter configured successfully",
        );
      } else {
        console.log(
          "[AlertingService] Email not configured - missing SMTP settings",
        );
      }
    } catch (error) {
      console.error(
        "[AlertingService] Failed to initialize email transporter:",
        error,
      );
    }
  }

  /**
   * Send alert for failed report generation
   */
  async alertReportFailure(alert: ReportFailureAlert): Promise<void> {
    const alertLevel = this.determineReportFailureLevel(alert);
    const message = this.formatReportFailureMessage(alert, alertLevel);

    console.log(
      `[AlertingService][${alertLevel.level}] Report failure alert:`,
      {
        runId: alert.runId,
        company: alert.companyName,
        stage: alert.stage,
        progress: alert.progress,
      },
    );

    await Promise.allSettled([
      this.sendEmailAlert(
        alertLevel,
        `Report Generation Failed: ${alert.companyName}`,
        message,
      ),
      this.sendWebhookAlert(alertLevel, "report_failure", alert),
    ]);

    // Log to database for tracking
    await this.logAlertToDatabase(
      "REPORT_FAILURE",
      alertLevel.level,
      alert.runId,
      message,
    );
  }

  /**
   * Send system-level alerts (scheduler, Redis, etc.)
   */
  async alertSystemIssue(alert: SystemAlert): Promise<void> {
    const alertLevel = this.determineSystemAlertLevel(alert);
    const message = this.formatSystemAlertMessage(alert, alertLevel);

    console.log(`[AlertingService][${alertLevel.level}] System alert:`, {
      component: alert.component,
      message: alert.message,
    });

    await Promise.allSettled([
      this.sendEmailAlert(
        alertLevel,
        `System Alert: ${alert.component}`,
        message,
      ),
      this.sendWebhookAlert(alertLevel, "system_alert", alert),
    ]);

    await this.logAlertToDatabase(
      "SYSTEM_ALERT",
      alertLevel.level,
      null,
      message,
    );
  }

  /**
   * Alert when daily scheduler fails to run
   */
  async alertSchedulerFailure(
    error: Error,
    scheduledTime: Date,
  ): Promise<void> {
    const alert: SystemAlert = {
      component: "SCHEDULER",
      message: `Daily scheduler failed to execute at ${scheduledTime.toISOString()}`,
      details: {
        errorMessage: error.message,
        errorStack: error.stack,
        scheduledTime: scheduledTime.toISOString(),
      },
      timestamp: new Date(),
    };

    await this.alertSystemIssue(alert);
  }

  /**
   * Alert when no reports are generated for a day
   */
  async alertNoReportsGenerated(date: Date): Promise<void> {
    const prisma = await getDbClient();
    const reportsToday = await prisma.reportRun.count({
      where: {
        createdAt: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    if (reportsToday === 0) {
      const alert: SystemAlert = {
        component: "SCHEDULER",
        message: `No reports were generated today (${date.toDateString()})`,
        details: {
          date: date.toISOString(),
          reportsCount: reportsToday,
        },
        timestamp: new Date(),
      };

      await this.alertSystemIssue(alert);
    }
  }

  /**
   * Alert when Redis connection fails
   */
  async alertRedisFailure(error: Error): Promise<void> {
    const alert: SystemAlert = {
      component: "REDIS",
      message: "Redis connection failure detected",
      details: {
        errorMessage: error.message,
        errorType: error.name,
      },
      timestamp: new Date(),
    };

    await this.alertSystemIssue(alert);
  }

  /**
   * Alert when database connection fails
   */
  async alertDatabaseFailure(error: Error): Promise<void> {
    const alert: SystemAlert = {
      component: "DATABASE",
      message: "Database connection failure detected",
      details: {
        errorMessage: error.message,
        errorType: error.name,
      },
      timestamp: new Date(),
    };

    await this.alertSystemIssue(alert);
  }

  private determineReportFailureLevel(alert: ReportFailureAlert): AlertLevel {
    // Critical if it's a customer-facing failure
    if (alert.attemptNumber && alert.attemptNumber >= 3) {
      return ALERT_LEVELS.CRITICAL;
    }

    // Critical if it failed late in the process (after 50% completion)
    if (alert.progress && alert.progress > 50) {
      return ALERT_LEVELS.CRITICAL;
    }

    // Warning for early failures (might retry successfully)
    return ALERT_LEVELS.WARNING;
  }

  private determineSystemAlertLevel(alert: SystemAlert): AlertLevel {
    if (alert.component === "SCHEDULER" || alert.component === "REDIS") {
      return ALERT_LEVELS.CRITICAL;
    }
    return ALERT_LEVELS.WARNING;
  }

  private formatReportFailureMessage(
    alert: ReportFailureAlert,
    level: AlertLevel,
  ): string {
    return `
${level.emoji} REPORT GENERATION FAILURE

Company: ${alert.companyName}
Report ID: ${alert.runId}
Stage: ${alert.stage}
Progress: ${alert.progress || 0}%
Attempt: ${alert.attemptNumber || 1}

Error: ${alert.errorMessage}

Time: ${alert.timestamp.toISOString()}

Next Steps:
${
  alert.attemptNumber && alert.attemptNumber >= 3
    ? "• Manual intervention required - check logs and restart if needed"
    : "• System will retry automatically"
}
• Check system health dashboard
• Verify AI model API status
• Monitor queue processing
    `.trim();
  }

  private formatSystemAlertMessage(
    alert: SystemAlert,
    level: AlertLevel,
  ): string {
    return `
${level.emoji} SYSTEM ALERT

Component: ${alert.component}
Message: ${alert.message}

Details:
${Object.entries(alert.details || {})
  .map(([key, value]) => `• ${key}: ${value}`)
  .join("\n")}

Time: ${alert.timestamp.toISOString()}

Immediate Actions:
• Check component health and connectivity
• Review recent logs for additional context
• Verify dependent services are running
• Consider manual backup procedures if critical
    `.trim();
  }

  private async sendEmailAlert(
    level: AlertLevel,
    subject: string,
    message: string,
  ): Promise<void> {
    if (!this.isEmailConfigured || !env.ADMIN_EMAIL) {
      console.log(
        "[AlertingService] Email not configured, skipping email alert",
      );
      return;
    }

    try {
      await this.emailTransporter!.sendMail({
        from: env.SMTP_FROM_EMAIL,
        to: env.ADMIN_EMAIL,
        subject: `[${level.level}] Serplexity Alert: ${subject}`,
        text: message,
        html: `
          <div style="font-family: monospace; background-color: #f5f5f5; padding: 20px;">
            <div style="background-color: ${level.color}; color: white; padding: 10px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin: 0;">${level.emoji} ${level.level} ALERT</h2>
            </div>
            <pre style="background-color: white; padding: 15px; border-radius: 5px; overflow-x: auto;">${message}</pre>
          </div>
        `,
      });
      console.log(
        `[AlertingService] Email alert sent successfully for ${subject}`,
      );
    } catch (error) {
      console.error("[AlertingService] Failed to send email alert:", error);
    }
  }

  private async sendWebhookAlert(
    level: AlertLevel,
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!env.ALERT_WEBHOOK_URL) {
      console.log(
        "[AlertingService] Webhook not configured, skipping webhook alert",
      );
      return;
    }

    try {
      await axios.post(
        env.ALERT_WEBHOOK_URL,
        {
          alert_type: type,
          level: level.level,
          timestamp: new Date().toISOString(),
          data,
        },
        {
          timeout: 5000,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Serplexity-AlertingService/1.0",
          },
        },
      );
      console.log(
        `[AlertingService] Webhook alert sent successfully for ${type}`,
      );
    } catch (error) {
      console.error("[AlertingService] Failed to send webhook alert:", error);
    }
  }

  private async logAlertToDatabase(
    type: string,
    level: string,
    runId: string | null,
    message: string,
  ): Promise<void> {
    try {
      // For now, just log to console. In production, you might want a dedicated alerts table
      console.log(`[AlertingService][DB_LOG] ${type} - ${level}:`, {
        runId,
        message: message.substring(0, 200),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "[AlertingService] Failed to log alert to database:",
        error,
      );
    }
  }
}

// Singleton instance
export const alertingService = new AlertingService();
export default alertingService;
