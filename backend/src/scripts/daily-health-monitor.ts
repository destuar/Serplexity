#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';
import { checkRedisHealth } from '../config/redis';
import { alertingService } from '../services/alertingService';

interface HealthReport {
  timestamp: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  checks: {
    dailyReports: HealthCheck;
    recentFailures: HealthCheck;
    systemComponents: HealthCheck;
    schedulerHealth: HealthCheck;
  };
  recommendations: string[];
  stats: {
    last24Hours: {
      totalReports: number;
      successfulReports: number;
      failedReports: number;
      successRate: number;
    };
    eligibleCompanies: number;
    companiesMissingReports: number;
  };
}

interface HealthCheck {
  status: 'PASS' | 'WARN' | 'FAIL';
  message: string;
  details?: any;
}

/**
 * Comprehensive daily health monitoring script
 * Run this via cron daily to ensure system health
 */
async function performDailyHealthCheck(): Promise<HealthReport> {
  const prisma = await getDbClient();
  console.log('🩺 Starting daily health monitoring...\n');
  const startTime = Date.now();
  
  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    overallStatus: 'HEALTHY',
    checks: {
      dailyReports: { status: 'PASS', message: 'Not checked yet' },
      recentFailures: { status: 'PASS', message: 'Not checked yet' },
      systemComponents: { status: 'PASS', message: 'Not checked yet' },
      schedulerHealth: { status: 'PASS', message: 'Not checked yet' }
    },
    recommendations: [],
    stats: {
      last24Hours: {
        totalReports: 0,
        successfulReports: 0,
        failedReports: 0,
        successRate: 0
      },
      eligibleCompanies: 0,
      companiesMissingReports: 0
    }
  };

  try {
    // 1. Check daily report generation
    console.log('📊 Checking daily report generation...');
    await checkDailyReports(report);

    // 2. Check for recent failures
    console.log('🚨 Checking recent failures...');
    await checkRecentFailures(report);

    // 3. Check system components
    console.log('⚙️ Checking system components...');
    await checkSystemComponents(report);

    // 4. Check scheduler health
    console.log('📅 Checking scheduler health...');
    await checkSchedulerHealth(report);

    // 5. Generate recommendations
    generateRecommendations(report);

    // 6. Determine overall status
    determineOverallStatus(report);

    const duration = Date.now() - startTime;
    console.log(`\n✅ Health check completed in ${duration}ms`);

    return report;

  } catch (error) {
    console.error('❌ Critical error during health check:', error);
    report.overallStatus = 'CRITICAL';
    report.recommendations.push('Critical error occurred during health check - manual investigation required');
    throw error;
  }
}

async function checkDailyReports(report: HealthReport): Promise<void> {
  const prisma = await getDbClient();
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get eligible companies (have at least one completed report)
    const eligibleCompanies = await prisma.company.count({
      where: {
        runs: {
          some: {
            status: 'COMPLETED',
          },
        },
      },
    });

    // Get today's reports
    const todaysReports = await prisma.reportRun.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        company: {
          select: { id: true, name: true }
        }
      }
    });

    const totalReports = todaysReports.length;
    const successfulReports = todaysReports.filter(r => r.status === 'COMPLETED').length;
    const failedReports = todaysReports.filter(r => r.status === 'FAILED').length;
    const runningReports = todaysReports.filter(r => r.status === 'RUNNING' || r.status === 'PENDING').length;

    // Check which companies are missing reports
    const companiesWithReports = new Set(todaysReports.map(r => r.companyId));
    const allEligibleCompanies = await prisma.company.findMany({
      where: {
        runs: {
          some: {
            status: 'COMPLETED',
          },
        },
      },
      select: { id: true, name: true }
    });

    const companiesMissingReports = allEligibleCompanies.filter(c => !companiesWithReports.has(c.id));

    report.stats.last24Hours = {
      totalReports,
      successfulReports,
      failedReports,
      successRate: totalReports > 0 ? (successfulReports / totalReports) * 100 : 0
    };
    report.stats.eligibleCompanies = eligibleCompanies;
    report.stats.companiesMissingReports = companiesMissingReports.length;

    // Determine status
    const successRate = report.stats.last24Hours.successRate;
    const missingReportRate = (companiesMissingReports.length / eligibleCompanies) * 100;

    if (companiesMissingReports.length === 0 && successRate >= 95) {
      report.checks.dailyReports = {
        status: 'PASS',
        message: 'All eligible companies have successful reports today',
        details: { totalReports, successfulReports, successRate: `${successRate.toFixed(1)}%` }
      };
    } else if (missingReportRate <= 10 && successRate >= 80) {
      report.checks.dailyReports = {
        status: 'WARN',
        message: `${companiesMissingReports.length} companies missing reports, ${successRate.toFixed(1)}% success rate`,
        details: { 
          missingCompanies: companiesMissingReports.slice(0, 5).map(c => c.name),
          totalMissing: companiesMissingReports.length,
          successRate: `${successRate.toFixed(1)}%`
        }
      };
    } else {
      report.checks.dailyReports = {
        status: 'FAIL',
        message: `Critical: ${companiesMissingReports.length} companies missing reports, ${successRate.toFixed(1)}% success rate`,
        details: { 
          missingCompanies: companiesMissingReports.slice(0, 10).map(c => c.name),
          totalMissing: companiesMissingReports.length,
          failedReports,
          runningReports,
          successRate: `${successRate.toFixed(1)}%`
        }
      };
    }

  } catch (error) {
    report.checks.dailyReports = {
      status: 'FAIL',
      message: 'Failed to check daily reports',
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

async function checkRecentFailures(report: HealthReport): Promise<void> {
  const prisma = await getDbClient();
  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentFailures = await prisma.reportRun.findMany({
      where: {
        status: 'FAILED',
        createdAt: { gte: last24Hours }
      },
      include: {
        company: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const failureCount = recentFailures.length;
    
    if (failureCount === 0) {
      report.checks.recentFailures = {
        status: 'PASS',
        message: 'No failed reports in the last 24 hours'
      };
    } else if (failureCount <= 3) {
      report.checks.recentFailures = {
        status: 'WARN',
        message: `${failureCount} failed reports in the last 24 hours`,
        details: {
          failures: recentFailures.map(f => ({
            company: f.company.name,
            time: f.createdAt.toISOString(),
            error: f.stepStatus?.substring(0, 100)
          }))
        }
      };
    } else {
      report.checks.recentFailures = {
        status: 'FAIL',
        message: `High failure rate: ${failureCount} failed reports in the last 24 hours`,
        details: {
          failureCount,
          recentFailures: recentFailures.slice(0, 5).map(f => ({
            company: f.company.name,
            time: f.createdAt.toISOString(),
            error: f.stepStatus?.substring(0, 100)
          }))
        }
      };
    }

  } catch (error) {
    report.checks.recentFailures = {
      status: 'FAIL',
      message: 'Failed to check recent failures',
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

async function checkSystemComponents(report: HealthReport): Promise<void> {
  const prisma = await getDbClient();
  try {
    const componentChecks = {
      database: { healthy: false, isHealthy: false, details: {} as any },
      redis: { healthy: false, isHealthy: false, details: {} as any }
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      componentChecks.database = { healthy: true, isHealthy: true, details: { connection: 'OK' } };
    } catch (dbError) {
      componentChecks.database = { 
        healthy: false, 
        isHealthy: false,
        details: { error: dbError instanceof Error ? dbError.message : String(dbError) } 
      };
    }

    // Check Redis
    const redisHealth = await checkRedisHealth();
    componentChecks.redis = { 
      healthy: redisHealth.status === 'healthy',
      isHealthy: redisHealth.status === 'healthy',
      details: redisHealth.error ? { error: redisHealth.error } : { latency: redisHealth.latency }
    };

    const unhealthyComponents = Object.entries(componentChecks)
      .filter(([_, check]) => !check.healthy)
      .map(([name, _]) => name);

    if (unhealthyComponents.length === 0) {
      report.checks.systemComponents = {
        status: 'PASS',
        message: 'All system components are healthy',
        details: componentChecks
      };
    } else {
      report.checks.systemComponents = {
        status: 'FAIL',
        message: `Unhealthy components: ${unhealthyComponents.join(', ')}`,
        details: componentChecks
      };
    }

  } catch (error) {
    report.checks.systemComponents = {
      status: 'FAIL',
      message: 'Failed to check system components',
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

async function checkSchedulerHealth(report: HealthReport): Promise<void> {
  const prisma = await getDbClient();
  try {
    // Check if scheduler has run today
    const today = new Date();
    today.setHours(5, 0, 0, 0); // Daily scheduler runs at 5 AM
    const now = new Date();
    
    // If it's past 6 AM and we haven't seen reports from eligible companies, scheduler might have failed
    if (now.getHours() >= 6) {
      const expectedReports = report.stats.eligibleCompanies;
      const actualReports = report.stats.last24Hours.totalReports;
      const missingReports = report.stats.companiesMissingReports;
      
      if (missingReports === 0) {
        report.checks.schedulerHealth = {
          status: 'PASS',
          message: 'Scheduler appears to be working correctly',
          details: { expectedReports, actualReports }
        };
      } else if (missingReports <= expectedReports * 0.1) { // Less than 10% missing
        report.checks.schedulerHealth = {
          status: 'WARN',
          message: 'Scheduler may have partial issues',
          details: { expectedReports, actualReports, missingReports }
        };
      } else {
        report.checks.schedulerHealth = {
          status: 'FAIL',
          message: 'Scheduler appears to have failed - many companies missing reports',
          details: { expectedReports, actualReports, missingReports }
        };
      }
    } else {
      report.checks.schedulerHealth = {
        status: 'PASS',
        message: 'Too early to assess scheduler health (before 6 AM)',
        details: { currentTime: now.toISOString() }
      };
    }

  } catch (error) {
    report.checks.schedulerHealth = {
      status: 'FAIL',
      message: 'Failed to check scheduler health',
      details: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

function generateRecommendations(report: HealthReport): void {
  const recommendations: string[] = [];

  // Based on daily reports
  if (report.checks.dailyReports.status === 'FAIL') {
    recommendations.push('URGENT: Multiple companies missing daily reports - check scheduler and backup scheduler');
    recommendations.push('Consider running emergency report trigger for missing companies');
  } else if (report.checks.dailyReports.status === 'WARN') {
    recommendations.push('Monitor companies with missing reports - may need manual report generation');
  }

  // Based on recent failures
  if (report.checks.recentFailures.status === 'FAIL') {
    recommendations.push('High failure rate detected - investigate common failure patterns');
    recommendations.push('Check AI model APIs and database connectivity');
  }

  // Based on system components
  if (report.checks.systemComponents.status === 'FAIL') {
    recommendations.push('URGENT: Critical system components are down - immediate attention required');
  }

  // Based on scheduler
  if (report.checks.schedulerHealth.status === 'FAIL') {
    recommendations.push('URGENT: Daily scheduler appears to have failed - check master and backup schedulers');
    recommendations.push('Run manual emergency trigger if scheduler cannot be recovered quickly');
  }

  // Add success rate specific recommendations
  if (report.stats.last24Hours.successRate < 90 && report.stats.last24Hours.totalReports > 0) {
    recommendations.push('Success rate below 90% - review error logs and AI model performance');
  }

  report.recommendations = recommendations;
}

function determineOverallStatus(report: HealthReport): void {
  const statuses = Object.values(report.checks).map(check => check.status);
  
  if (statuses.includes('FAIL')) {
    report.overallStatus = 'CRITICAL';
  } else if (statuses.includes('WARN')) {
    report.overallStatus = 'DEGRADED';
  } else {
    report.overallStatus = 'HEALTHY';
  }
}

async function displayReport(report: HealthReport): Promise<void> {
  const prisma = await getDbClient();
  console.log('\n' + '='.repeat(60));
  console.log('📊 DAILY HEALTH REPORT');
  console.log('='.repeat(60));
  console.log(`🕐 Time: ${report.timestamp}`);
  console.log(`🚦 Overall Status: ${getStatusEmoji(report.overallStatus)} ${report.overallStatus}`);
  
  console.log('\n📈 Statistics:');
  console.log(`   • Eligible Companies: ${report.stats.eligibleCompanies}`);
  console.log(`   • Companies Missing Reports: ${report.stats.companiesMissingReports}`);
  console.log(`   • Reports (24h): ${report.stats.last24Hours.totalReports} total, ${report.stats.last24Hours.successfulReports} successful`);
  console.log(`   • Success Rate: ${report.stats.last24Hours.successRate.toFixed(1)}%`);

  console.log('\n🔍 Health Checks:');
  Object.entries(report.checks).forEach(([name, check]) => {
    console.log(`   ${getStatusEmoji(check.status)} ${name}: ${check.message}`);
  });

  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'PASS':
    case 'HEALTHY': return '✅';
    case 'WARN':
    case 'DEGRADED': return '⚠️';
    case 'FAIL':
    case 'CRITICAL': return '🚨';
    default: return '❓';
  }
}

// Run the health check if called directly
if (require.main === module) {
  performDailyHealthCheck()
    .then(async (report) => {
      await displayReport(report);
      
      // Send alert if system is not healthy
      if (report.overallStatus !== 'HEALTHY') {
        try {
          await alertingService.alertSystemIssue({
            component: 'SCHEDULER',
            message: `Daily health check shows ${report.overallStatus} status`,
            details: {
              overallStatus: report.overallStatus,
              checks: report.checks,
              stats: report.stats,
              recommendations: report.recommendations
            },
            timestamp: new Date()
          });
          console.log('\n📧 Health report alert sent');
        } catch (alertError) {
          console.error('\n❌ Failed to send health report alert:', alertError);
        }
      }
      
      process.exit(report.overallStatus === 'CRITICAL' ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n❌ Health check failed:', error);
      process.exit(1);
    });
}

export { performDailyHealthCheck, type HealthReport };