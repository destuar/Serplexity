/**
 * @file emailNotificationController.ts
 * @description Controllers for managing email notification rules and settings.
 * Provides REST API endpoints for creating, updating, and testing email notifications.
 *
 * @dependencies
 * - express: HTTP request/response handling
 * - zod: Schema validation for request bodies
 * - ../services/emailNotificationService: Core notification logic
 * - ../middleware/authMiddleware: Authentication verification
 * - ../utils/logger: Structured logging
 *
 * @exports
 * - getRules: Fetch notification rules for account
 * - upsertRules: Create or update notification rules
 * - deleteRule: Remove a notification rule
 * - sendTestNotification: Send test email notification
 */

import { Request, Response } from "express";
import { z } from "zod";
import emailNotificationService from "../services/emailNotificationService";
import logger from "../utils/logger";

// Validation schemas
const emailArraySchema = z.array(z.string().email("Invalid email address")).min(1, "At least one email is required");

const notificationRuleSchema = z.object({
  id: z.string().optional(), // For updates
  companyId: z.string().nullable().optional(), // null for all companies
  metric: z.enum(["RANKING", "SOV_CHANGE", "INCLUSION_RATE", "SENTIMENT_SCORE"]),
  thresholdType: z.enum(["ABSOLUTE", "PERCENT"]),
  thresholdValue: z.number().min(0, "Threshold value must be positive"),
  direction: z.enum(["UP", "DOWN", "BETTER", "WORSE", "ANY"]),
  frequency: z.enum(["INSTANT", "DAILY_DIGEST"]),
  emails: emailArraySchema,
  active: z.boolean().optional().default(true),
});

const upsertRulesSchema = z.object({
  rules: z.array(notificationRuleSchema).min(1, "At least one rule is required"),
});

const testNotificationSchema = z.object({
  emails: emailArraySchema,
});

/**
 * Get notification rules for the authenticated user's account
 */
export const getRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerUserId = req.user!.id;
    const companyId = req.query.companyId as string | undefined;

    // Validate companyId if provided
    if (companyId && typeof companyId !== "string") {
      res.status(400).json({
        error: "Invalid companyId parameter",
      });
      return;
    }

    logger.info("Fetching notification rules", { ownerUserId, companyId });

    const rules = await emailNotificationService.loadAccountRules(
      ownerUserId,
      companyId
    );

    res.json({
      rules,
      total: rules.length,
    });
  } catch (error) {
    logger.error("Error fetching notification rules", {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Failed to fetch notification rules",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Create or update notification rules for the authenticated user's account
 */
export const upsertRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerUserId = req.user!.id;

    // Validate request body
    const validationResult = upsertRulesSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
      return;
    }

    const { rules } = validationResult.data;

    logger.info("Upserting notification rules", {
      ownerUserId,
      rulesCount: rules.length,
    });

    // Validate rule combinations and business logic
    for (const rule of rules) {
      // Validate direction for ranking metrics
      if (rule.metric === "RANKING" && !["BETTER", "WORSE", "ANY"].includes(rule.direction)) {
        res.status(400).json({
          error: "Invalid direction for ranking metric",
          details: "Ranking metrics must use BETTER, WORSE, or ANY direction",
        });
        return;
      }

      // Validate direction for other metrics
      if (rule.metric !== "RANKING" && ["BETTER", "WORSE"].includes(rule.direction)) {
        res.status(400).json({
          error: "Invalid direction for non-ranking metric",
          details: "Only ranking metrics can use BETTER/WORSE direction",
        });
        return;
      }

      // Validate threshold values
      if (rule.thresholdType === "PERCENT" && rule.thresholdValue > 1000) {
        res.status(400).json({
          error: "Invalid percentage threshold",
          details: "Percentage thresholds should be reasonable (typically 0-100%)",
        });
        return;
      }
    }

    const updatedRules = await emailNotificationService.upsertRules(
      ownerUserId,
      rules
    );

    res.json({
      success: true,
      rules: updatedRules,
      total: updatedRules.length,
    });
  } catch (error) {
    logger.error("Error upserting notification rules", {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Failed to update notification rules",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Delete a notification rule
 */
export const deleteRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerUserId = req.user!.id;
    const ruleId = req.params.id;

    if (!ruleId || typeof ruleId !== "string") {
      res.status(400).json({
        error: "Rule ID is required",
      });
      return;
    }

    logger.info("Deleting notification rule", { ownerUserId, ruleId });

    await emailNotificationService.deleteRule(ownerUserId, ruleId);

    res.json({
      success: true,
      message: "Notification rule deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting notification rule", {
      userId: req.user?.id,
      ruleId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
      res.status(404).json({
        error: "Notification rule not found",
      });
      return;
    }

    res.status(500).json({
      error: "Failed to delete notification rule",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Send a test email notification
 */
export const sendTestNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerUserId = req.user!.id;

    // Validate request body
    const validationResult = testNotificationSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
      return;
    }

    const { emails } = validationResult.data;

    logger.info("Sending test notification", {
      ownerUserId,
      emailsCount: emails.length,
    });

    await emailNotificationService.sendTestNotification(ownerUserId, emails);

    res.json({
      success: true,
      message: "Test notification queued successfully",
      details: `Test email will be sent to ${emails.length} recipient(s)`,
    });
  } catch (error) {
    logger.error("Error sending test notification", {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Failed to send test notification",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get notification statistics and recent events
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const ownerUserId = req.user!.id;
    const companyId = req.query.companyId as string | undefined;

    logger.info("Fetching notification stats", { ownerUserId, companyId });

    // This would be expanded to include actual stats from NotificationEvent table
    const stats = {
      totalRules: 0,
      activeRules: 0,
      notificationsSent24h: 0,
      lastNotificationSent: null,
    };

    res.json(stats);
  } catch (error) {
    logger.error("Error fetching notification stats", {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Failed to fetch notification statistics",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};