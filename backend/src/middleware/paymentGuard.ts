/**
 * @file paymentGuard.ts
 * @description This file contains a middleware to protect routes based on the user's subscription status.
 * It ensures that only users with an active subscription or those with an admin role can access certain features.
 * This is a critical component for enforcing the application's monetization model.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 *
 * @exports
 * - paymentGuard: Middleware for protecting routes based on payment status.
 */
import { NextFunction, Request, Response } from "express";

const ACTIVE_STATUSES = ["active"];

export const paymentGuard = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;

  // Allow admins to bypass the payment guard
  if (user?.role === "ADMIN") {
    return next();
  }

  if (
    !user ||
    !user.subscriptionStatus ||
    !ACTIVE_STATUSES.includes(user.subscriptionStatus)
  ) {
    return res.status(403).json({
      error: "Forbidden: An active subscription is required for this action.",
    });
  }

  next();
};
