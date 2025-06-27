-- Add sentimentDetails JSON column to report_metric table
ALTER TABLE "ReportMetric" ADD COLUMN "sentimentDetails" JSONB; 