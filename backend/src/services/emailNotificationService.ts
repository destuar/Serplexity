/**
 * @file emailNotificationService.ts
 * @description Email notification service for GEO metric changes.
 * Evaluates notification rules against report metrics and sends email alerts.
 * Supports deduplication, cooldown periods, and both instant and digest notifications.
 *
 * @dependencies
 * - ../config/database: Prisma client for database operations
 * - ./mailerService: SMTP email delivery
 * - ../utils/logger: Structured logging
 * - ../queues/emailNotificationQueue: Background job processing
 *
 * @exports
 * - emailNotificationService: Main service singleton
 */

import { getDbClient } from "../config/database";
import logger from "../utils/logger";
import { addEmailNotificationJob } from "../queues/emailNotificationQueue";

// Type definitions for email notifications
export interface EmailNotificationRule {
  id: string;
  ownerUserId: string;
  companyId?: string | null;
  metric: "RANKING" | "SOV_CHANGE" | "INCLUSION_RATE" | "SENTIMENT_SCORE";
  thresholdType: "ABSOLUTE" | "PERCENT";
  thresholdValue: number;
  direction: "UP" | "DOWN" | "BETTER" | "WORSE" | "ANY";
  frequency: "INSTANT" | "DAILY_DIGEST";
  emails: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MetricEvaluationData {
  metric: string;
  currentValue: number;
  previousValue: number;
  companyId: string;
  companyName: string;
  reportRunId?: string;
  timestamp: Date;
}

export interface NotificationTrigger {
  rule: EmailNotificationRule;
  metricData: MetricEvaluationData;
  triggered: boolean;
  direction: string;
  changeValue: number;
  changePercent: number;
}

class EmailNotificationService {
  /**
   * Load all active notification rules for an account
   */
  async loadAccountRules(
    ownerUserId: string,
    companyId?: string
  ): Promise<EmailNotificationRule[]> {
    const prisma = await getDbClient();

    const rules = await prisma.notificationRule.findMany({
      where: {
        ownerUserId,
        active: true,
        AND: companyId
          ? [
              {
                OR: [{ companyId }, { companyId: null }], // Include rules for this company OR all companies
              },
            ]
          : undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    return rules.map(this.mapPrismaRuleToInterface);
  }

  /**
   * Evaluate all notification rules for a completed report
   */
  async evaluateReport(params: {
    ownerUserId: string;
    companyId: string;
    reportId: string;
  }): Promise<void> {
    const { ownerUserId, companyId, reportId } = params;

    logger.info("Evaluating email notification rules for report", {
      ownerUserId,
      companyId,
      reportId,
    });

    try {
      // Load active rules for this account/company
      const rules = await this.loadAccountRules(ownerUserId, companyId);

      if (rules.length === 0) {
        logger.debug("No active notification rules found", {
          ownerUserId,
          companyId,
        });
        return;
      }

      // Get current metrics for the report
      const metricData = await this.getReportMetrics(companyId, reportId);

      if (!metricData || metricData.length === 0) {
        logger.warn("No metrics found for report evaluation", {
          companyId,
          reportId,
        });
        return;
      }

      // Evaluate each rule against the metrics
      const triggers: NotificationTrigger[] = [];

      for (const rule of rules) {
        const relevantMetric = metricData.find((m) => m.metric === rule.metric);
        if (!relevantMetric) continue;

        const trigger = await this.evaluateRule(rule, relevantMetric);
        if (trigger.triggered) {
          triggers.push(trigger);
        }
      }

      // Process triggered notifications
      if (triggers.length > 0) {
        await this.processTriggeredNotifications(triggers);
      }

      logger.info("Email notification evaluation completed", {
        ownerUserId,
        companyId,
        reportId,
        rulesEvaluated: rules.length,
        notificationsTriggered: triggers.length,
      });
    } catch (error) {
      logger.error("Error evaluating notification rules", {
        ownerUserId,
        companyId,
        reportId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get current and previous metric values for a report
   */
  private async getReportMetrics(
    companyId: string,
    reportId: string
  ): Promise<MetricEvaluationData[]> {
    const prisma = await getDbClient();

    // Get the company name
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    if (!company) {
      logger.warn("Company not found for metric evaluation", { companyId });
      return [];
    }

    const metrics: MetricEvaluationData[] = [];

    // Get current report metrics
    const currentMetrics = await prisma.reportMetric.findMany({
      where: { companyId, reportId: reportId },
      include: { report: true },
    });

    // Get previous report for comparison
    const previousReport = await prisma.reportRun.findFirst({
      where: {
        companyId,
        status: "COMPLETED",
        id: { not: reportId },
      },
      orderBy: { createdAt: "desc" },
      include: { reportMetrics: true },
    });

    const timestamp = new Date();

    // Evaluate each metric type for each AI model
    for (const currentMetric of currentMetrics) {
      const previousMetric = previousReport?.reportMetrics.find(
        (m) => m.aiModel === currentMetric.aiModel
      );

      // Evaluate Share of Voice
      if (currentMetric.shareOfVoice !== null) {
        const previousValue = previousMetric?.shareOfVoice ?? currentMetric.shareOfVoice;
        metrics.push({
          metric: "SOV_CHANGE",
          currentValue: currentMetric.shareOfVoice,
          previousValue,
          companyId,
          companyName: company.name,
          reportRunId: reportId,
          timestamp,
        });
      }

      // Evaluate Inclusion Rate
      if (currentMetric.averageInclusionRate !== null) {
        const previousValue = previousMetric?.averageInclusionRate ?? currentMetric.averageInclusionRate;
        metrics.push({
          metric: "INCLUSION_RATE",
          currentValue: currentMetric.averageInclusionRate,
          previousValue,
          companyId,
          companyName: company.name,
          reportRunId: reportId,
          timestamp,
        });
      }

      // Evaluate Ranking (average position)
      if (currentMetric.averagePosition !== null) {
        const previousValue = previousMetric?.averagePosition ?? currentMetric.averagePosition;
        metrics.push({
          metric: "RANKING",
          currentValue: currentMetric.averagePosition,
          previousValue,
          companyId,
          companyName: company.name,
          reportRunId: reportId,
          timestamp,
        });
      }

      // Evaluate Sentiment Score (extract from JSON if available)
      if (currentMetric.sentimentScore) {
        try {
          const sentimentData = currentMetric.sentimentScore as any;
          const currentSentiment = typeof sentimentData === 'object' ? 
            (sentimentData.overall || sentimentData.average || 0) : 
            Number(sentimentData) || 0;
          
          const previousSentimentData = previousMetric?.sentimentScore as any;
          const previousSentiment = previousSentimentData ? 
            (typeof previousSentimentData === 'object' ? 
              (previousSentimentData.overall || previousSentimentData.average || 0) : 
              Number(previousSentimentData) || 0) : 
            currentSentiment;

          metrics.push({
            metric: "SENTIMENT_SCORE",
            currentValue: currentSentiment,
            previousValue: previousSentiment,
            companyId,
            companyName: company.name,
            reportRunId: reportId,
            timestamp,
          });
        } catch (error) {
          logger.warn("Failed to parse sentiment score", {
            companyId,
            reportId,
            aiModel: currentMetric.aiModel,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return metrics;
  }


  /**
   * Evaluate a single rule against metric data
   */
  private async evaluateRule(
    rule: EmailNotificationRule,
    metricData: MetricEvaluationData
  ): Promise<NotificationTrigger> {
    const { currentValue, previousValue } = metricData;
    const changeValue = currentValue - previousValue;
    const changePercent =
      previousValue !== 0 ? (changeValue / Math.abs(previousValue)) * 100 : 0;

    let triggered = false;
    let direction = "";

    // Determine if threshold is met based on rule configuration
    if (rule.thresholdType === "ABSOLUTE") {
      // Absolute value thresholds
      if (rule.direction === "UP" && changeValue >= rule.thresholdValue) {
        triggered = true;
        direction = "UP";
      } else if (
        rule.direction === "DOWN" &&
        changeValue <= -rule.thresholdValue
      ) {
        triggered = true;
        direction = "DOWN";
      } else if (
        rule.direction === "BETTER" &&
        rule.metric === "RANKING" &&
        changeValue <= -rule.thresholdValue
      ) {
        // For rankings, lower numbers are better
        triggered = true;
        direction = "BETTER";
      } else if (
        rule.direction === "WORSE" &&
        rule.metric === "RANKING" &&
        changeValue >= rule.thresholdValue
      ) {
        triggered = true;
        direction = "WORSE";
      } else if (rule.direction === "ANY" && Math.abs(changeValue) >= rule.thresholdValue) {
        triggered = true;
        direction = changeValue > 0 ? "UP" : "DOWN";
      }
    } else {
      // Percentage change thresholds
      if (rule.direction === "UP" && changePercent >= rule.thresholdValue) {
        triggered = true;
        direction = "UP";
      } else if (
        rule.direction === "DOWN" &&
        changePercent <= -rule.thresholdValue
      ) {
        triggered = true;
        direction = "DOWN";
      } else if (
        rule.direction === "BETTER" &&
        rule.metric === "RANKING" &&
        changePercent <= -rule.thresholdValue
      ) {
        triggered = true;
        direction = "BETTER";
      } else if (
        rule.direction === "WORSE" &&
        rule.metric === "RANKING" &&
        changePercent >= rule.thresholdValue
      ) {
        triggered = true;
        direction = "WORSE";
      } else if (rule.direction === "ANY" && Math.abs(changePercent) >= rule.thresholdValue) {
        triggered = true;
        direction = changePercent > 0 ? "UP" : "DOWN";
      }
    }

    return {
      rule,
      metricData,
      triggered,
      direction,
      changeValue,
      changePercent,
    };
  }

  /**
   * Process triggered notifications (dedupe, queue, log)
   */
  private async processTriggeredNotifications(
    triggers: NotificationTrigger[]
  ): Promise<void> {
    const prisma = await getDbClient();

    for (const trigger of triggers) {
      const { rule, metricData, direction, changeValue, changePercent } = trigger;

      // Generate deduplication key (hourly buckets to prevent spam)
      const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60)); // Current hour
      const dedupeKey = `${rule.ownerUserId}:${metricData.companyId}:${rule.metric}:${direction}:${hourBucket}`;

      // Check if we've already sent this notification recently
      const existingEvent = await prisma.notificationEvent.findFirst({
        where: { dedupeKey },
        orderBy: { sentAt: "desc" },
      });

      if (existingEvent) {
        logger.debug("Skipping duplicate notification", {
          dedupeKey,
          ruleId: rule.id,
        });
        continue;
      }

      // Queue the notification for delivery
      if (rule.frequency === "INSTANT") {
        await addEmailNotificationJob({
          ruleId: rule.id,
          emails: rule.emails,
          metricData: {
            ...metricData,
            changeValue,
            changePercent,
            direction,
          },
          dedupeKey,
        });
      }
      // DAILY_DIGEST notifications will be handled by the digest worker

      // Log the notification event
      await prisma.notificationEvent.create({
        data: {
          ruleId: rule.id,
          dedupeKey,
          emails: rule.emails,
          emailsSent: [], // Will be updated when emails are sent
          metricData: {
            metric: rule.metric,
            currentValue: metricData.currentValue,
            previousValue: metricData.previousValue,
            companyId: metricData.companyId,
            companyName: metricData.companyName,
            reportRunId: metricData.reportRunId,
            timestamp: metricData.timestamp,
            changeValue,
            changePercent,
            direction,
          },
        },
      });

      logger.info("Notification triggered", {
        ruleId: rule.id,
        metric: rule.metric,
        direction,
        companyId: metricData.companyId,
        changeValue,
        changePercent,
        frequency: rule.frequency,
      });
    }
  }

  /**
   * Create or update notification rules for an account
   */
  async upsertRules(
    ownerUserId: string,
    rules: Partial<EmailNotificationRule>[]
  ): Promise<EmailNotificationRule[]> {
    const prisma = await getDbClient();
    const results: EmailNotificationRule[] = [];

    for (const ruleData of rules) {
      let rule;

      if (ruleData.id) {
        // Update existing rule
        rule = await prisma.notificationRule.update({
          where: { id: ruleData.id, ownerUserId },
          data: {
            metric: ruleData.metric,
            thresholdType: ruleData.thresholdType,
            thresholdValue: ruleData.thresholdValue,
            direction: ruleData.direction,
            frequency: ruleData.frequency,
            emails: ruleData.emails,
            active: ruleData.active ?? true,
            companyId: ruleData.companyId,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new rule
        rule = await prisma.notificationRule.create({
          data: {
            ownerUserId,
            companyId: ruleData.companyId || null,
            metric: ruleData.metric!,
            thresholdType: ruleData.thresholdType!,
            thresholdValue: ruleData.thresholdValue!,
            direction: ruleData.direction!,
            frequency: ruleData.frequency!,
            emails: ruleData.emails!,
            active: ruleData.active ?? true,
          },
        });
      }

      results.push(this.mapPrismaRuleToInterface(rule));
    }

    logger.info("Notification rules updated", {
      ownerUserId,
      rulesProcessed: rules.length,
    });

    return results;
  }

  /**
   * Delete a notification rule
   */
  async deleteRule(ownerUserId: string, ruleId: string): Promise<void> {
    const prisma = await getDbClient();

    await prisma.notificationRule.delete({
      where: { id: ruleId, ownerUserId },
    });

    logger.info("Notification rule deleted", { ownerUserId, ruleId });
  }

  /**
   * Send a test email notification
   */
  async sendTestNotification(
    ownerUserId: string,
    emails: string[]
  ): Promise<void> {
    const testData = {
      metric: "SOV_CHANGE",
      currentValue: 25.5,
      previousValue: 20.0,
      companyId: "test",
      companyName: "Test Company",
      timestamp: new Date(),
      changeValue: 5.5,
      changePercent: 27.5,
      direction: "UP",
    };

    await addEmailNotificationJob({
      ruleId: "test",
      emails,
      metricData: testData,
      dedupeKey: `test-${Date.now()}`,
    });

    logger.info("Test notification queued", { ownerUserId, emails });
  }

  /**
   * Map Prisma result to interface
   */
  private mapPrismaRuleToInterface(rule: any): EmailNotificationRule {
    return {
      id: rule.id,
      ownerUserId: rule.ownerUserId,
      companyId: rule.companyId,
      metric: rule.metric,
      thresholdType: rule.thresholdType,
      thresholdValue: parseFloat(rule.thresholdValue.toString()),
      direction: rule.direction,
      frequency: rule.frequency,
      emails: rule.emails,
      active: rule.active,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}

// Export singleton instance
export const emailNotificationService = new EmailNotificationService();
export default emailNotificationService;