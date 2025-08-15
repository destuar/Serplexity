/**
 * @file emailNotificationRoutes.ts
 * @description Express routes for email notification management API.
 * Provides endpoints for managing notification rules, testing, and viewing statistics.
 *
 * @dependencies
 * - express: Router and middleware
 * - ../middleware/authMiddleware: JWT authentication
 * - ../controllers/emailNotificationController: Route handlers
 *
 * @exports
 * - router: Express router with notification endpoints
 */

import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import {
  getRules,
  upsertRules,
  deleteRule,
  sendTestNotification,
  getStats,
} from "../controllers/emailNotificationController";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

/**
 * GET /api/notifications/rules
 * Fetch notification rules for the authenticated user's account
 * Query params:
 * - companyId (optional): Filter rules for specific company, or omit for all rules
 */
router.get("/rules", getRules);

/**
 * PUT /api/notifications/rules
 * Create or update notification rules
 * Body: { rules: NotificationRule[] }
 */
router.put("/rules", upsertRules);

/**
 * DELETE /api/notifications/rules/:id
 * Delete a specific notification rule
 * Params:
 * - id: Rule ID to delete
 */
router.delete("/rules/:id", deleteRule);

/**
 * POST /api/notifications/test
 * Send a test email notification
 * Body: { emails: string[] }
 */
router.post("/test", sendTestNotification);

/**
 * GET /api/notifications/stats
 * Get notification statistics and recent activity
 * Query params:
 * - companyId (optional): Filter stats for specific company
 */
router.get("/stats", getStats);

export default router;