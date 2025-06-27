#!/usr/bin/env ts-node

import prisma from '../config/db';

async function validateMetricsSystem(): Promise<void> {
  console.log('🔍 Validating metrics system integrity...\n');

  try {
    // 1. Check database schema integrity
    console.log('📊 Checking database schema...');
    
    const [reportCount, metricCount, reportsWithMetrics] = await Promise.all([
      prisma.reportRun.count({ where: { status: 'COMPLETED' } }),
      prisma.reportMetric.count(),
      prisma.reportRun.count({
        where: {
          status: 'COMPLETED',
          reportMetrics: { some: {} }
        }
      })
    ]);
    
    console.log(`   ✅ Completed reports: ${reportCount}`);
    console.log(`   ✅ Metric records: ${metricCount}`);
    console.log(`   ✅ Reports with metrics: ${reportsWithMetrics}`);
    
    if (reportCount > 0 && reportsWithMetrics === 0) {
      console.log('   ⚠️  Warning: Completed reports exist but no metrics found!');
      console.log('   💡 Run a new report to test metrics generation.');
    }

    // 2. Check metrics coverage per AI model
    console.log('\n🤖 Checking AI model coverage...');
    
    const modelCoverage = await prisma.reportMetric.groupBy({
      by: ['aiModel'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });
    
    modelCoverage.forEach(({ aiModel, _count }) => {
      console.log(`   ✅ ${aiModel}: ${_count.id} metric records`);
    });

    // 3. Check change metrics integrity
    console.log('\n📈 Checking change metrics...');
    
    const [totalMetrics, metricsWithChanges] = await Promise.all([
      prisma.reportMetric.count(),
      prisma.reportMetric.count({
        where: {
          OR: [
            { shareOfVoiceChange: { not: null } },
            { averageInclusionChange: { not: null } },
            { averagePositionChange: { not: null } }
          ]
        }
      })
    ]);
    
    const changePercentage = totalMetrics > 0 ? (metricsWithChanges / totalMetrics) * 100 : 0;
    console.log(`   ✅ Total metrics: ${totalMetrics}`);
    console.log(`   ✅ Metrics with changes: ${metricsWithChanges} (${changePercentage.toFixed(1)}%)`);
    
    if (changePercentage < 30 && totalMetrics > 10) {
      console.log('   ⚠️  Low change coverage - this might indicate an issue');
    }

    // 4. Check for data consistency
    console.log('\n🔄 Checking data consistency...');
    
    const duplicateMetrics = await prisma.reportMetric.groupBy({
      by: ['reportId', 'aiModel'],
      having: { id: { _count: { gt: 1 } } },
      _count: { id: true }
    });
    
    console.log(`   ✅ Duplicate metrics: ${duplicateMetrics.length}`);

    // 5. Check recent activity and performance
    console.log('\n⚡ Checking recent activity...');
    
    const recentReport = await prisma.reportRun.findFirst({
      where: { 
        status: 'COMPLETED',
        reportMetrics: { some: {} }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { name: true } },
        reportMetrics: {
          where: { aiModel: 'all' },
          select: {
            shareOfVoice: true,
            shareOfVoiceChange: true,
            averageInclusionRate: true,
            averagePositionChange: true
          }
        }
      }
    });
    
    if (recentReport) {
      const metric = recentReport.reportMetrics[0];
      console.log(`   ✅ Most recent: ${recentReport.company.name} (${recentReport.createdAt.toISOString()})`);
      
      if (metric) {
        console.log(`   📊 SoV: ${metric.shareOfVoice.toFixed(2)}% (Δ${metric.shareOfVoiceChange?.toFixed(2) || 'N/A'}%)`);
        console.log(`   📊 Inclusion: ${metric.averageInclusionRate.toFixed(2)}%`);
      }
    } else {
      console.log('   ⚠️  No recent reports with metrics found');
    }

    // 6. Performance benchmark
    console.log('\n⚡ Performance benchmark...');
    
    if (recentReport) {
      const startTime = Date.now();
      
      // Simulate dashboard load
      const metrics = await prisma.reportMetric.findUnique({
        where: {
          reportId_aiModel: {
            reportId: recentReport.id,
            aiModel: 'all'
          }
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`   ✅ Metric retrieval: ${duration}ms`);
      
      if (duration > 500) {
        console.log('   ⚠️  Slow metric retrieval - check database performance');
      }
    }

    // 7. Archive system status
    console.log('\n🗄️ Checking archive system...');
    
    const companiesWithMultipleReports = await prisma.company.findMany({
      where: {
        runs: {
          some: {
            status: 'COMPLETED'
          }
        }
      },
      include: {
        runs: {
          where: { status: 'COMPLETED' },
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    let companiesNeedingArchive = 0;
    for (const company of companiesWithMultipleReports) {
      if (company.runs.length > 3) {
        companiesNeedingArchive++;
      }
    }
    
    console.log(`   ✅ Companies with >3 reports: ${companiesNeedingArchive}`);
    if (companiesNeedingArchive > 0) {
      console.log(`   💡 Archive worker should process these automatically`);
    }

    console.log('\n🎯 System Validation Complete!');
    
    // Summary
    const issues: string[] = [];
    
    if (reportCount > 0 && reportsWithMetrics === 0) {
      issues.push('No metrics found for completed reports');
    }
    
    if (duplicateMetrics.length > 0) {
      issues.push(`${duplicateMetrics.length} duplicate metrics`);
    }
    
    if (issues.length === 0) {
      console.log('✅ All systems operational - metrics pipeline is healthy!');
    } else {
      console.log('⚠️  Issues detected:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    await validateMetricsSystem();
    
  } catch (error) {
    console.error('\n💥 Validation failed:', error);
    process.exit(1);
    
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Validation finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { validateMetricsSystem }; 