/**
 * @file freemiumGuard.ts
 * @description Middleware to implement freemium access control with 7-day trial
 * Allows dashboard and competitors access during trial and after expiry
 * Blocks prompts page access after trial expires
 */
import { Request, Response, NextFunction } from "express";

const ACTIVE_SUBSCRIPTION_STATUSES = ["active"];
const _TRIAL_STATUSES = ["trialing"];
const FREE_FEATURES = ["dashboard", "competitors", "overview", "experimental-search"];


/**
 * Check if user's trial is still active
 */
function isTrialActive(user: Request["user"]): boolean {
  if (!user?.trialEndsAt) return false;
  return new Date() < new Date(user.trialEndsAt);
}

/**
 * Check if user has active subscription
 */
function hasActiveSubscription(user: Request["user"]): boolean {
  return Boolean(user?.subscriptionStatus && ACTIVE_SUBSCRIPTION_STATUSES.includes(user.subscriptionStatus));
}

/**
 * Check if the requested feature is free for all users
 */
function isFreeFeature(path: string): boolean {
  return FREE_FEATURES.some(feature => path.includes(feature));
}

/**
 * Middleware for freemium access control
 * Allows:
 * - Admin users: full access
 * - Active subscribers: full access  
 * - Trial users (within 7 days): full access
 * - Expired trial/free users: dashboard, competitors, experimental-search only
 */
export const freemiumGuard = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  const requestPath = req.path.toLowerCase();

  // Allow admins full access
  if (user?.role === "ADMIN") {
    return next();
  }

  // Check if user has active subscription
  if (hasActiveSubscription(user)) {
    return next();
  }

  // Check if user is in active trial period
  if (user?.subscriptionStatus === "trialing" && isTrialActive(user)) {
    return next();
  }

  // For non-subscribers and expired trials, only allow free features
  if (isFreeFeature(requestPath)) {
    return next();
  }

  // Block access to premium features
  return res.status(403).json({
    error: "Premium feature requires subscription",
    message: "Your 7-day trial has expired. Subscribe to access advanced features like prompt management.",
    trialExpired: user?.trialEndsAt ? new Date() >= new Date(user.trialEndsAt) : false,
    trialEndDate: user?.trialEndsAt,
    freeFeatures: FREE_FEATURES,
  });
};

/**
 * Strict subscription guard for premium-only features
 * Used for features that should never be free (like prompts management)
 */
export const subscriptionOnlyGuard = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;

  // Allow admins full access
  if (user?.role === "ADMIN") {
    return next();
  }

  // Check if user has active subscription
  if (hasActiveSubscription(user)) {
    return next();
  }

  // Check if user is in active trial period
  if (user?.subscriptionStatus === "trialing" && isTrialActive(user)) {
    return next();
  }

  // Block all other access
  return res.status(403).json({
    error: "Subscription required",
    message: "This feature requires an active subscription.",
    trialExpired: user?.trialEndsAt ? new Date() >= new Date(user.trialEndsAt) : false,
    trialEndDate: user?.trialEndsAt,
  });
};

/**
 * Get user trial status for frontend
 */
export const getTrialStatus = (user: Request["user"]) => {
  if (!user) return { hasAccess: false, isTrialing: false, trialExpired: true };
  
  const hasSubscription = hasActiveSubscription(user);
  const inActiveTrial = user.subscriptionStatus === "trialing" && isTrialActive(user);
  const trialExpired = user?.trialEndsAt ? new Date() >= new Date(user.trialEndsAt) : false;
  
  return {
    hasAccess: hasSubscription || inActiveTrial,
    isTrialing: user.subscriptionStatus === "trialing",
    trialExpired,
    trialEndDate: user?.trialEndsAt,
    daysRemaining: user?.trialEndsAt ? 
      Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) 
      : 0,
  };
};