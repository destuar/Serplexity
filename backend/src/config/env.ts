import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load environment variables from .env file in the backend directory
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });


// Define the schema for environment variables
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8000'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  READ_REPLICA_URL: z.string().optional(),

  // Redis
  REDIS_HOST: z.string(),
  REDIS_PORT: z.string(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USE_TLS: z.string().transform(val => val === 'true').default('false'),

  // BullMQ
  BULLMQ_QUEUE_PREFIX: z.string().default('serplexity-queue'),

  // Auth
  JWT_SECRET: z.string().min(1, 'JWT_SECRET must be a non-empty string'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET must be a non-empty string'),
  JWT_EXPIRES_IN: z.string().default('15m'),
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
  GLACIER_VAULT_NAME: z.string(),

  // LLM Providers
  OPENAI_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
});


// Validate the environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  // Find the specific error for DATABASE_URL for a more direct message
  const dbUrlError = parsedEnv.error.errors.find(e => e.path.includes('DATABASE_URL'));
  if (dbUrlError) {
    throw new Error('FATAL ERROR: DATABASE_URL is not defined.');
  }
  throw new Error('Invalid environment variables.');
}

// Export the validated and typed environment variables
const env = parsedEnv.data;


export default env; 