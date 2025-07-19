#!/usr/bin/env node

/**
 * Script to check queue status and report runs
 */

const Redis = require('ioredis');
require('dotenv').config();

async function checkQueueStatus() {
    console.log('🔍 Checking queue and report status...');
    
    // Connect to Redis
    const redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined
    });
    
    try {
        console.log('✅ Connected to Redis');
        
        // Check BullMQ queue status
        const queueKey = `${process.env.BULLMQ_QUEUE_PREFIX || 'serplexity-queue'}:report-generation`;
        
        // Get waiting jobs
        const waitingJobs = await redisClient.llen(`${queueKey}:waiting`);
        const activeJobs = await redisClient.llen(`${queueKey}:active`);
        const completedJobs = await redisClient.llen(`${queueKey}:completed`);
        const failedJobs = await redisClient.llen(`${queueKey}:failed`);
        
        console.log('\n📊 Queue Status:');
        console.log(`  Waiting: ${waitingJobs}`);
        console.log(`  Active: ${activeJobs}`);
        console.log(`  Completed: ${completedJobs}`);
        console.log(`  Failed: ${failedJobs}`);
        
        // Get active job details if any
        if (activeJobs > 0) {
            const activeJobKeys = await redisClient.lrange(`${queueKey}:active`, 0, -1);
            console.log('\n🔄 Active Jobs:');
            for (const jobKey of activeJobKeys) {
                const jobData = await redisClient.hgetall(jobKey);
                console.log(`  Job ${jobKey}:`, jobData);
            }
        }
        
        // Get waiting job details if any
        if (waitingJobs > 0) {
            const waitingJobKeys = await redisClient.lrange(`${queueKey}:waiting`, 0, -1);
            console.log('\n⏳ Waiting Jobs:');
            for (const jobKey of waitingJobKeys) {
                const jobData = await redisClient.hgetall(jobKey);
                console.log(`  Job ${jobKey}:`, jobData);
            }
        }
        
        // Get failed job details if any
        if (failedJobs > 0) {
            const failedJobKeys = await redisClient.lrange(`${queueKey}:failed`, 0, -1);
            console.log('\n❌ Failed Jobs:');
            for (const jobKey of failedJobKeys) {
                const jobData = await redisClient.hgetall(jobKey);
                console.log(`  Job ${jobKey}:`, jobData);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        redisClient.disconnect();
    }
}

checkQueueStatus().catch(console.error);