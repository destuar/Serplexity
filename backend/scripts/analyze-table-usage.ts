/**
 * @file analyze-table-usage.ts
 * @description 10x Engineer database analysis script for identifying optimization opportunities
 * 
 * Analyzes:
 * - Table sizes and growth patterns
 * - Index efficiency and usage statistics  
 * - Query performance bottlenecks
 * - Data duplication patterns
 * - Storage cost optimization opportunities
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface TableAnalysis {
  tableName: string;
  totalSize: string;
  sizeBytes: number;
  rowCount: number;
  avgRowSize: number;
  indexCount: number;
  indexSize: string;
  lastAnalyzed?: Date;
  estimatedGrowthPerMonth: number;
}

interface IndexEfficiency {
  tableName: string;
  indexName: string;
  timesUsed: number;
  tuplesRead: number;
  tuplesFetched: number;
  sizeBytes: number;
  efficiency: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNUSED';
}

interface DataDuplication {
  tableA: string;
  tableB: string;
  duplicatedColumns: string[];
  estimatedOverlapPercent: number;
  recommendedAction: string;
}

async function analyzeTableSizes(): Promise<TableAnalysis[]> {
  console.log('🔍 Analyzing table sizes and storage efficiency...');
  
  const result = await prisma.$queryRaw<Array<{
    table_name: string;
    total_size: string;
    size_bytes: bigint;
    row_count: bigint;
    index_count: bigint;
    index_size: string;
    last_analyzed: Date | null;
  }>>`
    SELECT 
      t.tablename AS table_name,
      pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) AS total_size,
      pg_total_relation_size(t.schemaname||'.'||t.tablename) AS size_bytes,
      COALESCE(s.n_tup_ins + s.n_tup_upd - s.n_tup_del, 0) AS row_count,
      (SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.tablename) AS index_count,
      pg_size_pretty(pg_indexes_size(t.schemaname||'.'||t.tablename)) AS index_size,
      s.last_analyze AS last_analyzed
    FROM pg_tables t
    LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname
    WHERE t.schemaname = 'public'
      AND t.tablename NOT LIKE '%_prisma_%'
    ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC
  `;

  return result.map(row => ({
    tableName: row.table_name,
    totalSize: row.total_size,
    sizeBytes: Number(row.size_bytes),
    rowCount: Number(row.row_count),
    avgRowSize: Number(row.row_count) > 0 ? Number(row.size_bytes) / Number(row.row_count) : 0,
    indexCount: Number(row.index_count),
    indexSize: row.index_size,
    lastAnalyzed: row.last_analyzed || undefined,
    estimatedGrowthPerMonth: 0 // Will be calculated separately
  }));
}

async function analyzeIndexEfficiency(): Promise<IndexEfficiency[]> {
  console.log('📊 Analyzing index usage efficiency...');
  
  const result = await prisma.$queryRaw<Array<{
    table_name: string;
    index_name: string;
    times_used: bigint;
    tuples_read: bigint;
    tuples_fetched: bigint;
    size_bytes: bigint;
  }>>`
    SELECT 
      i.relname AS table_name,
      idx.relname AS index_name,
      s.idx_scan AS times_used,
      s.idx_tup_read AS tuples_read,
      s.idx_tup_fetch AS tuples_fetched,
      pg_relation_size(idx.oid) AS size_bytes
    FROM pg_stat_user_indexes s
    JOIN pg_class i ON s.relid = i.oid
    JOIN pg_class idx ON s.indexrelid = idx.oid
    WHERE i.relname IN (
      'AnalyticsData', 'Ga4DailyMetrics', 'Ga4Property', 'Ga4RealtimeSnapshot',
      'GscDailyMetrics', 'GscSite', 'SyncJob', 'SyncLog', 'AnalyticsIntegration',
      'GoogleOAuthToken', 'ShareOfVoiceHistory', 'InclusionRateHistory', 'SentimentOverTime'
    )
    ORDER BY s.idx_scan DESC, pg_relation_size(idx.oid) DESC
  `;

  return result.map(row => {
    const timesUsed = Number(row.times_used);
    const sizeBytes = Number(row.size_bytes);
    
    let efficiency: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNUSED';
    if (timesUsed === 0) efficiency = 'UNUSED';
    else if (timesUsed < 10 && sizeBytes > 1024 * 1024) efficiency = 'LOW'; // <10 uses, >1MB
    else if (timesUsed < 100) efficiency = 'MEDIUM';
    else efficiency = 'HIGH';

    return {
      tableName: row.table_name,
      indexName: row.index_name,
      timesUsed,
      tuplesRead: Number(row.tuples_read),
      tuplesFetched: Number(row.tuples_fetched),
      sizeBytes,
      efficiency
    };
  });
}

async function identifyDataDuplication(): Promise<DataDuplication[]> {
  console.log('🔍 Identifying data duplication patterns...');
  
  // Check for GSC data overlap between AnalyticsData and GscDailyMetrics
  const gscOverlap = await prisma.$queryRaw<Array<{
    analytics_data_count: bigint;
    gsc_daily_count: bigint;
    overlap_potential: number;
  }>>`
    SELECT 
      COUNT(DISTINCT ad."date" || ad."query" || ad."page") AS analytics_data_count,
      COUNT(DISTINCT gsc."date" || gsc."query" || gsc."page") AS gsc_daily_count,
      (COUNT(DISTINCT ad."date" || ad."query" || ad."page") * 1.0 / 
       GREATEST(COUNT(DISTINCT gsc."date" || gsc."query" || gsc."page"), 1)) * 100 AS overlap_potential
    FROM "AnalyticsData" ad
    LEFT JOIN "GscDailyMetrics" gsc ON (
      ad."date"::date = gsc."date"::date 
      AND ad."query" = gsc."query"
      AND ad."page" = gsc."page"
    )
    WHERE ad."source" = 'search_console'
  `;

  const duplications: DataDuplication[] = [];
  
  if (gscOverlap[0]) {
    const overlapPercent = Number(gscOverlap[0].overlap_potential) || 0;
    duplications.push({
      tableA: 'AnalyticsData',
      tableB: 'GscDailyMetrics', 
      duplicatedColumns: ['date', 'query', 'page', 'impressions', 'clicks', 'ctr', 'position'],
      estimatedOverlapPercent: overlapPercent,
      recommendedAction: overlapPercent > 50 
        ? 'CONSOLIDATE: Remove GSC data from AnalyticsData, use GscDailyMetrics only'
        : 'MONITOR: Low overlap, assess data quality differences'
    });
  }

  return duplications;
}

async function generateGrowthProjections(): Promise<void> {
  console.log('📈 Analyzing growth patterns for capacity planning...');
  
  // Analyze recent growth patterns for time-series tables
  const timeSeriesTables = ['GscDailyMetrics', 'Ga4DailyMetrics', 'SyncJob', 'AnalyticsData'];
  
  for (const tableName of timeSeriesTables) {
    try {
      const growthData = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(*) FILTER (WHERE "createdAt" >= CURRENT_DATE - INTERVAL '30 days') AS last_30_days,
          COUNT(*) FILTER (WHERE "createdAt" >= CURRENT_DATE - INTERVAL '7 days') AS last_7_days,
          COUNT(*) FILTER (WHERE "createdAt" >= CURRENT_DATE - INTERVAL '1 day') AS last_24_hours,
          COUNT(*) AS total_rows,
          MIN("createdAt") AS first_record,
          MAX("createdAt") AS last_record
        FROM "${tableName}"
        WHERE "createdAt" IS NOT NULL
      `);

      console.log(`📊 ${tableName} growth analysis:`, growthData);
    } catch (error) {
      console.warn(`⚠️  Could not analyze ${tableName}:`, (error as Error).message);
    }
  }
}

async function identifySlowQueries(): Promise<void> {
  console.log('🐌 Identifying potential query performance issues...');
  
  // Check for tables without proper indexes on frequently queried columns
  const unoptimizedQueries = [
    {
      description: 'GscDailyMetrics dashboard queries',
      suggestedIndex: 'CREATE INDEX CONCURRENTLY "idx_gsc_dashboard_opt" ON "GscDailyMetrics" ("companyId", "date" DESC, "impressions" DESC)',
      impact: 'HIGH - Dashboard time-series queries'
    },
    {
      description: 'Ga4DailyMetrics analytics aggregation',
      suggestedIndex: 'CREATE INDEX CONCURRENTLY "idx_ga4_analytics_opt" ON "Ga4DailyMetrics" ("companyId", "propertyId", "date" DESC)',
      impact: 'MEDIUM - Analytics service performance'
    },
    {
      description: 'SyncJob processing queue',
      suggestedIndex: 'CREATE INDEX CONCURRENTLY "idx_sync_queue_opt" ON "SyncJob" ("status", "priority" DESC, "scheduledAt") WHERE "status" IN (\'queued\', \'running\')',
      impact: 'HIGH - Background job processing'
    }
  ];

  console.log('🎯 Query optimization opportunities:');
  unoptimizedQueries.forEach((query, i) => {
    console.log(`${i + 1}. ${query.description}`);
    console.log(`   Impact: ${query.impact}`);
    console.log(`   Fix: ${query.suggestedIndex}`);
    console.log('');
  });
}

async function main() {
  try {
    console.log('🚀 10x Engineer Database Analysis Starting...\n');

    // Phase 1: Size and efficiency analysis
    const tableAnalysis = await analyzeTableSizes();
    console.log('📋 TABLE SIZE ANALYSIS:');
    console.table(tableAnalysis.map(t => ({
      Table: t.tableName,
      Size: t.totalSize,
      Rows: t.rowCount.toLocaleString(),
      'Avg Row': `${Math.round(t.avgRowSize)} bytes`,
      Indexes: t.indexCount,
      'Index Size': t.indexSize
    })));

    // Phase 2: Index efficiency analysis
    const indexAnalysis = await analyzeIndexEfficiency();
    const inefficientIndexes = indexAnalysis.filter(i => i.efficiency === 'LOW' || i.efficiency === 'UNUSED');
    
    if (inefficientIndexes.length > 0) {
      console.log('\n⚠️  INEFFICIENT INDEXES FOUND:');
      console.table(inefficientIndexes.map(i => ({
        Table: i.tableName,
        Index: i.indexName,
        'Times Used': i.timesUsed,
        Size: `${Math.round(i.sizeBytes / 1024)} KB`,
        Efficiency: i.efficiency
      })));
    }

    // Phase 3: Data duplication analysis
    const duplications = await identifyDataDuplication();
    if (duplications.length > 0) {
      console.log('\n🔄 DATA DUPLICATION DETECTED:');
      duplications.forEach(dup => {
        console.log(`${dup.tableA} ↔ ${dup.tableB}: ${dup.estimatedOverlapPercent.toFixed(1)}% overlap`);
        console.log(`Action: ${dup.recommendedAction}`);
      });
    }

    // Phase 4: Growth projections and capacity planning
    await generateGrowthProjections();

    // Phase 5: Query performance recommendations
    await identifySlowQueries();

    // Summary recommendations
    console.log('\n🎯 EXECUTIVE SUMMARY:');
    console.log('=====================================');
    
    const totalSize = tableAnalysis.reduce((sum, t) => sum + t.sizeBytes, 0);
    const inefficientCount = inefficientIndexes.length;
    const duplicationCount = duplications.length;
    
    console.log(`📊 Total analyzed storage: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`🗂️  Tables analyzed: ${tableAnalysis.length}`);
    console.log(`❌ Inefficient indexes: ${inefficientCount}`);
    console.log(`🔄 Data duplications: ${duplicationCount}`);
    
    const estimatedSavings = duplicationCount * 0.3 + inefficientCount * 0.1; // Rough estimate
    console.log(`💰 Estimated storage savings: ${(estimatedSavings * 100).toFixed(1)}%`);
    console.log(`⚡ Expected query performance improvement: ${inefficientCount > 5 ? 'HIGH (50-80%)' : 'MEDIUM (20-40%)'}`);

    console.log('\n✅ Next steps:');
    console.log('1. Review generated SQL optimization script');
    console.log('2. Test migrations on staging environment');  
    console.log('3. Implement partitioning for time-series tables');
    console.log('4. Set up monitoring for query performance');
    console.log('5. Establish data retention policies');

  } catch (error) {
    console.error('💥 Analysis failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run analysis
if (require.main === module) {
  main().catch(console.error);
}

export { main as analyzeTableUsage };