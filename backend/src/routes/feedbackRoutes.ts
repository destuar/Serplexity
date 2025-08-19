/**
 * @file feedbackRoutes.ts
 * @description Express routes for user feedback submission API.
 * Provides endpoint for users to submit feedback to support team.
 *
 * @dependencies
 * - express: Router and middleware
 * - ../middleware/authMiddleware: JWT authentication
 * - ../controllers/feedbackController: Route handlers
 *
 * @exports
 * - router: Express router with feedback endpoint
 */

import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { submitFeedback } from "../controllers/feedbackController";

const router = Router();

// All feedback routes require authentication
router.use(authenticate);

/**
 * POST /api/feedback
 * Submit user feedback to support team
 * Body: { feedback: string, source?: string }
 */
router.post("/", submitFeedback);

export default router;