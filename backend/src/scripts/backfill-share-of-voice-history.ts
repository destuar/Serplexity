#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';
import { saveShareOfVoiceHistoryPoint, saveSentimentOverTimePoint } from '../services/dashboardService';

async function backfillShareOfVoiceHistory(): Promise<void> {
  const prisma = await getDbClient();
  console.log('🔧 Backfilling ShareOfVoiceHistory for existing reports...\n');

  try {
    // Find all completed reports with metrics that are missing history records
    const reportsWithMetrics = await prisma.reportRun.findMany({
      where: {
        status: 'COMPLETED',
        reportMetrics: {
          some: {}
        }
      },
      include: {
        company: { select: { name: true } },
        reportMetrics: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`📊 Found ${reportsWithMetrics.length} completed reports with metrics`);

    if (reportsWithMetrics.length === 0) {
      console.log('❌ No completed reports with metrics found');
      return;
    }

    let processed = 0;
    let historyPointsCreated = 0;
    let sentimentPointsCreated = 0;

    for (const report of reportsWithMetrics) {
      console.log(`\n🔄 Processing: ${report.company.name} (${report.id})`);
      console.log(`   📅 Created: ${report.createdAt.toISOString()}`);
      console.log(`   📊 Metrics: ${report.reportMetrics.length} records`);

      try {
        // Process each metric record for this report
        for (const metric of report.reportMetrics) {
          // Check if history record already exists
          const existingHistory = await prisma.shareOfVoiceHistory.findFirst({
            where: {
              companyId: report.companyId,
              date: report.createdAt,
              aiModel: metric.aiModel,
              reportRunId: report.id
            }
          });

          if (!existingHistory) {
            // Create share of voice history point
            await saveShareOfVoiceHistoryPoint(
              report.companyId,
              report.createdAt,
              metric.aiModel,
              metric.shareOfVoice,
              report.id
            );
            historyPointsCreated++;
            console.log(`   ✅ Created ShareOfVoice history: ${metric.aiModel} - ${metric.shareOfVoice.toFixed(2)}%`);
          } else {
            console.log(`   ⏭️  ShareOfVoice history exists: ${metric.aiModel} - ${metric.shareOfVoice.toFixed(2)}%`);
          }

          // Create sentiment history if we have sentiment data
          if (metric.sentimentScore !== null) {
            const existingSentiment = await prisma.sentimentOverTime.findFirst({
              where: {
                companyId: report.companyId,
                date: report.createdAt,
                aiModel: metric.aiModel,
                reportRunId: report.id
              }
            });

            if (!existingSentiment) {
              await saveSentimentOverTimePoint(
                report.companyId,
                report.createdAt,
                metric.aiModel,
                metric.sentimentScore,
                report.id
              );
              sentimentPointsCreated++;
              console.log(`   ✅ Created Sentiment history: ${metric.aiModel} - ${metric.sentimentScore.toFixed(2)}`);
            } else {
              console.log(`   ⏭️  Sentiment history exists: ${metric.aiModel} - ${metric.sentimentScore.toFixed(2)}`);
            }
          }
        }

        processed++;
        console.log(`   ✅ Processed report successfully`);

      } catch (error) {
        console.error(`   ❌ Error processing report ${report.id}:`, error);
      }
    }

    console.log(`\n📋 Backfill Summary:`);
    console.log(`   📊 Reports processed: ${processed}/${reportsWithMetrics.length}`);
    console.log(`   📈 ShareOfVoice history points created: ${historyPointsCreated}`);
    console.log(`   💭 Sentiment history points created: ${sentimentPointsCreated}`);

    // Verify the results
    console.log(`\n🔍 Verification:`);
    const totalHistoryAfter = await prisma.shareOfVoiceHistory.count();
    const totalSentimentAfter = await prisma.sentimentOverTime.count();
    
    console.log(`   📈 Total ShareOfVoiceHistory records: ${totalHistoryAfter}`);
    console.log(`   💭 Total SentimentOverTime records: ${totalSentimentAfter}`);

    if (totalHistoryAfter > 0) {
      console.log(`\n✅ Success! ShareOfVoiceHistory table is now populated`);
      
      // Show some sample records
      const sampleHistory = await prisma.shareOfVoiceHistory.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { name: true } }
        }
      });

      console.log(`\n📊 Sample history records:`);
      sampleHistory.forEach(record => {
        console.log(`   • ${record.company.name} - ${record.aiModel}: ${record.shareOfVoice.toFixed(2)}% on ${record.date.toISOString().split('T')[0]}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill if called directly
if (require.main === module) {
  backfillShareOfVoiceHistory()
    .then(() => {
      console.log('\n🎉 Backfill complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Backfill failed:', error);
      process.exit(1);
    });
}

export default backfillShareOfVoiceHistory; 