-- Fix company website unique constraint to allow multiple users per company URL
-- Apply via: ts-node src/scripts/run-with-secrets.ts npx prisma db execute --file /absolute/path/to/fix_company_website_constraint.sql --schema prisma/schema.prisma

-- Step 1: Drop the existing unique constraint on website
ALTER TABLE "Company" DROP CONSTRAINT IF EXISTS "Company_website_key";

-- Step 2: Add composite unique constraint on userId + website
-- This allows multiple users to track the same company website
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_website_key" UNIQUE ("userId", "website");