#!/usr/bin/env node

const Redis = require('ioredis');
require('dotenv').config();

async function checkJobDetails() {
    console.log('🔍 Checking specific job details...');
    
    const redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined
    });
    
    try {
        console.log('✅ Connected to Redis');
        
        const queuePrefix = process.env.BULLMQ_QUEUE_PREFIX || 'serplexity-queue';
        
        // Check the most recent jobs (58 and 59)
        const jobKeys = [`${queuePrefix}:report-generation:58`, `${queuePrefix}:report-generation:59`];
        
        for (const jobKey of jobKeys) {
            console.log(`\n🔍 Job: ${jobKey}`);
            const exists = await redisClient.exists(jobKey);
            if (exists) {
                const jobData = await redisClient.hgetall(jobKey);
                console.log('  Data:', JSON.stringify(jobData, null, 2));
            } else {
                console.log('  Job does not exist');
            }
        }
        
        // Check if there's a waiting list
        const waitingKey = `${queuePrefix}:report-generation:waiting`;
        const waitingExists = await redisClient.exists(waitingKey);
        console.log(`\n⏳ Waiting queue exists: ${waitingExists}`);
        
        // Check if there's an active list
        const activeKey = `${queuePrefix}:report-generation:active`;
        const activeExists = await redisClient.exists(activeKey);
        console.log(`🔄 Active queue exists: ${activeExists}`);
        
        // Check if there's a paused list
        const pausedKey = `${queuePrefix}:report-generation:paused`;
        const pausedExists = await redisClient.exists(pausedKey);
        console.log(`⏸️  Paused queue exists: ${pausedExists}`);
        
        // Check queue meta information
        const metaKey = `${queuePrefix}:report-generation:meta`;
        const metaExists = await redisClient.exists(metaKey);
        if (metaExists) {
            const metaData = await redisClient.hgetall(metaKey);
            console.log('\n📊 Queue Meta:', JSON.stringify(metaData, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        redisClient.disconnect();
    }
}

checkJobDetails().catch(console.error);