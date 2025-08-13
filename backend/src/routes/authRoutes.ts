/**
 * @file authRoutes.ts
 * @description This file defines the API routes for authentication, including standard email/password registration and login,
 * token refreshing, and Google OAuth. It integrates with `authController` for business logic and `authMiddleware` for protection.
 * It also includes routes for verifying token validity and admin access.
 *
 * @dependencies
 * - express: The Express framework for creating router instances.
 * - passport: Authentication middleware for Node.js.
 * - jsonwebtoken: For creating and verifying JWTs.
 * - querystring: Node.js module for parsing and formatting URL query strings.
 * - ../controllers/authController: Controllers for authentication logic.
 * - ../middleware/authMiddleware: Middleware for authentication and authorization.
 * - ../config/env: Environment variable configuration.
 * - @prisma/client: Prisma client types.
 *
 * @exports
 * - router: The Express router instance for authentication routes.
 */
import { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import querystring from "querystring";
import { getPrismaClient } from "../config/dbCache";
import env from "../config/env";
import {
  getMe,
  listSessions,
  login,
  logout,
  refresh,
  register,
  revokeSession,
} from "../controllers/authController";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { createUserSession } from "../services/sessionService";
// Import proper Prisma types
import type { Company, User } from "@prisma/client";

const router = Router();
const { JWT_SECRET, JWT_REFRESH_SECRET } = env;

// --- Standard Auth Routes ---
router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", authenticate, logout);

// --- User Info ---
router.get("/me", authenticate, getMe);

// --- Sessions ---
router.get("/sessions", authenticate, listSessions);
router.post("/sessions/:id/revoke", authenticate, revokeSession);

// --- Test & Verification Routes ---
router.get("/verify", authenticate, (req: Request, res: Response) => {
  res.json({ message: "Token is valid", user: req.user });
});

router.get(
  "/verify-admin",
  authenticate,
  authorize("ADMIN"),
  (req: Request, res: Response) => {
    res.json({ message: "Admin access verified", user: req.user });
  }
);

// --- OAuth Routes ---
router.get("/google/url", (req: Request, res: Response) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CALLBACK_URL } = env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CALLBACK_URL) {
    return res.status(500).json({ error: "Google OAuth not configured" });
  }
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_CALLBACK_URL)}&response_type=code&scope=profile%20email&access_type=offline`;
  res.json({ url: authUrl });
});

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${env.FRONTEND_URL}/login?error=google-auth-failed`,
    session: false,
  }),
  async (req: Request, res: Response) => {
    const user = req.user as User & { companies: Company[] };

    if (!user) {
      return res.redirect(
        `${env.FRONTEND_URL}/login?error=authentication-failed`
      );
    }

    const prisma = await getPrismaClient();
    const session = await createUserSession(prisma, {
      userId: user.id,
      userAgent: req.headers["user-agent"] || null,
      ipAddress:
        (req.headers["x-forwarded-for"] as string) ||
        req.socket.remoteAddress ||
        null,
    });

    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: session.id,
    } as const;

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: "7d",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const queryParams = {
      token: accessToken,
    };

    const redirectUrl = `${env.FRONTEND_URL}/oauth-callback?${querystring.stringify(queryParams)}`;
    res.redirect(redirectUrl);
  }
);

export default router;
