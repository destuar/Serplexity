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
import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { Role } from "@prisma/client";
import env from "../config/env";
import { getPrismaClient } from "../config/dbCache";
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

    // Calculate trial dates for new users
    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        trialStartedAt,
        trialEndsAt,
        subscriptionStatus: "trialing", // Start as trialing
      },
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

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = jwt.sign(payload, JWT_SECRET, accessTokenOptions);
    const refreshToken = jwt.sign(
      payload,
      JWT_REFRESH_SECRET,
      refreshTokenOptions,
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

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion ?? 0,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, accessTokenOptions);
    const refreshToken = jwt.sign(
      payload,
      JWT_REFRESH_SECRET,
      refreshTokenOptions,
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
    };
    const newAccessToken = jwt.sign(newPayload, JWT_SECRET, accessTokenOptions);
    const newRefreshToken = jwt.sign(
      newPayload,
      JWT_REFRESH_SECRET,
      refreshTokenOptions,
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
    });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
};

export const getMe = async (req: Request, res: Response) => {
  // The user object is attached to the request by the authenticate middleware
  if (req.user) {
    res.status(200).json({ user: req.user });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
};
