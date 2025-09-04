-- ===============================================
-- 10x Engineer Index Creation - Individual Commands
-- Production-Safe Concurrent Index Creation
-- ===============================================

-- CONCURRENT indexes must be created outside transactions
-- Each command can be run independently for zero-downtime deployment

-- ===========================================
-- PHASE 1: TIME-SERIES QUERY OPTIMIZATION
-- ===========================================

-- GSC Dashboard Performance (hottest query path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_gsc_dashboard_perf" 
ON "GscDailyMetrics" ("companyId", "date" DESC, "impressions" DESC, "clicks" DESC)
WHERE "impressions" > 0;

-- GSC Query Analysis (covering index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_gsc_query_analysis" 
ON "GscDailyMetrics" ("companyId", "query", "date" DESC) 
WHERE "query" IS NOT NULL;

-- GA4 Dashboard Performance  
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_ga4_dashboard_perf"
ON "Ga4DailyMetrics" ("companyId", "propertyId", "date" DESC, "sessions" DESC);

-- Sync Job Queue Performance (hot path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_sync_queue_hot"
ON "SyncJob" ("status", "priority" DESC, "scheduledAt")
WHERE "status" IN ('queued', 'running');

-- Analytics Integration Status Lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_analytics_integration_status"
ON "AnalyticsIntegration" ("companyId", "status", "integrationName");

-- Dashboard Time-Series Performance  
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_share_voice_dashboard"
ON "ShareOfVoiceHistory" ("companyId", "aiModel", "date" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_inclusion_rate_dashboard"  
ON "InclusionRateHistory" ("companyId", "aiModel", "date" DESC);

-- OAuth Token Lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_oauth_token_lookup"
ON "GoogleOAuthToken" ("companyId", "provider", "revokedAt");