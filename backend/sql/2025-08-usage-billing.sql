-- Idempotent SQL patch to introduce usage-based billing models
-- Safe for re-execution; uses IF NOT EXISTS checks where possible

-- 1) New enums
DO $$ BEGIN
  CREATE TYPE "BillingPeriodState" AS ENUM ('OPEN','INVOICED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BudgetHoldStatus" AS ENUM ('HELD','APPLIED','RELEASED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UsageEventType" AS ENUM ('RESPONSE','SENTIMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Add ReportRun.isOverage
ALTER TABLE IF EXISTS "ReportRun"
  ADD COLUMN IF NOT EXISTS "isOverage" BOOLEAN NOT NULL DEFAULT false;

-- 3) UserBillingSettings
CREATE TABLE IF NOT EXISTS "UserBillingSettings" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "planTier" TEXT NOT NULL,
  "billingInterval" TEXT NOT NULL,
  "stripeCustomerId" TEXT NOT NULL UNIQUE,
  "stripeSubscriptionId" TEXT NULL,
  "currentPeriodStart" TIMESTAMP NULL,
  "currentPeriodEnd" TIMESTAMP NULL,
  "budgetEnabled" BOOLEAN NOT NULL DEFAULT false,
  "overageBudgetCents" INTEGER NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "UserBillingSettings_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- 4) UserBillingPeriod
CREATE TABLE IF NOT EXISTS "UserBillingPeriod" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "periodStart" TIMESTAMP NOT NULL,
  "periodEnd" TIMESTAMP NOT NULL,
  "includedReportsLimit" INTEGER NOT NULL,
  "reportsUsed" INTEGER NOT NULL DEFAULT 0,
  "overageResponseCount" INTEGER NOT NULL DEFAULT 0,
  "overageSentimentCount" INTEGER NOT NULL DEFAULT 0,
  "overageAmountCents" INTEGER NOT NULL DEFAULT 0,
  "subscriptionInvoiceId" TEXT NULL,
  "stripeOverageInvoiceId" TEXT NULL,
  state "BillingPeriodState" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "UserBillingPeriod_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "UserBillingPeriod_user_idx" ON "UserBillingPeriod"("userId");
CREATE INDEX IF NOT EXISTS "UserBillingPeriod_period_idx" ON "UserBillingPeriod"("periodStart","periodEnd");

-- 5) BudgetHold
CREATE TABLE IF NOT EXISTS "BudgetHold" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "billingPeriodId" TEXT NOT NULL,
  "reportRunId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  status "BudgetHoldStatus" NOT NULL DEFAULT 'HELD',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "BudgetHold_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "BudgetHold_period_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "UserBillingPeriod"(id) ON DELETE CASCADE,
  CONSTRAINT "BudgetHold_report_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "BudgetHold_user_idx" ON "BudgetHold"("userId");
CREATE INDEX IF NOT EXISTS "BudgetHold_period_idx" ON "BudgetHold"("billingPeriodId");
CREATE INDEX IF NOT EXISTS "BudgetHold_report_idx" ON "BudgetHold"("reportRunId");

-- 6) UsageEvent
CREATE TABLE IF NOT EXISTS "UsageEvent" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "reportRunId" TEXT NOT NULL,
  "billingPeriodId" TEXT NOT NULL,
  type "UsageEventType" NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  "unitPriceCents" INTEGER NOT NULL,
  "isOverage" BOOLEAN NOT NULL DEFAULT false,
  "occurredAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB NULL,
  CONSTRAINT "UsageEvent_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
  CONSTRAINT "UsageEvent_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE,
  CONSTRAINT "UsageEvent_report_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"(id) ON DELETE CASCADE,
  CONSTRAINT "UsageEvent_period_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "UserBillingPeriod"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "UsageEvent_user_idx" ON "UsageEvent"("userId");
CREATE INDEX IF NOT EXISTS "UsageEvent_company_idx" ON "UsageEvent"("companyId");
CREATE INDEX IF NOT EXISTS "UsageEvent_report_idx" ON "UsageEvent"("reportRunId");
CREATE INDEX IF NOT EXISTS "UsageEvent_period_idx" ON "UsageEvent"("billingPeriodId");
CREATE INDEX IF NOT EXISTS "UsageEvent_type_idx" ON "UsageEvent"(type);
CREATE INDEX IF NOT EXISTS "UsageEvent_time_idx" ON "UsageEvent"("occurredAt");
