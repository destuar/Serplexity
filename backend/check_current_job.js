#!/usr/bin/env node

const Redis = require('ioredis');
require('dotenv').config();

async function checkCurrentJob() {
    console.log('🔍 Checking current job 61...');
    
    const redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined
    });
    
    try {
        console.log('✅ Connected to Redis');
        
        const queuePrefix = process.env.BULLMQ_QUEUE_PREFIX || 'serplexity-queue';
        
        // Check job 61
        const jobKey = `${queuePrefix}:report-generation:61`;
        console.log(`\n🔍 Job: ${jobKey}`);
        const exists = await redisClient.exists(jobKey);
        if (exists) {
            const jobData = await redisClient.hgetall(jobKey);
            console.log('  Data:', JSON.stringify(jobData, null, 2));
        } else {
            console.log('  ❌ Job 61 does not exist');
        }
        
        // Check waiting queue
        const waitingKey = `${queuePrefix}:report-generation:waiting`;
        const waitingExists = await redisClient.exists(waitingKey);
        if (waitingExists) {
            const waitingJobs = await redisClient.lrange(waitingKey, 0, -1);
            console.log(`\n⏳ Waiting jobs: ${waitingJobs.length}`);
            waitingJobs.forEach((job, i) => console.log(`  ${i + 1}: ${job}`));
        } else {
            console.log('\n⏳ No waiting queue exists');
        }
        
        // Check if there are any keys with "61" in them
        const allKeys = await redisClient.keys(`${queuePrefix}*61*`);
        console.log('\n🔍 Keys containing "61":', allKeys);
        
        // Check queue ID counter
        const idKey = `${queuePrefix}:report-generation:id`;
        const currentId = await redisClient.get(idKey);
        console.log(`\n🆔 Current queue ID: ${currentId}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        redisClient.disconnect();
    }
}

checkCurrentJob().catch(console.error);