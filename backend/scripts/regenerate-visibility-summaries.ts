import prisma from '../src/config/db';
import { generateOptimizationTasksAndSummary } from '../src/services/optimizationTaskService';

async function main() {
  console.log('\n🔄  Regenerating AI Visibility summaries for latest completed reports…');

  // Fetch all companies
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });

  for (const company of companies) {
    // Get latest completed report for the company
    const latestRun = await prisma.reportRun.findFirst({
      where: { companyId: company.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestRun) {
      console.warn(`⚠️  No completed report found for company ${company.name}`);
      continue;
    }

    try {
      // Generate only the summary (tasks will be ignored)
      const { summary, tokenUsage } = await generateOptimizationTasksAndSummary(
        latestRun.id,
        company.id,
        prisma,
        false, // forceTaskGeneration – keep false so we don't regenerate tasks
      );

      await prisma.reportRun.update({
        where: { id: latestRun.id },
        data: {
          aiVisibilitySummary: summary,
          tokensUsed: {
            // increment existing counter with the new tokens spent
            increment: tokenUsage.totalTokens,
          },
        },
      });

      console.log(`✅ Updated summary for company ${company.name} (run ${latestRun.id})`);
    } catch (err) {
      console.error(`❌ Failed to regenerate summary for company ${company.name}:`, err);
    }
  }

  await prisma.$disconnect();
  console.log('\n🎉  Regeneration complete.');
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
}); 