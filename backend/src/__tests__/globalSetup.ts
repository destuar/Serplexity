/**
 * Global Test Setup - CRITICAL SECURITY FILE
 * This file ensures tests never access production resources
 */

export default async function globalSetup() {
  // CRITICAL: Override ALL environment variables that could access production
  const testEnvVars = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/serplexity_test",
    JWT_SECRET: "test-jwt-secret-safe-for-testing",
    JWT_REFRESH_SECRET: "test-refresh-secret-safe-for-testing",
    CORS_ORIGIN: "http://localhost:3000",

    // Override ALL external API keys
    OPENAI_API_KEY: "test-openai-key",
    GEMINI_API_KEY: "test-gemini-key",
    ANTHROPIC_API_KEY: "test-anthropic-key",
    PERPLEXITY_API_KEY: "test-perplexity-key",

    // Override AWS credentials
    AWS_ACCESS_KEY_ID: "test-access-key",
    AWS_SECRET_ACCESS_KEY: "test-secret-key",
    AWS_REGION: "us-east-1",
    AWS_BUCKET_NAME: "test-bucket",

    // Override Stripe credentials
    STRIPE_SECRET_KEY: "sk_test_fake_key_for_testing",
    STRIPE_PUBLISHABLE_KEY: "pk_test_fake_key_for_testing",
    STRIPE_WEBHOOK_SECRET: "whsec_test_fake_webhook_secret",
    STRIPE_MONTHLY_PRICE_ID: "price_test_monthly",
    STRIPE_ANNUAL_PRICE_ID: "price_test_annual",

    // Override OAuth credentials
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    GOOGLE_CALLBACK_URL: "http://localhost:8002/api/auth/google/callback",
    FRONTEND_URL: "http://localhost:3000",

    // Override Redis
    REDIS_HOST: "localhost",
    REDIS_PORT: "6379",

    // Disable external services
    DISABLE_DOTENV: "true",
    DISABLE_ANALYTICS: "true",
    ENABLE_MOCK_API: "true",
  };

  // Apply all test environment variables
  Object.entries(testEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  console.log("🔒 Test Environment Secured - Production resources isolated");
  console.log(`📍 Test Database: ${process.env.DATABASE_URL}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET?.substring(0, 20)}...`);
}
