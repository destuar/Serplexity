// CRITICAL: Set test environment variables BEFORE any modules load
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/serplexity_test';
process.env.JWT_SECRET = 'test-jwt-secret-safe-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-safe-for-testing';

// Override ALL production credentials immediately
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fake_key_for_testing';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake_webhook_secret';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.PERPLEXITY_API_KEY = 'test-perplexity-key';

// Prevent dotenv from loading production environment
process.env.DISABLE_DOTENV = 'true';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/src/__tests__/setup.ts',
    '<rootDir>/src/__tests__/globalSetup.ts',
    '<rootDir>/src/__tests__/company.test.ts',
    '<rootDir>/src/__tests__/user.test.ts',
  ],
  transform: {
    '^.+\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/scripts/**',
    '!src/__tests__/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 30000,
  
  // CRITICAL: Run tests serially to prevent database conflicts
  maxWorkers: 1,
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  moduleNameMapper: {
    '^@/(.*)': '<rootDir>/src/$1'
  },
  // Additional security: Clear environment variables that could cause issues
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/teardown.ts'
};