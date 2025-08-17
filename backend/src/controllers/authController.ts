/**
 * @file authController.ts
 * @description This file contains the controllers for handling user authentication, including registration, login, logout, and token refreshing.
 * It uses JSON Web Tokens (JWT) for access and refresh tokens, with the refresh token stored in an HTTP-only cookie for enhanced security.
 * It also provides an endpoint to fetch the current user's data.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - zod: For schema validation of request bodies.
 * - bcrypt: For hashing and comparing passwords.
 * - jsonwebtoken: For creating and verifying JWTs.
 * - @prisma/client: The Prisma client for database interactions.
 * - ../config/env: Environment variable configuration.
 * - ../config/db: The singleton Prisma client instance.
 *
 * @exports
 * - register: Controller for user registration.
 * - login: Controller for user login.
 * - logout: Controller for user logout.
 * - refresh: Controller for refreshing access tokens.
 * - getMe: Controller for fetching the current user's data.
 */
import { Role } from "@prisma/client";
import bcrypt from "bcrypt";
import { Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { getPrismaClient } from "../config/dbCache";
import env from "../config/env";
import {
  findOrCreateUserSession,
  listActiveUserSessions,
  revokeUserSession,
  revokeAllOtherSessions as revokeAllOtherUserSessions,
  updateSessionLastSeen,
  cleanupRevokedSessions,
} from "../services/sessionService";
import logger from "../utils/logger";

const { JWT_SECRET, JWT_REFRESH_SECRET } = env;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

interface JwtPayload {
  userId: string;
  role: Role;
  tokenVersion?: number;
  sessionId?: string;
}

const accessTokenOptions: SignOptions = { expiresIn: "15m" };
const refreshTokenOptions: SignOptions = { expiresIn: "7d" };

export const register = async (req: Request, res: Response) => {
  const prisma = await getPrismaClient();
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Trials removed

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        subscriptionStatus: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tokenVersion: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        trialStartedAt: false,
        trialEndsAt: false,
        companies: { include: { competitors: true } },
      },
    });

    logger.info("User created successfully", {
      userId: user.id,
      email: user.email,
      subscriptionStatus: user.subscriptionStatus,
      trialStartedAt: null,
      trialEndsAt: null,
    });

    // Create a login session on register
    const session = await findOrCreateUserSession(prisma, {
      userId: user.id,
      userAgent: req.headers["user-agent"] || null,
      ipAddress:
        (req.headers["x-forwarded-for"] as string) ||
        req.socket.remoteAddress ||
        null,
    });

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: session.id,
    };
    const accessToken = jwt.sign(payload, JWT_SECRET, accessTokenOptions);
    const refreshToken = jwt.sign(
      payload,
      JWT_REFRESH_SECRET,
      refreshTokenOptions
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        companies: user.companies,
      },
      accessToken,
      sessionId: session.id,
    });
  } catch (error) {
    logger.error("Registration failed", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  const prisma = await getPrismaClient();
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        password: true,
        email: true,
        name: true,
        role: true,
        tokenVersion: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        companies: { include: { competitors: true } },
      },
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Find or create a login session for this device
    const session = await findOrCreateUserSession(prisma, {
      userId: user.id,
      userAgent: req.headers["user-agent"] || null,
      ipAddress:
        (req.headers["x-forwarded-for"] as string) ||
        req.socket.remoteAddress ||
        null,
    });

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
      sessionId: session.id,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, accessTokenOptions);
    const refreshToken = jwt.sign(
      payload,
      JWT_REFRESH_SECRET,
      refreshTokenOptions
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        companies: user.companies,
      },
      accessToken,
      sessionId: session.id,
    });
  } catch (error) {
    logger.error("Login failed", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

export const logout = async (req: Request, res: Response) => {
  const prisma = await getPrismaClient();
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  if (req.user?.id) {
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { tokenVersion: { increment: 1 } },
      });
      // Best-effort: revoke the current session if provided by header
      const sessionId = req.headers["x-session-id"] as string | undefined;
      if (sessionId) {
        await revokeUserSession(prisma, { userId: req.user.id, sessionId });
      }
    } catch (error) {
      // Log error but don't prevent logout
      logger.error("Failed to increment token version on logout", { error });
    }
  }

  res.status(200).json({ message: "Logged out successfully" });
};

export const refresh = async (req: Request, res: Response) => {
  const prisma = await getPrismaClient();
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token not found" });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;

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
        companies: { include: { competitors: true } },
      },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Ensure session validity; gracefully create one if missing for legacy tokens
    let sessionId = payload.sessionId;
    let session = null as null | {
      id: string;
      userId: string;
      revokedAt: Date | null;
    };
    if (sessionId) {
      session = await prisma.userSession.findUnique({
        where: { id: sessionId },
      });
    }
    if (!session || session.userId !== user.id || session.revokedAt) {
      // Use smart session creation that avoids duplicates
      const created = await findOrCreateUserSession(prisma, {
        userId: user.id,
        userAgent: req.headers["user-agent"] || null,
        ipAddress:
          (req.headers["x-forwarded-for"] as string) ||
          req.socket.remoteAddress ||
          null,
      });
      sessionId = created.id;
      session = { id: created.id, userId: user.id, revokedAt: null };
    }
    await updateSessionLastSeen(prisma, session.id);

    // Increment token version to invalidate the used refresh token
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tokenVersion: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        companies: { include: { competitors: true } },
      },
    });

    const newPayload: JwtPayload = {
      userId: updatedUser.id,
      role: updatedUser.role,
      tokenVersion: updatedUser.tokenVersion,
      sessionId,
    };
    const newAccessToken = jwt.sign(newPayload, JWT_SECRET, accessTokenOptions);
    const newRefreshToken = jwt.sign(
      newPayload,
      JWT_REFRESH_SECRET,
      refreshTokenOptions
    );

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        subscriptionStatus: updatedUser.subscriptionStatus,
        stripeCustomerId: updatedUser.stripeCustomerId,
        companies: updatedUser.companies,
      },
      accessToken: newAccessToken,
      sessionId,
    });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
};

export const listSessions = async (req: Request, res: Response) => {
  const prisma = await getPrismaClient();
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  
  const sessions = await listActiveUserSessions(prisma, req.user.id);
  const currentSessionId = req.headers["x-session-id"] as string | undefined;
  
  // Mark the current session
  const sessionsWithCurrent = sessions.map(session => ({
    ...session,
    isCurrent: session.id === currentSessionId
  }));
  
  res.json({ 
    sessions: sessionsWithCurrent,
    totalActive: sessionsWithCurrent.length
  });
};

export const revokeSession = async (req: Request, res: Response) => {
  const prisma = await getPrismaClient();
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.params as { id: string };
  const result = await revokeUserSession(prisma, {
    userId: req.user.id,
    sessionId: id,
  });
  if (!result.ok && result.code === 404)
    return res.status(404).json({ error: "Session not found" });
  res.json({ ok: true });
};

export const revokeAllOtherSessions = async (req: Request, res: Response) => {
  const prisma = await getPrismaClient();
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  
  const currentSessionId = req.headers["x-session-id"] as string | undefined;
  
  const result = await revokeAllOtherUserSessions(prisma, {
    userId: req.user.id,
    currentSessionId
  });
  
  res.json({ 
    message: "All other sessions revoked successfully",
    revokedCount: result.revokedCount 
  });
};

export const cleanupSessions = async (req: Request, res: Response) => {
  const prisma = await getPrismaClient();
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  
  const result = await cleanupRevokedSessions(prisma, req.user.id);
  
  res.json({
    message: "Revoked sessions cleaned up (only revoked sessions >90 days old are removed)",
    ...result
  });
};

export const getMe = async (req: Request, res: Response) => {
  // The user object is attached to the request by the authenticate middleware
  if (req.user) {
    res.status(200).json({ user: req.user });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
};
