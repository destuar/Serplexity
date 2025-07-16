import { getDbClient } from '../config/database';
import { computeAndPersistMetrics } from '../services/metricsService';

async function main() {
  const prisma = await getDbClient();
  const runs = await prisma.reportRun.findMany({
    where: { status: 'COMPLETED' },
    select: {
      id: true,
      companyId: true,
    },
  });

  console.log(`[METRIC BACKFILL] Found ${runs.length} completed report runs.`);

  let processed = 0;
  for (const run of runs) {
    const existing = await prisma.reportMetric.findFirst({
      where: { reportId: run.id, aiModel: 'all' },
      select: { id: true },
    });
    if (existing) {
      continue; // already has metrics
    }
    try {
      await computeAndPersistMetrics(run.id, run.companyId);
      processed++;
      console.log(`[METRIC BACKFILL] Metrics computed for report ${run.id}`);
    } catch (err) {
      console.error(`[METRIC BACKFILL] Failed for report ${run.id}:`, err);
    }
  }

  console.log(`[METRIC BACKFILL] Completed. ${processed} runs processed.`);
  await prisma.$disconnect();
}

main().catch(async err => {
  console.error('[METRIC BACKFILL] Fatal error:', err);
  const prisma = await getDbClient();
  await prisma.$disconnect();
  process.exit(1);
}); 