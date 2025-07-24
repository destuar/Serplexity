-- Fix Historical Data Constraints Migration
-- This migration changes unique constraints to preserve all data points instead of overwriting them
-- Changes from (companyId, date, aiModel) to (companyId, reportRunId, aiModel)

-- Step 1: Drop existing problematic unique constraints
ALTER TABLE "ShareOfVoiceHistory" DROP CONSTRAINT IF EXISTS "ShareOfVoiceHistory_companyId_date_aiModel_key";
ALTER TABLE "InclusionRateHistory" DROP CONSTRAINT IF EXISTS "InclusionRateHistory_companyId_date_aiModel_key";  
ALTER TABLE "SentimentOverTime" DROP CONSTRAINT IF EXISTS "SentimentOverTime_companyId_date_aiModel_key";

-- Step 2: Change date column from Date to DateTime for full timestamp precision
-- ShareOfVoiceHistory
ALTER TABLE "ShareOfVoiceHistory" ALTER COLUMN "date" TYPE TIMESTAMP(3);

-- InclusionRateHistory  
ALTER TABLE "InclusionRateHistory" ALTER COLUMN "date" TYPE TIMESTAMP(3);

-- SentimentOverTime
ALTER TABLE "SentimentOverTime" ALTER COLUMN "date" TYPE TIMESTAMP(3);

-- Step 3: Add new unique constraints based on reportRunId (preserves all data points)
ALTER TABLE "ShareOfVoiceHistory" ADD CONSTRAINT "ShareOfVoiceHistory_companyId_reportRunId_aiModel_key" UNIQUE ("companyId", "reportRunId", "aiModel");
ALTER TABLE "InclusionRateHistory" ADD CONSTRAINT "InclusionRateHistory_companyId_reportRunId_aiModel_key" UNIQUE ("companyId", "reportRunId", "aiModel");
ALTER TABLE "SentimentOverTime" ADD CONSTRAINT "SentimentOverTime_companyId_reportRunId_aiModel_key" UNIQUE ("companyId", "reportRunId", "aiModel");

-- Step 4: Add helpful indexes for query performance
CREATE INDEX IF NOT EXISTS "ShareOfVoiceHistory_companyId_date_idx" ON "ShareOfVoiceHistory"("companyId", "date");
CREATE INDEX IF NOT EXISTS "InclusionRateHistory_companyId_date_idx" ON "InclusionRateHistory"("companyId", "date");
CREATE INDEX IF NOT EXISTS "SentimentOverTime_companyId_date_idx" ON "SentimentOverTime"("companyId", "date");