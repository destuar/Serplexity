import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach } from '@jest/globals';
// import { masterSchedulerQueue } from '../queues/masterScheduler';

// Mock Redis client


// CRITICAL: Override ALL environment variables for testing
// This prevents tests from accessing production databases and services
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/serplexity_test';
process.env.JWT_SECRET = 'test-jwt-secret-safe-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-safe-for-testing';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Override external API keys with test values
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';
process.env.LOGFIRE_TOKEN = 'test-logfire-token-for-testing';

// Override AWS credentials with test values
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.AWS_REGION = 'us-east-1';
process.env.AWS_BUCKET_NAME = 'test-bucket';
process.env.GLACIER_VAULT_NAME = 'test-vault';
process.env.GLACIER_ACCOUNT_ID = 'test-account-id';

// Override Stripe keys with test values
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake_key_for_testing';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake_webhook_secret';
process.env.STRIPE_MONTHLY_PRICE_ID = 'price_test_monthly';
process.env.STRIPE_ANNUAL_PRICE_ID = 'price_test_annual';

// Override other sensitive configs
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3001/auth/google/callback';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

const prisma = new PrismaClient({
  // Enable query logging in test for debugging
  log: process.env.DEBUG_TESTS === 'true' ? ['query', 'info', 'warn', 'error'] : [],
});

// Setup test database
beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
  
  // Verify we're connected to test database
  const dbName = await prisma.$queryRaw<{database_name: string}[]>`SELECT current_database() as database_name`;
  if (!dbName[0].database_name.includes('test')) {
    throw new Error(`SECURITY ERROR: Not connected to test database! Connected to: ${dbName[0].database_name}`);
  }
  
  console.log(`✅ Connected to test database: ${dbName[0].database_name}`);
  
  // Clean up any existing test data
  await cleanDatabase();
});

beforeEach(async () => {
  // Clean database before each test with retry logic
  await cleanDatabaseWithRetry();
});



async function cleanDatabaseWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await cleanDatabase();
      return;
    } catch (error: any) {
      console.warn(`Database cleanup attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry, with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
}

async function cleanDatabase() {
  try {
    // Use a transaction to ensure atomic cleanup
    await prisma.$transaction(async (tx) => {
      // Get all table names excluding migration table
      const tablenames = await tx.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables 
        WHERE schemaname='public' 
        AND tablename NOT LIKE '_prisma%'
      `;

      if (tablenames.length === 0) {
        return;
      }

      const tables = tablenames
        .map(({ tablename }) => tablename)
        .map(name => `"public"."${name}"`)
        .join(', ');

      // Use TRUNCATE with CASCADE to handle foreign key constraints
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
    });
    
    // Small delay to ensure transaction commits
    await new Promise(resolve => setTimeout(resolve, 50));
    
  } catch (error: any) {
    // If transaction fails, try individual table cleanup
    console.warn('Transaction cleanup failed, trying individual cleanup:', error.message);
    
    try {
      // Clean new fan-out tables first
      await prisma.fanoutMention.deleteMany({});
      await prisma.fanoutResponse.deleteMany({});
      await prisma.fanoutQuestion.deleteMany({});
      // BenchmarkingQuestion remains (user-created)
      await prisma.benchmarkingQuestion.deleteMany({});
      await prisma.competitor.deleteMany({});
      await prisma.company.deleteMany({});
      await prisma.user.deleteMany({});
      
      // Small delay to ensure deletes complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (fallbackError) {
      console.error('Individual cleanup also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Export prisma instance for tests
export { prisma }; 