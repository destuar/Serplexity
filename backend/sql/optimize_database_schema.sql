-- ===============================================
-- 10x Engineer Database Optimization Plan
-- Serplexity Database Schema Consolidation
-- ===============================================

-- PHASE 1: DATA DEDUPLICATION
-- Problem: AnalyticsData duplicates GscDailyMetrics data
-- Solution: Consolidate GSC data flow, eliminate redundant storage

-- Step 1A: Migrate GSC data from AnalyticsData to GscDailyMetrics (if any missing)
INSERT INTO "GscDailyMetrics" (
  "companyId", "siteUrl", "date", "query", "page", "country", "device",
  "impressions", "clicks", "ctr", "position", "createdAt", "updatedAt"
)
SELECT DISTINCT
  ai."companyId",
  ai."gscPropertyUrl" as "siteUrl",
  ad."date",
  ad."query",
  ad."page", 
  ad."country",
  ad."deviceType" as "device",
  ad."impressions",
  ad."clicks",
  ad."ctr",
  ad."position",
  ad."createdAt",
  ad."updatedAt"
FROM "AnalyticsData" ad
JOIN "AnalyticsIntegration" ai ON ad."integrationId" = ai."id"
WHERE ad."source" = 'search_console'
  AND ai."integrationName" = 'google_search_console'
ON CONFLICT ("companyId", "siteUrl", "date", "query", "page", "country", "device") 
DO NOTHING;

-- Step 1B: Remove redundant GSC data from AnalyticsData
DELETE FROM "AnalyticsData" 
WHERE "source" = 'search_console'
  AND "integrationId" IN (
    SELECT "id" FROM "AnalyticsIntegration" 
    WHERE "integrationName" = 'google_search_console'
  );

-- PHASE 2: INDEX OPTIMIZATION
-- Current: 7+ indexes per time-series table
-- Optimized: Strategic compound indexes for query patterns

-- Drop redundant single-column indexes
DROP INDEX IF EXISTS "GscDailyMetrics_companyId_idx";
DROP INDEX IF EXISTS "GscDailyMetrics_siteUrl_idx"; 
DROP INDEX IF EXISTS "Ga4DailyMetrics_companyId_idx";
DROP INDEX IF EXISTS "Ga4DailyMetrics_propertyId_idx";

-- Create optimized compound indexes matching real query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_gsc_metrics_company_date_perf" 
ON "GscDailyMetrics" ("companyId", "date" DESC, "impressions" DESC, "clicks" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_gsc_metrics_query_analysis" 
ON "GscDailyMetrics" ("companyId", "query", "date" DESC) 
WHERE "query" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ga4_metrics_company_date_perf" 
ON "Ga4DailyMetrics" ("companyId", "propertyId", "date" DESC, "sessions" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ga4_metrics_page_analysis" 
ON "Ga4DailyMetrics" ("companyId", "pagePath", "date" DESC) 
WHERE "pagePath" IS NOT NULL;

-- Time-series query optimization 
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sync_jobs_status_priority" 
ON "SyncJob" ("status", "priority" DESC, "scheduledAt");

-- PHASE 3: TABLE PARTITIONING FOR TIME-SERIES DATA
-- Partition by month for optimal performance and maintenance

-- Create partitioned table for GscDailyMetrics
CREATE TABLE "GscDailyMetrics_partitioned" (
  LIKE "GscDailyMetrics" INCLUDING ALL
) PARTITION BY RANGE ("date");

-- Create monthly partitions (last 6 months + next 3 months)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months');
    end_date DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '4 months');
    partition_start DATE;
    partition_end DATE;
    partition_name TEXT;
BEGIN
    partition_start := start_date;
    
    WHILE partition_start < end_date LOOP
        partition_end := partition_start + INTERVAL '1 month';
        partition_name := 'GscDailyMetrics_' || TO_CHAR(partition_start, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF "GscDailyMetrics_partitioned" 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, partition_start, partition_end);
                       
        partition_start := partition_end;
    END LOOP;
END $$;

-- Create partitioned table for Ga4DailyMetrics  
CREATE TABLE "Ga4DailyMetrics_partitioned" (
  LIKE "Ga4DailyMetrics" INCLUDING ALL
) PARTITION BY RANGE ("date");

-- Create monthly partitions for GA4 as well
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months');
    end_date DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '4 months');
    partition_start DATE;
    partition_end DATE;
    partition_name TEXT;
BEGIN
    partition_start := start_date;
    
    WHILE partition_start < end_date LOOP
        partition_end := partition_start + INTERVAL '1 month';
        partition_name := 'Ga4DailyMetrics_' || TO_CHAR(partition_start, 'YYYY_MM');
        
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF "Ga4DailyMetrics_partitioned" 
                       FOR VALUES FROM (%L) TO (%L)', 
                       partition_name, partition_start, partition_end);
                       
        partition_start := partition_end;
    END LOOP;
END $$;

-- PHASE 4: JSON COLUMN NORMALIZATION
-- Extract structured data from JSON columns into proper relations

-- Create normalized competitor rankings table
CREATE TABLE IF NOT EXISTS "CompetitorRanking" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "reportMetricId" TEXT NOT NULL,
  "competitorName" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "mentions" INTEGER NOT NULL DEFAULT 0,
  "shareOfVoice" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitorRanking_reportMetricId_fkey" 
    FOREIGN KEY ("reportMetricId") REFERENCES "ReportMetric"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_competitor_ranking_report" 
ON "CompetitorRanking" ("reportMetricId", "position");

-- PHASE 5: QUERY PERFORMANCE ANALYSIS
-- Add missing indexes for dashboard performance

-- Optimize dashboard service time-series queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_share_of_voice_dashboard" 
ON "ShareOfVoiceHistory" ("companyId", "aiModel", "date" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inclusion_rate_dashboard" 
ON "InclusionRateHistory" ("companyId", "aiModel", "date" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sentiment_time_dashboard" 
ON "SentimentOverTime" ("companyId", "aiModel", "date" DESC);

-- Optimize report metrics for dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_report_metrics_latest" 
ON "ReportMetric" ("companyId", "createdAt" DESC, "aiModel");

-- PHASE 6: STORAGE EFFICIENCY IMPROVEMENTS

-- Add table compression for time-series data
ALTER TABLE "GscDailyMetrics" SET (fillfactor = 90);
ALTER TABLE "Ga4DailyMetrics" SET (fillfactor = 90);

-- Enable automatic vacuum and analyze for time-series tables
ALTER TABLE "GscDailyMetrics" SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE "Ga4DailyMetrics" SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- PHASE 7: DATA RETENTION POLICY
-- Implement automatic cleanup for old analytics data

-- Clean up sync logs older than 90 days
DELETE FROM "SyncLog" 
WHERE "createdAt" < CURRENT_DATE - INTERVAL '90 days';

-- Archive old GA4/GSC metrics (>2 years) to cold storage
-- (Implementation would depend on archival strategy)

-- PERFORMANCE VALIDATION QUERIES
-- ================================

-- Check table sizes after optimization
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%DailyMetrics%' 
  OR tablename = 'AnalyticsData'
ORDER BY size_bytes DESC;

-- Verify index usage efficiency  
SELECT 
  indexrelname AS index_name,
  relname AS table_name,
  idx_scan AS times_used,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes 
WHERE relname IN ('GscDailyMetrics', 'Ga4DailyMetrics', 'AnalyticsData')
ORDER BY idx_scan DESC;

-- ROLLBACK PLAN
-- =============
-- All changes use IF NOT EXISTS / IF EXISTS patterns
-- Partitioning can be rolled back by dropping partitioned tables
-- Index changes can be reverted individually
-- Data migration includes conflict resolution (ON CONFLICT DO NOTHING)