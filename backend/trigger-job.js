#!/usr/bin/env node

// Set up environment for AWS secrets
process.env.NODE_ENV = 'development';
process.env.SECRETS_PROVIDER = 'aws';
process.env.DATABASE_SECRET_NAME = 'serplexity-db';
process.env.AWS_ACCESS_KEY_ID = 'AKIAVFIWIQECD5NKMCUX';
process.env.AWS_SECRET_ACCESS_KEY = '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';
process.env.AWS_REGION = 'us-east-2';

const { Queue } = require('bullmq');
const { getBullMQConnection } = require('./dist/config/bullmq');

(async () => {
  try {
    console.log('🔄 Forcing job processing...');
    
    const connection = getBullMQConnection();
    const queue = new Queue('report-generation', { connection });
    
    // Get the pending job
    const jobs = await queue.getWaiting();
    console.log(`📋 Found ${jobs.length} waiting jobs`);
    
    if (jobs.length > 0) {
      const job = jobs[0];
      console.log(`🚀 Triggering job: ${job.id} for report: ${job.data.reportRunId}`);
      
      // Move job to active (this should trigger processing)
      await job.promote();
      console.log('✅ Job promoted to active');
    } else {
      // Check completed/failed jobs
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      console.log(`📊 Queue status: ${completed.length} completed, ${failed.length} failed`);
      
      // Check if our test job is in completed
      const testJob = completed.find(j => j.data.reportRunId === 'cmdeq8lo00001caewrup5nqmr');
      if (testJob) {
        console.log('✅ Test job already completed!');
      } else {
        console.log('❓ Test job not found in any queue');
      }
    }
    
    await connection.quit();
    
  } catch (error) {
    console.error('❌ Failed to trigger job:', error.message);
    process.exit(1);
  }
})();