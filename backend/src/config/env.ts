import dotenv from 'dotenv';

// SECURITY: Never load .env file in test environment or when disabled
if (process.env.NODE_ENV !== 'test' && !process.env.DISABLE_DOTENV) {
  console.log(`[dotenv] Loading .env file for environment: ${process.env.NODE_ENV}`);
  const dotenvResult = dotenv.config();

  if (dotenvResult.error) {
    const error = dotenvResult.error as NodeJS.ErrnoException;
    // In development, a missing .env file might not be a fatal error,
    // as developers might set variables manually.
    if (process.env.NODE_ENV !== 'production' && error.code === 'ENOENT') {
      console.warn('[dotenv] .env file not found. Set environment variables manually or create a .env file.');
    } else {
      console.error('[dotenv] Error loading .env file:', dotenvResult.error);
    }
  } else {
    console.log('[dotenv] .env file loaded successfully. Parsed variables:', Object.keys(dotenvResult.parsed || {}));
  }
} else if (process.env.NODE_ENV === 'test') {
  console.log('[dotenv] SKIPPED loading .env file in test environment for security');
} else if (process.env.DISABLE_DOTENV) {
  console.log('[dotenv] DISABLED by DISABLE_DOTENV flag');
}

console.log('[env.ts] Reading GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL);
console.log('[env.ts] Reading FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('[env.ts] Reading CORS_ORIGIN:', process.env.CORS_ORIGIN);
console.log('[env.ts] Reading NODE_ENV:', process.env.NODE_ENV);

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 8001,
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-key',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL,
  
  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  // IMPORTANT: Set this to your production domain in production
  // Example: https://yourdomain.com/api/auth/google/callback
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8001/api/auth/google/callback',

  // Frontend URL - CRITICAL: Must be set to production domain in production
  // Example: https://yourdomain.com
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID,
  STRIPE_ANNUAL_PRICE_ID: process.env.STRIPE_ANNUAL_PRICE_ID,

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Additional LLM Providers
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
};

// Validate that essential variables are set
if (!env.DATABASE_URL) {
  throw new Error('FATAL ERROR: DATABASE_URL is not defined.');
}
if (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL ERROR: JWT secrets are not defined.');
}
if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_MONTHLY_PRICE_ID || !env.STRIPE_ANNUAL_PRICE_ID) {
    throw new Error('FATAL ERROR: Stripe environment variables are not fully configured.');
}
if (!env.OPENAI_API_KEY) {
    throw new Error('FATAL ERROR: OPENAI_API_KEY is not defined.');
}

// For now, let's make the new keys optional and add warnings if they are missing
if (!env.ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY is not defined. Anthropic models will not be available.');
}
if (!env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not defined. Gemini models will not be available.');
}
if (!env.PERPLEXITY_API_KEY) {
  console.warn('WARNING: PERPLEXITY_API_KEY is not defined. Perplexity models will not be available.');
}


// Production warnings
if (env.NODE_ENV === 'production') {
  if (env.FRONTEND_URL.includes('localhost')) {
    console.warn('WARNING: FRONTEND_URL still contains localhost in production!');
  }
  if (env.GOOGLE_CALLBACK_URL?.includes('localhost')) {
    console.warn('WARNING: GOOGLE_CALLBACK_URL still contains localhost in production!');
  }
  if (env.CORS_ORIGIN.includes('localhost')) {
    console.warn('WARNING: CORS_ORIGIN still contains localhost in production!');
  }
}

export default env; 