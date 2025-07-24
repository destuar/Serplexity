#!/usr/bin/env node

process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';  
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { getDbClient } = require('./dist/config/database');
const { getBullMQConnection } = require('./dist/config/bullmq');
const { Queue } = require('bullmq');

async function triggerNordstromReport() {
  try {
    console.log('🔍 Finding Nordstrom company...');
    
    const prisma = await getDbClient();
    const connection = getBullMQConnection();
    
    // Get Nordstrom company
    const company = await prisma.company.findFirst({
      where: { name: { contains: 'Nordstrom', mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        website: true
      }
    });

    if (!company) {
      console.log('❌ Nordstrom company not found');
      return;
    }

    console.log(`✅ Found company: ${company.name} (ID: ${company.id})`);
    console.log(`📊 Triggering new report for ${company.name}...`);
    
    // Create new report run
    const reportRun = await prisma.reportRun.create({
      data: {
        companyId: company.id,
        status: 'PENDING',
        stepStatus: 'Queued for processing',
        tokensUsed: 0,
        usdCost: 0.0,
      }
    });
    
    console.log(`📋 Created report run: ${reportRun.id}`);
    
    // Add to queue
    const queue = new Queue('report-generation', { connection });
    
    const job = await queue.add(
      'generate-report',
      {
        runId: reportRun.id,
        companyId: company.id,
      },
      {
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      }
    );
    
    console.log(`✅ Report queued successfully!`);
    console.log(`📋 Report ID: ${reportRun.id}`);
    console.log(`🎯 Job ID: ${job.id}`);
    console.log(`🚀 Report processing started for ${company.name}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    // No need to disconnect as getDbClient handles connection lifecycle
  }
}

triggerNordstromReport();