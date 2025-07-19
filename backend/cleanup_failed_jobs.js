#!/usr/bin/env node

const Redis = require('ioredis');
require('dotenv').config();

async function cleanupFailedJobs() {
    console.log('🧹 Cleaning up failed jobs and resetting queue state...');
    
    const redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined
    });
    
    try {
        console.log('✅ Connected to Redis');
        
        const queuePrefix = process.env.BULLMQ_QUEUE_PREFIX || 'serplexity-queue';
        const queueName = `${queuePrefix}:report-generation`;
        
        // Get all failed jobs
        const failedJobs = await redisClient.smembers(`${queueName}:failed`);
        console.log(`📊 Found ${failedJobs.length} failed jobs`);
        
        // Remove failed jobs
        if (failedJobs.length > 0) {
            await redisClient.del(`${queueName}:failed`);
            console.log('🗑️ Cleared failed jobs list');
            
            // Remove individual failed job data
            for (const jobId of failedJobs) {
                const jobKey = `${queueName}:${jobId}`;
                await redisClient.del(jobKey);
                console.log(`🗑️ Removed job data: ${jobKey}`);
            }
        }
        
        // Clear any stalled checks
        await redisClient.del(`${queueName}:stalled-check`);
        console.log('🗑️ Cleared stalled checks');
        
        // Reset active jobs list
        await redisClient.del(`${queueName}:active`);
        console.log('🗑️ Cleared active jobs list');
        
        // Clear waiting jobs (will be recreated when needed)
        await redisClient.del(`${queueName}:waiting`);
        console.log('🗑️ Cleared waiting jobs list');
        
        console.log('✅ Queue cleanup completed');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        redisClient.disconnect();
    }
}

cleanupFailedJobs().catch(console.error);