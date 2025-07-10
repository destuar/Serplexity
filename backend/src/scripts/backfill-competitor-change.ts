#!/usr/bin/env ts-node

import prisma from '../config/db';

async function backfillCompetitorChange(): Promise<void> {
  console.log('🔄 Starting backfill of competitor change metrics...\n');

  try {
    // Get all companies
    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' }
    });

    if (companies.length === 0) {
      console.log('❌ No companies found.');
      return;
    }

    console.log(`📊 Found ${companies.length} companies to process.\n`);

    let totalReportsProcessed = 0;
    let totalCompaniesProcessed = 0;

    for (const company of companies) {
      console.log(`🏢 Processing company: ${company.name} (${company.id})`);

      // Get all completed reports for this company, ordered by creation date
      const reports = await prisma.reportRun.findMany({
        where: { 
          companyId: company.id,
          status: 'COMPLETED'
        },
        include: {
          reportMetrics: {
            orderBy: { aiModel: 'asc' }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (reports.length < 2) {
        console.log(`  ⏭️  Skipping ${company.name} - needs at least 2 completed reports for change calculation`);
        continue;
      }

      console.log(`  📈 Found ${reports.length} completed reports`);

      // Process each report (starting from the second one)
      for (let i = 1; i < reports.length; i++) {
        const currentReport = reports[i];
        const previousReport = reports[i - 1];

        console.log(`  🔄 Processing report ${i + 1}/${reports.length}: ${currentReport.id}`);

        // Process each metric (AI model) in the current report
        for (const currentMetric of currentReport.reportMetrics) {
          // Find the corresponding metric in the previous report
          const previousMetric = previousReport.reportMetrics.find(
            m => m.aiModel === currentMetric.aiModel
          );

          if (!previousMetric) {
            console.log(`    ⏭️  No previous metric found for model: ${currentMetric.aiModel}`);
            continue;
          }

          // Check if competitor rankings exist in both reports
          const currentCompetitorRankings = currentMetric.competitorRankings as any;
          const previousCompetitorRankings = previousMetric.competitorRankings as any;

          if (!currentCompetitorRankings?.chartCompetitors || !previousCompetitorRankings?.chartCompetitors) {
            console.log(`    ⏭️  Missing competitor rankings for model: ${currentMetric.aiModel}`);
            continue;
          }

          // Calculate change for each competitor
          let updatedCompetitors = false;
          for (const competitor of currentCompetitorRankings.chartCompetitors) {
            const prevCompData = previousCompetitorRankings.chartCompetitors.find(
              (pc: any) => pc.id === competitor.id
            );

            if (prevCompData) {
              const change = competitor.shareOfVoice - prevCompData.shareOfVoice;
              const changeType = change > 0.1 ? 'increase' : (change < -0.1 ? 'decrease' : 'stable');

              // Only update if the change is different from what's currently stored
              if (competitor.change !== change || competitor.changeType !== changeType) {
                competitor.change = change;
                competitor.changeType = changeType;
                updatedCompetitors = true;
              }
            } else {
              // New competitor - set change to 0 or null
              if (competitor.change !== 0 || competitor.changeType !== 'stable') {
                competitor.change = 0;
                competitor.changeType = 'stable';
                updatedCompetitors = true;
              }
            }
          }

          // Update the database if changes were made
          if (updatedCompetitors) {
            await prisma.reportMetric.update({
              where: {
                reportId_aiModel: {
                  reportId: currentReport.id,
                  aiModel: currentMetric.aiModel
                }
              },
              data: {
                competitorRankings: currentCompetitorRankings
              }
            });

            console.log(`    ✅ Updated competitor changes for model: ${currentMetric.aiModel}`);
          } else {
            console.log(`    ✓ No changes needed for model: ${currentMetric.aiModel}`);
          }
        }

        totalReportsProcessed++;
      }

      totalCompaniesProcessed++;
      console.log(`  ✅ Completed processing ${company.name}\n`);
    }

    console.log('======================================================================');
    console.log(`✅ Backfill completed successfully!`);
    console.log(`📊 Companies processed: ${totalCompaniesProcessed}`);
    console.log(`📈 Reports processed: ${totalReportsProcessed}`);
    console.log('======================================================================');

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  }
}

// Run the backfill
backfillCompetitorChange().catch((error) => {
  console.error('Failed to backfill competitor change metrics:', error);
  process.exit(1);
}); 