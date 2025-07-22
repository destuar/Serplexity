#!/usr/bin/env node

// Set up environment for AWS secrets
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { getDbClient } = require('./dist/config/database');
const { getBullMQConnection } = require('./dist/config/bullmq');
const { Queue } = require('bullmq');

(async () => {
  try {
    console.log('🔍 Setting up test report for competitor detection...');
    
    const prisma = await getDbClient();
    const connection = getBullMQConnection();
    
    // Find an existing company (Cedars-Sinai from before)
    const company = await prisma.company.findFirst({
      where: { name: "Cedars-Sinai" }
    });
    
    if (!company) {
      console.error('❌ Company not found');
      process.exit(1);
    }
    
    console.log(`📊 Found company: ${company.name} (${company.id})`);
    
    // Create a new report run
    const reportRun = await prisma.reportRun.create({
      data: {
        companyId: company.id,
        status: 'PENDING',
        stepStatus: 'Queued for processing'
      }
    });
    
    console.log(`📈 Created report run: ${reportRun.id}`);
    
    // Queue the report
    const reportQueue = new Queue('report-generation', { connection });
    
    const job = await reportQueue.add('process-report', {
      reportRunId: reportRun.id,
      companyId: company.id
    });
    
    console.log(`🚀 Queued report job: ${job.id}`);
    console.log('✅ Test report queued successfully');
    console.log('💡 Monitor the job progress in the logs to see if competitors are detected');
    
    await prisma.$disconnect();
    await connection.quit();
    
  } catch (error) {
    console.error('❌ Failed to queue test report:', error.message);
    process.exit(1);
  }
})();