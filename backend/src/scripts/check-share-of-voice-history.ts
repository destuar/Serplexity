#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';

async function checkShareOfVoiceHistory(): Promise<void> {
  const prisma = await getDbClient();
  console.log('🔍 Investigating ShareOfVoiceHistory table population...\n');

  try {
    // 1. Check if there are any records in ShareOfVoiceHistory
    const totalHistoryRecords = await prisma.shareOfVoiceHistory.count();
    console.log(`📊 Total ShareOfVoiceHistory records: ${totalHistoryRecords}`);

    if (totalHistoryRecords === 0) {
      console.log('❌ ShareOfVoiceHistory table is empty!\n');
    } else {
      console.log('✅ ShareOfVoiceHistory table has data\n');
      
      // Show sample records
      const sampleRecords = await prisma.shareOfVoiceHistory.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { name: true } }
        }
      });
      
      console.log('🔍 Sample records:');
      sampleRecords.forEach(record => {
        console.log(`  • ${record.company.name} - ${record.aiModel}: ${record.shareOfVoice.toFixed(2)}% on ${record.date.toISOString().split('T')[0]}`);
      });
      console.log('');
    }

    // 2. Check completed reports that should have triggered history saves
    const completedReports = await prisma.reportRun.findMany({
      where: { 
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: {
        company: { select: { name: true } },
        reportMetrics: {
          where: { aiModel: 'all' },
          select: { shareOfVoice: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📈 Completed reports in last 7 days: ${completedReports.length}`);

    if (completedReports.length === 0) {
      console.log('❌ No completed reports found in the last 7 days');
      return;
    }

    // 3. Check which reports have metrics but no history
    console.log('\n🔍 Checking reports with metrics vs history:');
    
    for (const report of completedReports) {
      const hasMetrics = report.reportMetrics.length > 0;
      const shareOfVoice = hasMetrics ? report.reportMetrics[0].shareOfVoice : null;
      
      const historyCount = await prisma.shareOfVoiceHistory.count({
        where: { reportRunId: report.id }
      });
      
      const hasHistory = historyCount > 0;
      
      console.log(`  📋 ${report.company.name} (${report.id})`);
      console.log(`     📅 Created: ${report.createdAt.toISOString()}`);
      console.log(`     📊 Has Metrics: ${hasMetrics ? '✅' : '❌'} ${shareOfVoice !== null ? `(SoV: ${shareOfVoice.toFixed(2)}%)` : ''}`);
      console.log(`     📈 Has History: ${hasHistory ? '✅' : '❌'} (${historyCount} records)`);
      
      if (hasMetrics && !hasHistory) {
        console.log(`     ⚠️  ISSUE: Report has metrics but no history records!`);
      }
      console.log('');
    }

    // 4. Check for any errors in the saveShareOfVoiceHistoryPoint function
    console.log('🔍 Testing saveShareOfVoiceHistoryPoint function...');
    
    if (completedReports.length > 0) {
      const testReport = completedReports[0];
      if (testReport.reportMetrics.length > 0) {
        const testShareOfVoice = testReport.reportMetrics[0].shareOfVoice;
        
        try {
          const { saveShareOfVoiceHistoryPoint } = await import('../services/dashboardService');
          
          console.log(`   Testing with: companyId=${testReport.companyId}, shareOfVoice=${testShareOfVoice}, reportRunId=${testReport.id}`);
          
          // Test the function call
          await saveShareOfVoiceHistoryPoint(
            testReport.companyId,
            new Date(),
            'test-model',
            testShareOfVoice,
            testReport.id
          );
          
          console.log(`   ✅ saveShareOfVoiceHistoryPoint function executed successfully`);
          
          // Check if the test record was created
          const testRecord = await prisma.shareOfVoiceHistory.findFirst({
            where: {
              companyId: testReport.companyId,
              aiModel: 'test-model',
              reportRunId: testReport.id
            }
          });
          
          if (testRecord) {
            console.log(`   ✅ Test record was created successfully`);
            
            // Clean up test record
            await prisma.shareOfVoiceHistory.delete({
              where: { id: testRecord.id }
            });
            console.log(`   🧹 Test record cleaned up`);
          } else {
            console.log(`   ❌ Test record was NOT created - there may be an issue with the function`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error testing saveShareOfVoiceHistoryPoint:`, error);
        }
      }
    }

    // 5. Check for any constraint violations or schema issues
    console.log('\n🔍 Checking schema and constraints...');
    
    // Test unique constraint
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const duplicateCount = await prisma.shareOfVoiceHistory.groupBy({
      by: ['companyId', 'date', 'aiModel'],
      having: {
        id: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        id: true
      }
    });
    
    console.log(`   📋 Duplicate constraint violations: ${duplicateCount.length}`);
    
    if (duplicateCount.length > 0) {
      console.log('   ⚠️  Found duplicate records that violate unique constraint:');
      duplicateCount.forEach(dup => {
        console.log(`     • Company: ${dup.companyId}, Date: ${dup.date}, Model: ${dup.aiModel} (${dup._count.id} records)`);
      });
    }

    // 6. Summary and recommendations
    console.log('\n📋 Summary:');
    
    if (totalHistoryRecords === 0) {
      console.log('🚨 ISSUE: ShareOfVoiceHistory table is completely empty');
      console.log('\n🔧 Possible causes:');
      console.log('1. saveShareOfVoiceHistoryPoint is not being called during metrics computation');
      console.log('2. computeAndPersistMetrics is failing before reaching the history save calls');
      console.log('3. Database transaction rollbacks are preventing the saves');
      console.log('4. The post-completion processing failures we just fixed prevented history saves');
      
      console.log('\n💡 Recommended actions:');
      console.log('1. Check if metrics computation is reaching the history save calls');
      console.log('2. Run metrics computation manually for existing reports');
      console.log('3. Generate a new report to test if the issue is fixed');
    } else {
      console.log('✅ ShareOfVoiceHistory table has data - issue may be with recent reports only');
    }

  } catch (error) {
    console.error('❌ Error during investigation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the investigation if called directly
if (require.main === module) {
  checkShareOfVoiceHistory()
    .then(() => {
      console.log('\n✅ Investigation complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Investigation failed:', error);
      process.exit(1);
    });
}

export default checkShareOfVoiceHistory; 