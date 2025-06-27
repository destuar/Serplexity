#!/usr/bin/env ts-node

/**
 * Script to cancel stuck reports
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cancelStuckReports(): Promise<void> {
  console.log('🔍 Looking for stuck reports...\n');
  
  const stuckReports = await prisma.reportRun.findMany({
    where: {
      status: 'RUNNING',
      updatedAt: {
        lt: new Date(Date.now() - 5 * 60 * 1000) // Stuck for more than 5 minutes
      }
    },
    include: {
      company: {
        select: { name: true }
      }
    }
  });

  if (stuckReports.length === 0) {
    console.log('✅ No stuck reports found');
    return;
  }

  console.log(`Found ${stuckReports.length} stuck report(s):`);
  
  for (const report of stuckReports) {
    const stuckDuration = Math.round((Date.now() - report.updatedAt.getTime()) / 60000);
    console.log(`📊 ${report.id} (${report.company.name}) - stuck for ${stuckDuration} minutes at "${report.stepStatus}"`);
  }

  console.log('\n🚫 Cancelling stuck reports...');
  
  const result = await prisma.reportRun.updateMany({
    where: {
      id: {
        in: stuckReports.map(r => r.id)
      }
    },
    data: {
      status: 'FAILED',
      stepStatus: 'CANCELLED_STUCK'
    }
  });

  console.log(`✅ Cancelled ${result.count} stuck report(s)`);
  
  // Also clean up any hanging database connections by logging active queries
  console.log('\n🔍 Checking for active database connections...');
  
  try {
    const activeConnections = await prisma.$queryRaw`
      SELECT 
        pid,
        state,
        query_start,
        EXTRACT(EPOCH FROM (now() - query_start)) as duration_seconds,
        LEFT(query, 100) as query_preview
      FROM pg_stat_activity 
      WHERE state != 'idle' 
        AND datname = current_database()
        AND pid != pg_backend_pid()
      ORDER BY query_start
    `;
    
    if (Array.isArray(activeConnections) && activeConnections.length > 0) {
      console.log('Active database connections:');
      activeConnections.forEach((conn: any) => {
        console.log(`  PID ${conn.pid}: ${conn.duration_seconds}s - ${conn.query_preview}`);
      });
    } else {
      console.log('✅ No problematic active connections found');
    }
  } catch (error) {
    console.log('⚠️ Could not check database connections:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Cancellation stopped');
  process.exit(0);
});

// Run the cancellation
cancelStuckReports()
  .then(() => {
    console.log('\n🎉 Done! You can now start a new report to test the fixes.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  }); 