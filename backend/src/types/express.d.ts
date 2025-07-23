/**
 * @file express.d.ts
 * @description This file extends the Express `Request` interface to include a `user` property.
 * This custom type definition ensures that the `req.user` object, populated by authentication middleware,
 * is correctly typed throughout the application, providing better type safety and developer experience.
 *
 * @dependencies
 * - @prisma/client: Prisma client types for `Role`.
 *
 * @exports
 * - Extends Express `Request` interface.
 */
import { Role } from "@prisma/client";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email: string;
      name: string | null;
      role: Role;
      tokenVersion: number;
      subscriptionStatus: string | null;
      stripeCustomerId: string | null;
      trialStartedAt?: Date | null;
      trialEndsAt?: Date | null;
    };
  }
}

// This is needed to make this file a module.
export {};
