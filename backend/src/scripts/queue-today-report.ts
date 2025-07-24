#!/usr/bin/env ts-node

/**
 * Script to manually queue today's report for a company
 * Usage: ts-node src/scripts/queue-today-report.ts [companyId]
 */

import { queueReport } from '../services/reportSchedulingService';
import { getDbClient } from '../config/database';

async function main() {
  const companyId = process.argv[2];
  
  try {
    const db = await getDbClient();
    
    if (!companyId) {
      // List available companies
      console.log('Available companies:');
      const companies = await db.company.findMany({
        select: {
          id: true,
          name: true,
          website: true,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (companies.length === 0) {
        console.log('No companies found in database');
        return;
      }
      
      companies.forEach((company: { id: string; name: string }) => {
        console.log(`ID: ${company.id} | Name: ${company.name} | Website: ${company.website}`);
      });
      
      console.log('\nUsage: npm run queue-report [companyId]');
      return;
    }
    
    // Queue report for specific company
    console.log(`Queuing report for company: ${companyId}`);
    const result = await queueReport(companyId, true); // force=true to bypass daily cache
    
    if (result.isNew) {
      console.log(`✅ New report queued successfully!`);
      console.log(`Run ID: ${result.runId}`);
      console.log(`Status: ${result.status}`);
    } else {
      console.log(`ℹ️  Report already exists for today`);
      console.log(`Run ID: ${result.runId}`);
      console.log(`Status: ${result.status}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main();