#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';

interface PostCompletionIssue {
  runId: string;
  companyName: string;
  issue: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
  createdAt: Date;
}

async function monitorPostCompletionIssues(): Promise<void> {
  const prisma = await getDbClient();
  console.log('🔍 Monitoring post-completion processing issues...\n');

  const issues: PostCompletionIssue[] = [];

  try {
    // 1. Check for reports that were initially COMPLETED but later marked FAILED
    console.log('📊 Checking for reports marked as failed after completion...');
    
    const suspiciousReports = await prisma.reportRun.findMany({
      where: {
        status: 'FAILED',
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      include: {
        company: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    for (const report of suspiciousReports) {
      // Check if this report has any successful indicators (like metrics)
      const hasMetrics = await prisma.reportMetric.count({
        where: { reportId: report.id }
      });

      const hasFanoutResponses = await prisma.fanoutResponse.count({
        where: { runId: report.id },
        take: 1
      });

      if (hasMetrics > 0 || hasFanoutResponses > 0) {
        issues.push({
          runId: report.id,
          companyName: report.company.name,
          issue: 'Report marked as FAILED but has successful data (metrics/responses)',
          severity: 'HIGH',
          recommendation: 'Check post-completion processing logs. Report likely failed during metrics computation, optimization task generation, or archive scheduling.',
          createdAt: report.createdAt
        });
      }
    }

    // 2. Check for reports missing metrics
    console.log('📈 Checking for completed reports missing metrics...');
    
    const completedReportsWithoutMetrics = await prisma.reportRun.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        },
        reportMetrics: {
          none: {}
        }
      },
      include: {
        company: { select: { name: true } }
      }
    });

    for (const report of completedReportsWithoutMetrics) {
      issues.push({
        runId: report.id,
        companyName: report.company.name,
        issue: 'COMPLETED report missing metrics',
        severity: 'MEDIUM',
        recommendation: 'Run: computeAndPersistMetrics manually for this report. Check database connection and query performance.',
        createdAt: report.createdAt
      });
    }

    // 3. Check for reports missing optimization tasks (first reports only)
    console.log('🎯 Checking for first reports missing optimization tasks...');
    
    const companiesWithFirstReports = await prisma.company.findMany({
      include: {
        runs: {
          where: { status: 'COMPLETED' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          include: {
            optimizationTasks: true
          }
        }
      }
    });

    for (const company of companiesWithFirstReports) {
      const firstReport = company.runs[0];
      if (firstReport && firstReport.optimizationTasks.length === 0) {
        issues.push({
          runId: firstReport.id,
          companyName: company.name,
          issue: 'First report missing optimization tasks',
          severity: 'MEDIUM',
          recommendation: 'Regenerate optimization tasks manually. Check LLM API connectivity and rate limits.',
          createdAt: firstReport.createdAt
        });
      }
    }

    // 4. AI visibility summary monitoring removed - feature no longer needed

    // 5. Check for archive queue failures
    console.log('🗄️ Checking for potential archive queue issues...');
    
    const companiesWithManyReports = await prisma.company.findMany({
      include: {
        runs: {
          where: { status: 'COMPLETED' },
          select: { id: true, createdAt: true }
        }
      }
    });

    for (const company of companiesWithManyReports) {
      if (company.runs.length > 5) {
        // Check if old responses are still present (archive may have failed)
        const oldRunIds = company.runs
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(3) // Skip the 3 most recent
          .map(r => r.id);

        if (oldRunIds.length > 0) {
          const oldResponsesCount = await prisma.fanoutResponse.count({
            where: { runId: { in: oldRunIds } }
          });

          if (oldResponsesCount > 0) {
            issues.push({
              runId: oldRunIds[0],
              companyName: company.name,
              issue: `Company has ${oldResponsesCount} old responses that should have been archived`,
              severity: 'LOW',
              recommendation: 'Check archive worker functionality. Old responses may not be getting cleaned up properly.',
              createdAt: new Date()
            });
          }
        }
      }
    }

    // Display results
    console.log('\n📋 Post-Completion Processing Issues Report');
    console.log('='.repeat(50));

    if (issues.length === 0) {
      console.log('✅ No post-completion processing issues detected!');
    } else {
      // Group by severity
      const highIssues = issues.filter(i => i.severity === 'HIGH');
      const mediumIssues = issues.filter(i => i.severity === 'MEDIUM');
      const lowIssues = issues.filter(i => i.severity === 'LOW');

      if (highIssues.length > 0) {
        console.log('\n🚨 HIGH SEVERITY ISSUES:');
        highIssues.forEach(issue => {
          console.log(`  • ${issue.companyName} (${issue.runId}): ${issue.issue}`);
          console.log(`    💡 ${issue.recommendation}`);
          console.log(`    📅 ${issue.createdAt.toISOString()}\n`);
        });
      }

      if (mediumIssues.length > 0) {
        console.log('\n⚠️  MEDIUM SEVERITY ISSUES:');
        mediumIssues.forEach(issue => {
          console.log(`  • ${issue.companyName} (${issue.runId}): ${issue.issue}`);
          console.log(`    💡 ${issue.recommendation}`);
          console.log(`    📅 ${issue.createdAt.toISOString()}\n`);
        });
      }

      if (lowIssues.length > 0) {
        console.log('\n📝 LOW SEVERITY ISSUES:');
        lowIssues.forEach(issue => {
          console.log(`  • ${issue.companyName} (${issue.runId}): ${issue.issue}`);
          console.log(`    💡 ${issue.recommendation}`);
          console.log(`    📅 ${issue.createdAt.toISOString()}\n`);
        });
      }

      console.log(`\n📊 Summary: ${issues.length} total issues found`);
      console.log(`   🚨 High: ${highIssues.length}`);
      console.log(`   ⚠️  Medium: ${mediumIssues.length}`);
      console.log(`   📝 Low: ${lowIssues.length}`);
    }

    // Suggest next steps
    if (issues.length > 0) {
      console.log('\n🔧 Recommended Actions:');
      console.log('1. Review the improved error handling in reportWorker.ts');
      console.log('2. Check application logs for specific error messages');
      console.log('3. Monitor database performance and connection stability');
      console.log('4. Verify LLM API connectivity and rate limits');
      console.log('5. Ensure Redis/queue system is functioning properly');
    }

  } catch (error) {
    console.error('❌ Error during monitoring:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the monitoring if called directly
if (require.main === module) {
  monitorPostCompletionIssues()
    .then(() => {
      console.log('\n✅ Monitoring complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Monitoring failed:', error);
      process.exit(1);
    });
}

export default monitorPostCompletionIssues; 