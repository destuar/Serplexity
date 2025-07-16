#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';

async function debugShareOfVoiceChange(companyId: string): Promise<void> {
  const prisma = await getDbClient();
  if (!companyId) {
    console.error('❌ Please provide a companyId. Usage: ts-node backend/src/scripts/debug-sov-change.ts <companyId>');
    process.exit(1);
  }

  console.log(`🔍 Debugging Share of Voice 'change' metric for Company ID: ${companyId}\n`);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    console.error(`❌ Company with ID "${companyId}" not found.`);
    return;
  }

  console.log(`🏢 Company: ${company.name}\n`);

  const reportRuns = await prisma.reportRun.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: {
      reportMetrics: {
        orderBy: { aiModel: 'asc' },
      },
    },
  });

  if (reportRuns.length === 0) {
    console.log('❌ No reports found for this company. This is why "change" is null.');
    console.log('💡 Run a report to generate the first data point.');
    return;
  }

  console.log(`📊 Found ${reportRuns.length} total report runs.\n`);
  
  if (reportRuns.filter(r => r.status === 'COMPLETED').length < 2) {
      console.warn('⚠️ Less than two completed reports found. "Change" is calculated by comparing the latest completed report to the one before it.');
  }

  for (const run of reportRuns) {
    console.log('======================================================================');
    console.log(`▶️ Report Run ID: ${run.id}`);
    console.log(`  Created At:    ${run.createdAt.toISOString()}`);
    console.log(`  Status:        ${run.status}`);

    if (run.status !== 'COMPLETED') {
      console.log('  💬 Skipping metrics check (not COMPLETED).\n');
      continue;
    }

    if (run.reportMetrics.length === 0) {
      console.warn('  ⚠️ This COMPLETED report has no associated metrics! The metrics calculation might have failed.');
      continue;
    }

    console.log('\n  🔬 Associated Metrics:');
    for (const metric of run.reportMetrics) {
      console.log(`  -----------------------------------`);
      console.log(`    - AI Model:          ${metric.aiModel}`);
      console.log(`    - Share of Voice:    ${metric.shareOfVoice?.toFixed(2)}%`);
      console.log(`    - SoV Change:        ${metric.shareOfVoiceChange === null ? 'NULL' : `${metric.shareOfVoiceChange.toFixed(2)}%`}`);

      const competitorRankings = metric.competitorRankings as any;
      if (competitorRankings?.chartCompetitors) {
        console.log(`    - Competitor Data:   Present (${competitorRankings.chartCompetitors.length} total)`);
        
        const changeIsPresent = competitorRankings.chartCompetitors.some((c: any) => c.change !== null && c.change !== undefined);
        
        if (changeIsPresent) {
            console.log(`    - Competitor Change: ✅ Present`);
        } else {
            console.log(`    - Competitor Change: ❌ NULL for all competitors`);
        }
        
        const userCompany = competitorRankings.chartCompetitors.find((c: any) => c.isUserCompany);
        if (userCompany) {
            console.log(`      - Your Company Change: ${userCompany.change === null || userCompany.change === undefined ? 'NULL' : `${userCompany.change.toFixed(2)}%`}`);
        }

      } else {
        console.log(`    - Competitor Data:   ❌ Not found`);
      }
    }
    console.log('');
  }
  
  console.log('======================================================================');
  console.log('\n✅ Debug script finished.');
  console.log('💡 Analysis: If "change" is consistently NULL, it is likely because there is only one "COMPLETED" report to draw from. A second "COMPLETED" report is required to calculate the difference.');
}

const companyId = process.argv[2];
debugShareOfVoiceChange(companyId).catch((e) => {
  console.error(e);
  process.exit(1);
}); 