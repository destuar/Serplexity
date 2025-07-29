/**
 * @file redisRateLimit.ts
 * @description This file implements a flexible and powerful rate-limiting middleware using Redis.
 * It allows for the creation of multiple rate limiters with different configurations, and it includes features like
 * skipping successful requests and custom key generation. This is a critical component for protecting the application
 * from abuse and ensuring fair usage.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - ../config/redis: The Redis client for storing rate limit data.
 * - ../utils/logger: Logger for application-level logging.
 *
 * @exports
 * - createRedisRateLimit: A factory function for creating new rate limiters.
 * - authLimiter: A pre-configured rate limiter for authentication routes.
 * - apiLimiter: A pre-configured rate limiter for general API routes.
 * - reportLimiter: A pre-configured rate limiter for report generation routes.
 */
import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";
import logger from "../utils/logger";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  message?: string;
}

export function createRedisRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator = (req) => req.ip,
    skipSuccessfulRequests = false,
    message = "Too many requests from this IP, please try again later.",
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `rate_limit:${keyGenerator(req)}`;
      const window = Math.floor(Date.now() / windowMs);
      const redisKey = `${key}:${window}`;

      // Get current count
      const current = await redis.get(redisKey);
      const count = current ? parseInt(current, 10) : 0;

      // Check if limit exceeded
      if (count >= max) {
        return res.status(429).json({
          error: message,
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      // Increment counter
      const newCount = await redis.incr(redisKey);

      // Set expiration on first increment
      if (newCount === 1) {
        await redis.expire(redisKey, Math.ceil(windowMs / 1000));
      }

      // Add rate limit headers
      res.set({
        "X-RateLimit-Limit": max.toString(),
        "X-RateLimit-Remaining": Math.max(0, max - newCount).toString(),
        "X-RateLimit-Reset": new Date(Date.now() + windowMs).toISOString(),
      });

      // Handle skip successful requests
      if (skipSuccessfulRequests) {
        res.on("finish", async () => {
          if (res.statusCode < 400) {
            try {
              await redis.decr(redisKey);
            } catch (error) {
              logger.error("Error decrementing rate limit counter:", { error });
            }
          }
        });
      }

      next();
    } catch (error) {
      logger.error("Redis rate limit error:", { error });
      // Fallback to allowing the request if Redis fails
      next();
    }
  };
}

// Predefined rate limiters
export const authLimiter = createRedisRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window (industry standard)
  skipSuccessfulRequests: true,
  message: "Too many authentication attempts, please try again later.",
});

export const apiLimiter = createRedisRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: "Too many API requests, please try again later.",
});

export const reportLimiter = createRedisRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 report requests per minute
  keyGenerator: (req) => `${req.ip}:${req.user?.id || "anonymous"}`,
  message:
    "Too many report generation requests, please wait before trying again.",
});
