#!/usr/bin/env ts-node

/**
 * Backfill AI Visibility summary and optimization tasks for the latest completed report
 * for every company in the database.
 *
 * Usage: ts-node backfill-optimization-tasks.ts
 *
 * The script will:
 * 1. Retrieve every company.
 * 2. For each company, find its latest COMPLETED ReportRun.
 * 3. If that ReportRun is missing an AI Visibility summary OR has no optimization tasks,
 *    it will invoke the `generateOptimizationTasksAndSummary` service to (re)generate the
 *    content and persist it using `persistOptimizationTasks`.
 *
 * Notes:
 * • Tasks are generated only when none exist for that run. This avoids unique-constraint
 *   violations on (reportRunId, taskId).
 * • Summaries are always regenerated when they are missing.
 *
 * Make sure the necessary LLM credentials are available in the environment since the
 * generator relies on external LLM calls.
 */

import { PrismaClient } from '@prisma/client';

import {
  generateOptimizationTasksAndSummary,
  persistOptimizationTasks,
} from '../services/optimizationTaskService';

const prisma = new PrismaClient();

async function backfill(): Promise<void> {
  console.log('🔍 Fetching companies…');

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      runs: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          aiVisibilitySummary: true,
          optimizationTasks: { select: { id: true } },
        },
      },
    },
  });

  console.log(`✅ Found ${companies.length} companies`);

  let processed = 0;
  for (const company of companies) {
    const latestRun = company.runs[0];
    if (!latestRun) {
      console.log(`- ${company.name}: No completed reports — skipping`);
      continue;
    }

    const needsSummary = !latestRun.aiVisibilitySummary;
    // Always regenerate tasks to replace existing ones
    const needsTasks = true;

    if (!needsSummary && !needsTasks) {
      console.log(`✓ ${company.name}: Already up-to-date`);
      continue;
    }

    const statusParts: string[] = [];
    if (needsSummary) statusParts.push('summary');
    statusParts.push('tasks'); // Always mention tasks
    console.log(`→ ${company.name}: Backfilling ${statusParts.join(' & ')}…`);

    try {
      const { tasks, summary, tokenUsage } = await generateOptimizationTasksAndSummary(
        latestRun.id,
        company.id,
        prisma,
        true
      );

      // Persist tasks unconditionally (function handles idempotency by deleting existing tasks)
      if (tasks.length > 0) {
        await persistOptimizationTasks(tasks, latestRun.id, company.id, prisma);
        console.log(`  • Persisted ${tasks.length} optimization tasks`);
      }

      if (needsSummary) {
        await prisma.reportRun.update({
          where: { id: latestRun.id },
          data: { aiVisibilitySummary: summary },
        });
        console.log('  • Saved AI Visibility summary');
      }

      // Optional: update token usage if tracking matters
      if (tokenUsage.totalTokens > 0) {
        await prisma.reportRun.update({
          where: { id: latestRun.id },
          data: {
            tokensUsed: {
              increment: tokenUsage.totalTokens,
            },
          },
        });
      }

      console.log(`✓ ${company.name}: Backfill complete (prompt ${tokenUsage.promptTokens}, completion ${tokenUsage.completionTokens})`);
      processed += 1;
    } catch (error) {
      console.error(`✗ ${company.name}: Backfill failed → ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\nBackfill finished — ${processed} company(ies) updated`);

  await prisma.$disconnect();
}

backfill().catch((err) => {
  console.error('Unexpected error during backfill:', err);
  process.exit(1);
}); 