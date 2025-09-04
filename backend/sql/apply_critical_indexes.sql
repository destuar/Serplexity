-- Critical Performance Indexes - Single File Execution
-- Execute via: ts-node src/scripts/run-with-secrets.ts npx prisma db execute --file sql/apply_critical_indexes.sql

-- GSC Dashboard Performance (Primary Bottleneck)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gsc_dashboard_perf 
ON "GscDailyMetrics" ("companyId", "date" DESC, "impressions" DESC) 
WHERE "impressions" > 0;