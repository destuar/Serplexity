/**
 * @file env.ts
 * @description This file is responsible for validating and exporting environment variables for the application.
 * It uses the Zod library to define a schema and ensure that all required environment variables are present and correctly typed.
 * This provides a single source of truth for configuration and prevents runtime errors due to missing or invalid variables.
 *
 * @dependencies
 * - dotenv: For loading environment variables from a .env file.
 * - zod: For schema validation of environment variables.
 * - path: Node.js module for handling file paths.
 *
 * @exports
 * - env: A validated and typed object containing all environment variables.
 */
import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load environment variables from backend/.env
// Prefer process.cwd() so compiled dist resolves to backend/.env, not dist/.env
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

// Define the schema for environment variables
const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("8000"),

  // Database - Legacy environment variables (optional when using cloud secrets)
  DATABASE_URL: z.string().optional(),
  READ_REPLICA_URL: z.string().optional(),

  // Cloud Secrets Configuration
  SECRETS_PROVIDER: z
    .enum(["aws", "azure", "gcp", "environment", "vault"])
    .default("environment"),
  DATABASE_SECRET_NAME: z.string().optional(), // Name of the database secret in the secrets provider
  READ_REPLICA_SECRET_NAME: z.string().optional(), // Name of the read replica secret
  SMTP_SECRET_NAME: z.string().optional(), // Name of the SMTP secret in the secrets provider
  USE_AWS_SECRETS: z
    .string()
    .transform((val) => val === "true")
    .default("false"), // Legacy flag for backward compatibility

  // Redis
  REDIS_HOST: z.string(),
  REDIS_PORT: z.string().transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USE_TLS: z
    .string()
    .transform((val) => val === "true")
    .default("false"),

  // BullMQ
  BULLMQ_QUEUE_PREFIX: z.string().default("serplexity-queue"),

  // Auth
  JWT_SECRET: z.string().min(1, "JWT_SECRET must be a non-empty string"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(1, "JWT_REFRESH_SECRET must be a non-empty string"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // Frontend
  FRONTEND_URL: z.string().url(),
  CORS_ORIGIN: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  STRIPE_MONTHLY_PRICE_ID: z.string(),
  STRIPE_ANNUAL_PRICE_ID: z.string(),

  // AWS
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  AWS_BUCKET_NAME: z.string(),
  GLACIER_VAULT_NAME: z.string(),
  GLACIER_ACCOUNT_ID: z.string(),
  AWS_KMS_KEY_ID: z.string().optional(),

  // LLM Providers
  OPENAI_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),

  // External SERP providers
  SERP_API_KEY: z.string().optional(),

  // Email & Notifications
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z
    .string()
    .transform((val) => (val ? parseInt(val, 10) : 587))
    .optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ADMIN_EMAIL: z.string().email().optional(),

  // Dependency Management
  AUTO_REMEDIATE_DEPENDENCIES: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  DEPENDENCY_CHECK_ENABLED: z
    .string()
    .transform((val) => val === "true")
    .default("true"),
  FAIL_FAST_ON_DEPENDENCIES: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
});

// Validate the environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  // Can't use logger here as env is needed to configure logger
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment variables.");
}

// Additional validation for database configuration
const envData = parsedEnv.data;

// Determine secrets provider (support legacy USE_AWS_SECRETS flag)
let secretsProvider = envData.SECRETS_PROVIDER;

// Support legacy USE_AWS_SECRETS flag
if (envData.USE_AWS_SECRETS && secretsProvider === "environment") {
  secretsProvider = "aws";
}

if (secretsProvider !== "environment") {
  // When using cloud secrets, DATABASE_SECRET_NAME is required
  if (!envData.DATABASE_SECRET_NAME) {
    throw new Error(
      `FATAL ERROR: DATABASE_SECRET_NAME is required when SECRETS_PROVIDER=${secretsProvider}`
    );
  }
  // SMTP_SECRET_NAME is optional - will fall back to environment variables if not provided
  if (envData.SMTP_SECRET_NAME) {
    console.log(
      `✅ Using ${secretsProvider.toUpperCase()} secrets provider for SMTP credentials`
    );
  } else {
    console.log(
      `⚠️ No SMTP_SECRET_NAME configured - will use environment variables for SMTP`
    );
  }
  console.log(
    `✅ Using ${secretsProvider.toUpperCase()} secrets provider for database credentials`
  );
} else {
  // When using environment variables, DATABASE_URL is required
  if (!envData.DATABASE_URL) {
    throw new Error(
      "FATAL ERROR: DATABASE_URL is required when SECRETS_PROVIDER=environment"
    );
  }
  // SMTP environment variables are optional
  if (envData.SMTP_HOST && envData.SMTP_USER && envData.SMTP_PASSWORD && envData.SMTP_FROM_EMAIL) {
    console.log("✅ Using environment variables for SMTP credentials");
  } else {
    console.log("⚠️ SMTP environment variables not fully configured - email features may not work");
  }
  console.log("✅ Using environment variables for database credentials");
}

// Export the validated and typed environment variables with computed secrets provider
const env = { ...envData, COMPUTED_SECRETS_PROVIDER: secretsProvider };

export default env;
