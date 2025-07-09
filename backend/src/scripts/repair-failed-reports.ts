#!/usr/bin/env ts-node

import prisma from '../config/db';

interface RepairCandidate {
  runId: string;
  companyName: string;
  hasMetrics: boolean;
  hasResponses: boolean;
  hasOptimizationTasks: boolean;
  createdAt: Date;
}

async function repairFailedReports(dryRun: boolean = true): Promise<void> {
  console.log('🔧 Analyzing reports marked as FAILED that may have completed successfully...\n');

  const candidates: RepairCandidate[] = [];

  try {
    // Find reports marked as FAILED but with successful data
    const failedReports = await prisma.reportRun.findMany({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        company: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${failedReports.length} failed reports in the last 7 days`);

    for (const report of failedReports) {
      // Check for successful indicators
      const [metricsCount, responsesCount, tasksCount] = await Promise.all([
        prisma.reportMetric.count({
          where: { reportId: report.id }
        }),
        prisma.fanoutResponse.count({
          where: { runId: report.id }
        }),
        prisma.visibilityOptimizationTask.count({
          where: { reportRunId: report.id }
        })
      ]);

      // Consider it a repair candidate if it has metrics OR substantial responses
      if (metricsCount > 0 || responsesCount > 10) {
        candidates.push({
          runId: report.id,
          companyName: report.company.name,
          hasMetrics: metricsCount > 0,
          hasResponses: responsesCount > 0,
          hasOptimizationTasks: tasksCount > 0,
          createdAt: report.createdAt
        });
      }
    }

    if (candidates.length === 0) {
      console.log('✅ No reports found that need repair!');
      return;
    }

    console.log(`\n🔍 Found ${candidates.length} reports that appear to have completed successfully but are marked as FAILED:\n`);

    // Display candidates
    candidates.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.companyName} (${candidate.runId})`);
      console.log(`   📅 Created: ${candidate.createdAt.toISOString()}`);
      console.log(`   📊 Has Metrics: ${candidate.hasMetrics ? '✅' : '❌'}`);
      console.log(`   📝 Has Responses: ${candidate.hasResponses ? '✅' : '❌'}`);
      console.log(`   🎯 Has Tasks: ${candidate.hasOptimizationTasks ? '✅' : '❌'}\n`);
    });

    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No changes will be made');
      console.log('To actually repair these reports, run with --repair flag');
      console.log('Command: npm run script repair-failed-reports -- --repair\n');
      
      console.log('🔧 What would be done:');
      console.log('1. Change status from FAILED to COMPLETED');
      console.log('2. Update stepStatus to COMPLETED');
      console.log('3. Set updatedAt to current timestamp');
      
    } else {
      console.log('⚠️  REPAIR MODE - Making changes to the database...\n');
      
      let repairedCount = 0;
      
      for (const candidate of candidates) {
        try {
          await prisma.reportRun.update({
            where: { id: candidate.runId },
            data: {
              status: 'COMPLETED',
              stepStatus: 'COMPLETED',
              updatedAt: new Date()
            }
          });
          
          console.log(`✅ Repaired: ${candidate.companyName} (${candidate.runId})`);
          repairedCount++;
          
        } catch (error) {
          console.error(`❌ Failed to repair ${candidate.runId}:`, error);
        }
      }
      
      console.log(`\n🎉 Successfully repaired ${repairedCount}/${candidates.length} reports`);
      
      if (repairedCount > 0) {
        console.log('\n📝 Next steps:');
        console.log('1. Verify the repaired reports show up correctly in the dashboard');
        console.log('2. Check if any missing post-completion data needs to be regenerated');
        console.log('3. Monitor future reports to ensure the fix prevents this issue');
      }
    }

    // Additional analysis
    console.log('\n📊 Analysis:');
    const withMetrics = candidates.filter(c => c.hasMetrics).length;
    const withResponses = candidates.filter(c => c.hasResponses).length;
    const withTasks = candidates.filter(c => c.hasOptimizationTasks).length;
    
    console.log(`• Reports with metrics: ${withMetrics}/${candidates.length}`);
    console.log(`• Reports with responses: ${withResponses}/${candidates.length}`);
    console.log(`• Reports with optimization tasks: ${withTasks}/${candidates.length}`);
    
    if (withMetrics < candidates.length) {
      console.log('\n💡 Some repaired reports may need metrics computation:');
      console.log('   Run: npm run script backfill-report-metrics');
    }
    
    if (withTasks < candidates.length) {
      console.log('\n💡 Some repaired reports may need optimization tasks:');
      console.log('   Run optimization task generation manually for first reports');
    }

  } catch (error) {
    console.error('❌ Error during repair analysis:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isRepairMode = args.includes('--repair');

// Run the repair if called directly
if (require.main === module) {
  repairFailedReports(!isRepairMode)
    .then(() => {
      console.log('\n✅ Repair analysis complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Repair failed:', error);
      process.exit(1);
    });
}

export default repairFailedReports; 