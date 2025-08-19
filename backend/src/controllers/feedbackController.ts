/**
 * @file feedbackController.ts
 * @description Controller for handling user feedback submissions.
 * Provides REST API endpoint for submitting feedback to support team.
 *
 * @dependencies
 * - express: HTTP request/response handling
 * - zod: Schema validation for request bodies
 * - ../services/mailerService: Email delivery service
 * - ../utils/logger: Structured logging
 *
 * @exports
 * - submitFeedback: Handle feedback submission requests
 */

import { Request, Response } from "express";
import { z } from "zod";
import { sendFeedbackEmail } from "../services/mailerService";
import logger from "../utils/logger";

// Validation schema for feedback submission
const feedbackSchema = z.object({
  feedback: z.string()
    .min(1, "Feedback cannot be empty")
    .max(10000, "Feedback is too long (maximum 10,000 characters)"),
  source: z.string().optional().default("unknown"),
});

/**
 * Submit user feedback to support team
 */
export const submitFeedback = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Validate request body
    const validationResult = feedbackSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
      return;
    }

    const { feedback, source } = validationResult.data;

    logger.info("Processing feedback submission", {
      userId: user.id,
      userEmail: user.email,
      source,
      feedbackLength: feedback.length,
    });

    // Send feedback email to support team
    await sendFeedbackEmail({
      userEmail: user.email,
      userName: user.name || "Unknown User",
      userId: user.id,
      feedback,
      source,
    });

    logger.info("Feedback email sent successfully", {
      userId: user.id,
      userEmail: user.email,
      source,
    });

    res.json({
      success: true,
      message: "Thank you for your feedback! We've sent it to our support team and will review it shortly.",
    });
  } catch (error) {
    logger.error("Error processing feedback submission", {
      userId: req.user?.id,
      userEmail: req.user?.email,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Failed to submit feedback",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};