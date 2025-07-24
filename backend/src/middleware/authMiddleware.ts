/**
 * @file authMiddleware.ts
 * @description This file contains the core authentication and authorization middleware for the application.
 * The `authenticate` function verifies JSON Web Tokens (JWTs) and attaches the user to the request object, while the `authorize`
 * function checks if the user has the required role to access a specific route. This is a critical component for securing the
 * application and controlling access to resources.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - jsonwebtoken: For creating and verifying JWTs.
 * - @prisma/client: The Prisma client for database interactions.
 * - ../config/env: Environment variable configuration.
 * - ../config/db: The singleton Prisma client instance.
 *
 * @exports
 * - authenticate: Middleware for authenticating users via JWT.
 * - authorize: Middleware for authorizing users based on their role.
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import env from "../config/env";
import { getPrismaClient } from "../config/dbCache";

const { JWT_SECRET } = env;

interface JwtPayload {
  userId: string;
  tokenVersion?: number;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const prisma = await getPrismaClient();
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Authorization header missing or incorrect format" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tokenVersion: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        trialStartedAt: true,
        trialEndsAt: true,
        companies: { include: { competitors: true } },
      },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not have the required role" });
    }
    next();
  };
};
