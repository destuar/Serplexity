-- Remove the old global unique index on website column
-- This is the final step to fix the company creation issue

DROP INDEX IF EXISTS "Company_website_key";