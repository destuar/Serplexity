#!/usr/bin/env ts-node

import { getDbClient } from '../config/database';

async function listCompanies(): Promise<void> {
  const prisma = await getDbClient();
  console.log('Fetching companies from the database...');
  
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (companies.length === 0) {
    console.log('❌ No companies found in the database.');
    return;
  }

  console.log(`✅ Found ${companies.length} companies:\n`);
  
  const tableData = companies.map(c => ({
    "Company ID": c.id,
    "Name": c.name,
    "Created": c.createdAt.toISOString().split('T')[0],
  }));

  console.table(tableData);
  console.log('\nℹ️  Note: Report counts are not shown. Pick an older company for a higher chance of multiple reports.');
}

listCompanies().catch((e) => {
  console.error('Failed to list companies:', e);
  process.exit(1);
}); 