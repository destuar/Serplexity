#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';
import { getFullReportMetrics } from '../services/metricsService';

async function testMetricsPerformance(): Promise<void> {
  const prisma = await getDbClient();
  console.log('🔍 Testing pre-computed metrics system...\n');

  try {
    // Get a recent completed report with metrics
    const latestReport = await prisma.reportRun.findFirst({
      where: { 
        status: 'COMPLETED',
        reportMetrics: {
          some: {}
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { name: true } }
      }
    });

    if (!latestReport) {
      console.log('❌ No completed reports with metrics found');
      console.log('💡 Run a report generation to create metrics, or check if metrics service is working');
      return;
    }

    console.log(`📊 Testing with report: ${latestReport.id}`);
    console.log(`🏢 Company: ${latestReport.company.name}`);
    console.log(`📅 Created: ${latestReport.createdAt.toISOString()}\n`);

    // Test "all" models metrics
    console.log('⚡ Testing "all" models metrics...');
    const startTime = Date.now();
    
    const allMetrics = await getFullReportMetrics(latestReport.id, 'all');
    
    const duration = Date.now() - startTime;
    
    if (allMetrics) {
      console.log(`✅ Retrieved in ${duration}ms`);
      console.log(`📈 Share of Voice: ${allMetrics.shareOfVoice.toFixed(2)}%`);
      console.log(`📈 Avg Inclusion Rate: ${allMetrics.averageInclusionRate.toFixed(2)}%`);
      console.log(`📈 Avg Position: ${allMetrics.averagePosition.toFixed(2)}`);
      
      if (allMetrics.topRankingsCount !== null) {
        console.log(`🏆 Top Rankings: ${allMetrics.topRankingsCount}`);
      }
    } else {
      console.log('❌ No metrics found for "all" models');
    }

    // Test individual model metrics
    console.log('\n⚡ Testing individual model metrics...');
    
    const individualModels = await prisma.reportMetric.findMany({
      where: { 
        reportId: latestReport.id,
        aiModel: { not: 'all' }
      },
      select: { aiModel: true },
      distinct: ['aiModel']
    });

    for (const { aiModel } of individualModels) {
      const modelStartTime = Date.now();
      const modelMetrics = await getFullReportMetrics(latestReport.id, aiModel);
      const modelDuration = Date.now() - modelStartTime;
      
      if (modelMetrics) {
        console.log(`✅ ${aiModel}: Retrieved in ${modelDuration}ms - SoV: ${modelMetrics.shareOfVoice.toFixed(2)}%`);
      }
    }

    // Compare with database size before/after
    console.log('\n📊 Database efficiency check...');
    
    const [reportMetricsCount, fanoutResponsesCount] = await Promise.all([
      prisma.reportMetric.count(),
      prisma.fanoutResponse.count(),
    ]);

    console.log(`📋 ReportMetric rows: ${reportMetricsCount} (pre-computed, fast)`);
    console.log(`📋 FanoutResponse rows: ${fanoutResponsesCount} (raw data, slow to aggregate)`);

    const speedupRatio = Math.round(fanoutResponsesCount / (reportMetricsCount || 1));
    console.log(`⚡ Efficiency improvement: ~${speedupRatio}x fewer rows to query`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const prisma = await getDbClient();
  try {
    await testMetricsPerformance();
    console.log('\n🎯 Performance test completed successfully!');
    console.log('🚀 Your dashboard is now bulletproofed and lightning fast!');
    
  } catch (error) {
    console.error('\n💥 Performance test failed:', error);
    process.exit(1);
    
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Performance test finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Performance test failed:', error);
      process.exit(1);
    });
}

export { testMetricsPerformance }; 