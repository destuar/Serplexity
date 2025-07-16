import { getDbClient } from '../config/database';
import { computeAndPersistMetrics } from '../services/metricsService';

async function main() {
  const prisma = await getDbClient();
  // Fetch the latest completed report run per company
  const latestRuns = await prisma.$queryRawUnsafe<{
    id: string;
    companyId: string;
  }[]>(`
    SELECT DISTINCT ON ("companyId") id, "companyId"
    FROM "ReportRun"
    WHERE status = 'COMPLETED'
    ORDER BY "companyId", "createdAt" DESC
  `);

  console.log(`[RECALC] Found ${latestRuns.length} latest completed runs (one per company).`);

  let success = 0, failed = 0;
  for (const run of latestRuns) {
    try {
      await computeAndPersistMetrics(run.id, run.companyId);
      success++;
      console.log(`[RECALC] Metrics recomputed for run ${run.id}`);
    } catch (err) {
      failed++;
      console.error(`[RECALC] Failed to recompute metrics for run ${run.id}:`, err);
    }
  }

  console.log(`[RECALC] Done. Success: ${success}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('[RECALC] Fatal error:', err);
  const prisma = await getDbClient();
  await prisma.$disconnect();
  process.exit(1);
}); 