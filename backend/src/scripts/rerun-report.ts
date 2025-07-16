#!/usr/bin/env ts-node

import { queueReport } from '../services/reportSchedulingService';
import { getDbClient } from '../config/database';

async function rerunReport(companyId: string) {
  const prisma = await getDbClient();
  console.log(`Attempting to re-run report for company: ${companyId}`);

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      console.error(`Error: Company with ID "${companyId}" not found.`);
      return;
    }

    console.log(`Found company: ${company.name}. Forcing a new report generation...`);

    const result = await queueReport(companyId, true);

    if (result.isNew) {
      console.log(`✅ Successfully queued new report generation.`);
      console.log(`   - Run ID: ${result.runId}`);
      console.log(`   - Status: ${result.status}`);
    } else {
      console.warn(`⚠️ Report was not re-queued. An existing report is likely in progress.`);
      console.warn(`   - Run ID: ${result.runId}`);
      console.warn(`   - Status: ${result.status}`);
    }
  } catch (error) {
    console.error('❌ Failed to re-run report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
const companyId = args[0];

if (!companyId) {
  console.error('Please provide a companyId as an argument.');
  console.error('Usage: npm run script rerun-report -- <companyId>');
  process.exit(1);
}

rerunReport(companyId); 