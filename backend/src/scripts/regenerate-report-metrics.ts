#!/usr/bin/env npx tsx

/**
 * Regenerate ReportMetric entries to use fresh rankings from calculateTopResponses
 * This fixes the bug where pre-computed topQuestions had stale ranking data
 * 
 * Usage: npx tsx src/scripts/regenerate-report-metrics.ts [runId]
 */

import prisma from '../config/db';
import { computeAndPersistMetrics } from '../services/metricsService';

async function regenerateReportMetrics(specificRunId?: string) {
  console.log('[REGENERATE] Starting report metrics regeneration...');

  let whereClause: any = { status: 'COMPLETED' };
  if (specificRunId) {
    whereClause.id = specificRunId;
    console.log(`[REGENERATE] Targeting specific run: ${specificRunId}`);
  } else {
    console.log('[REGENERATE] Targeting all completed reports');
  }

  // Get all completed reports (or specific one)
  const reports = await prisma.reportRun.findMany({
    where: whereClause,
    select: {
      id: true,
      companyId: true,
      createdAt: true,
      company: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`[REGENERATE] Found ${reports.length} reports to regenerate`);

  let successCount = 0;
  let errorCount = 0;

  for (const report of reports) {
    try {
      console.log(`[REGENERATE] Processing report ${report.id} for company "${report.company.name}"...`);
      
      // This will now use the updated calculateTopResponses function
      await computeAndPersistMetrics(report.id, report.companyId);
      
      successCount++;
      console.log(`[REGENERATE] ✅ Successfully regenerated metrics for ${report.id}`);
      
    } catch (error) {
      errorCount++;
      console.error(`[REGENERATE] ❌ Failed to regenerate metrics for ${report.id}:`, error);
    }
  }

  console.log(`[REGENERATE] Complete! Success: ${successCount}, Errors: ${errorCount}`);
}

// Run the script
const args = process.argv.slice(2);
const specificRunId = args[0] || undefined;

regenerateReportMetrics(specificRunId)
  .then(() => {
    console.log('[REGENERATE] Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[REGENERATE] Script failed:', error);
    process.exit(1);
  }); 