/**
 * @file app.ts
 * @description This file initializes the Express application and configures middleware, routes, and error handling.
 * It serves as the main entry point for the backend server.
 *
 * @dependencies
 * - express: Framework for building the web application.
 * - cors: Middleware for enabling Cross-Origin Resource Sharing.
 * - morgan: Middleware for logging HTTP requests.
 * - dotenv: For loading environment variables from a .env file.
 * - cookie-parser: Middleware for parsing cookies.
 * - helmet: Middleware for securing the app by setting various HTTP headers.
 * - express-rate-limit: Middleware for rate limiting requests.
 * - passport: Authentication middleware for Node.js.
 * - @prisma/client: Prisma client for database interaction.
 *
 * @internal_dependencies
 * - ./config/passport: Passport.js authentication strategies.
 * - ./routes/authRoutes: Routes for authentication.
 * - ./routes/companyRoutes: Routes for company data.
 * - ./routes/paymentRoutes: Routes for payment processing.
 * - ./routes/reportRoutes: Routes for reports.
 * - ./routes/searchRoutes: Routes for search functionality.
 * - ./routes/userRoutes: Routes for user management.
 * - ./routes/blogRoutes: Routes for blog content.
 * - ./middleware/authMiddleware: Middleware for authenticating protected routes.
 * - ./config/env: Environment variable configuration.
 * - ./config/db: Singleton Prisma client instance.
 * - ./controllers/paymentController: Controller for handling Stripe webhooks.
 */
import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import passport from "./config/passport";
import authRouter from "./routes/authRoutes";
import companyRouter from "./routes/companyRoutes";
import paymentRouter from "./routes/paymentRoutes";
import reportRouter from "./routes/reportRoutes";
import searchRouter from "./routes/searchRoutes";
import userRouter from "./routes/userRoutes";
import blogRouter from "./routes/blogRoutes";
import { authenticate } from "./middleware/authMiddleware";
import env from "./config/env";
import { PrismaClient } from "@prisma/client";
import { stripeWebhook } from "./controllers/paymentController";
import { dbCache } from "./config/dbCache";

dotenv.config();

const app: Application = express();

// Security headers with helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for Stripe compatibility
  }),
);

// Global rate limiting - DISABLED in test environment
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 0 : 1000, // Disable in test environment
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and in test environment
    return (
      req.path === "/api/health" ||
      req.path === "/api/health/deep" ||
      process.env.NODE_ENV === "test"
    );
  },
});

// Authentication rate limiting (stricter) - DISABLED in test environment
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 0 : 100, // Disable in test environment, increased to industry standard of 100
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === "test";
  },
});

app.use(globalLimiter);

const corsOptions = {
  origin: env.CORS_ORIGIN,
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(
  morgan("dev", {
    skip: (req, res) =>
      req.originalUrl === "/api/auth/refresh" && res.statusCode === 401,
  }),
);

// Stripe webhook needs raw body, so we register it before the JSON parser.
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "UP" });
});

app.get("/api/health/deep", async (req: Request, res: Response) => {
  try {
    const dbClient = await dbCache.getPrimaryClient();
    await dbClient.$queryRaw`SELECT 1`;

    // Check for write access
    const result: { transaction_read_only: string }[] =
      await dbClient.$queryRaw`SHOW transaction_read_only;`;
    const isReadOnly = result[0].transaction_read_only === "on";

    if (isReadOnly) {
      return res.status(503).json({
        status: "UP",
        db: "DEGRADED",
        error: "Database connection is read-only. Write operations will fail.",
      });
    }

    res.status(200).json({ status: "UP", db: "UP" });
  } catch (error) {
    res
      .status(503)
      .json({ status: "DOWN", db: "DOWN", error: (error as Error).message });
  }
});

// 10x IMPROVEMENT: Comprehensive health check endpoint
app.get("/healthz", async (req, res) => {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  
  try {
    // Database health
    try {
      const { getPrismaClient } = await import("./config/dbCache");
      const prisma = await getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: "healthy", latency: Date.now() - startTime };
    } catch (error) {
      checks.database = { status: "unhealthy", error: (error as Error).message };
    }
    
    // Redis health
    try {
      const { checkRedisHealth } = await import("./config/redis");
      const redisHealth = await checkRedisHealth();
      checks.redis = redisHealth;
    } catch (error) {
      checks.redis = { status: "unhealthy", error: (error as Error).message };
    }
    
    // PydanticAI service health (optional - don't fail overall health if down)
    try {
      const { pydanticLlmService } = await import("./services/pydanticLlmService");
      const providers = pydanticLlmService.getAvailableProviders();
      const healthyProviders = providers.filter(p => p.status === 'available').length;
      checks.pydantic_ai = { status: healthyProviders > 0 ? "healthy" : "degraded", availableProviders: healthyProviders };
    } catch (error) {
      checks.pydantic_ai = { status: "degraded", error: "Service unavailable - first-time reports will fail" };
    }
    
    const allHealthy = checks.database.status === "healthy" && checks.redis.status === "healthy";
    const httpStatus = allHealthy ? 200 : 503;
    
    res.status(httpStatus).json({
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      totalLatency: Date.now() - startTime
    });
    
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// Auth routes (public) with stricter rate limiting
app.use("/api/auth", authLimiter, authRouter);

// Protected routes
app.use("/api/companies", companyRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/reports", reportRouter);
app.use("/api/users", userRouter);
app.use("/api/search", searchRouter);

// Blog routes (mixed public/admin)
app.use("/api/blog", blogRouter);

app.get("/", (req: Request, res: Response) => {
  res.send("Hello from the Serplexity backend!");
});

const main = async () => {
  // Initialize database cache for proper connection pooling
  try {
    console.log("Initializing database cache...");
    await dbCache.initialize();
    console.log("✅ Database cache initialized successfully.");
  } catch (error) {
    console.error("❌ Error initializing database cache:", error);
  }
};

export default app;
