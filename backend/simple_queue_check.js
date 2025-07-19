#!/usr/bin/env node

const Redis = require('ioredis');
require('dotenv').config();

async function simpleQueueCheck() {
    console.log('🔍 Simple queue check...');
    
    const redisClient = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined
    });
    
    try {
        console.log('✅ Connected to Redis');
        
        // Get all keys related to the queue
        const queuePrefix = process.env.BULLMQ_QUEUE_PREFIX || 'serplexity-queue';
        const keys = await redisClient.keys(`${queuePrefix}*`);
        
        console.log('\n📊 All Queue Keys:');
        keys.forEach(key => console.log(`  ${key}`));
        
        // Check for specific queue patterns
        const reportKeys = keys.filter(key => key.includes('report-generation'));
        console.log('\n🎯 Report Generation Keys:');
        reportKeys.forEach(key => console.log(`  ${key}`));
        
        // Check if there are any jobs waiting
        const waitingKey = `${queuePrefix}:report-generation:waiting`;
        const waitingExists = await redisClient.exists(waitingKey);
        console.log(`\n⏳ Waiting queue exists: ${waitingExists}`);
        
        if (waitingExists) {
            const waitingLength = await redisClient.llen(waitingKey);
            console.log(`   Jobs waiting: ${waitingLength}`);
            
            if (waitingLength > 0) {
                const jobs = await redisClient.lrange(waitingKey, 0, -1);
                console.log('   Jobs in waiting queue:', jobs);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        redisClient.disconnect();
    }
}

simpleQueueCheck().catch(console.error);