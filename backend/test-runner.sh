#!/bin/bash

# 10x Engineer Report Testing Script
# Sets up minimal test environment and runs report generation tests

export NODE_ENV=test
export DATABASE_URL="postgresql://$(whoami)@localhost:5432/serplexity_test"
export TEST_DATABASE_URL="postgresql://$(whoami)@localhost:5432/serplexity_test"

# Minimal test environment variables
export JWT_SECRET="test-jwt-secret-safe-for-testing"
export JWT_REFRESH_SECRET="test-refresh-secret-safe-for-testing"
export CORS_ORIGIN="http://localhost:3000"

# Test API keys
export OPENAI_API_KEY="test-openai-key"
export GEMINI_API_KEY="test-gemini-key"
export ANTHROPIC_API_KEY="test-anthropic-key"
export PERPLEXITY_API_KEY="test-perplexity-key"

# Test Stripe keys
export STRIPE_SECRET_KEY="sk_test_fake_key_for_testing"
export STRIPE_PUBLISHABLE_KEY="pk_test_fake_key_for_testing"
export STRIPE_WEBHOOK_SECRET="whsec_test_fake_webhook_secret"
export STRIPE_MONTHLY_PRICE_ID="price_test_monthly"
export STRIPE_ANNUAL_PRICE_ID="price_test_annual"

# Other test configs
export GOOGLE_CLIENT_ID="test-google-client-id"
export GOOGLE_CLIENT_SECRET="test-google-client-secret"
export DISABLE_LOGFIRE="1"

echo "🚀 Running Report Generation Tests with Local Database"
echo "Database: $DATABASE_URL"

# Run the specific test
npx jest src/__tests__/report.test.ts --testTimeout=60000 --verbose