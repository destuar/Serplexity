-- Email Notifications System Tables
-- Description: Account-level email notification rules and event tracking for GEO metrics
-- Usage: Apply via AWS Secrets wrapper then run npm run generate

-- Notification rules for email alerts on metric changes
CREATE TABLE IF NOT EXISTS "NotificationRule" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "companyId" TEXT REFERENCES "Company"("id") ON DELETE CASCADE, -- null = all companies for this account
  "metric" TEXT NOT NULL CHECK ("metric" IN ('RANKING', 'SOV_CHANGE', 'INCLUSION_RATE', 'SENTIMENT_SCORE')),
  "thresholdType" TEXT NOT NULL CHECK ("thresholdType" IN ('ABSOLUTE', 'PERCENT')),
  "thresholdValue" DECIMAL NOT NULL,
  "direction" TEXT NOT NULL CHECK ("direction" IN ('UP', 'DOWN', 'BETTER', 'WORSE', 'ANY')),
  "frequency" TEXT NOT NULL CHECK ("frequency" IN ('INSTANT', 'DAILY_DIGEST')),
  "emails" TEXT[] NOT NULL, -- Array of email addresses to notify
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Event log for notification delivery and deduplication
CREATE TABLE IF NOT EXISTS "NotificationEvent" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
  "metric" TEXT NOT NULL,
  "currentValue" DECIMAL NOT NULL,
  "previousValue" DECIMAL NOT NULL,
  "direction" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL, -- Format: {ownerUserId}:{companyId}:{metric}:{direction}:{hourBucket}
  "emailsSent" TEXT[], -- Track which emails were successfully sent to
  "ruleId" TEXT REFERENCES "NotificationRule"("id") ON DELETE SET NULL,
  "reportRunId" TEXT, -- Optional reference to the report that triggered this
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "NotificationRule_ownerUserId_idx" ON "NotificationRule"("ownerUserId");
CREATE INDEX IF NOT EXISTS "NotificationRule_ownerUserId_companyId_idx" ON "NotificationRule"("ownerUserId", "companyId");
CREATE INDEX IF NOT EXISTS "NotificationRule_active_idx" ON "NotificationRule"("active") WHERE "active" = true;

CREATE INDEX IF NOT EXISTS "NotificationEvent_ownerUserId_idx" ON "NotificationEvent"("ownerUserId");
CREATE INDEX IF NOT EXISTS "NotificationEvent_dedupeKey_idx" ON "NotificationEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "NotificationEvent_createdAt_idx" ON "NotificationEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "NotificationEvent_companyId_metric_idx" ON "NotificationEvent"("companyId", "metric");

-- Constraint to prevent duplicate active rules for same metric/company
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRule_unique_active_rule" 
ON "NotificationRule"("ownerUserId", "companyId", "metric") 
WHERE "active" = true;

-- Add comment for documentation
COMMENT ON TABLE "NotificationRule" IS 'Account-level email notification rules for GEO metric changes';
COMMENT ON TABLE "NotificationEvent" IS 'Log of notification deliveries with deduplication tracking';

COMMENT ON COLUMN "NotificationRule"."companyId" IS 'Specific company to monitor, or NULL for all companies';
COMMENT ON COLUMN "NotificationRule"."metric" IS 'Metric to monitor: RANKING, SOV_CHANGE, INCLUSION_RATE, SENTIMENT_SCORE';
COMMENT ON COLUMN "NotificationRule"."thresholdType" IS 'ABSOLUTE for direct values, PERCENT for relative changes';
COMMENT ON COLUMN "NotificationRule"."direction" IS 'UP/DOWN for increases/decreases, BETTER/WORSE for ranking, ANY for either';
COMMENT ON COLUMN "NotificationRule"."frequency" IS 'INSTANT for immediate alerts, DAILY_DIGEST for once-daily summaries';

COMMENT ON COLUMN "NotificationEvent"."dedupeKey" IS 'Prevents spam: {ownerUserId}:{companyId}:{metric}:{direction}:{hourBucket}';
COMMENT ON COLUMN "NotificationEvent"."emailsSent" IS 'Array of email addresses that received this notification';