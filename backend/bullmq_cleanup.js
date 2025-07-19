#!/usr/bin/env node

const { Queue } = require('bullmq');
const Redis = require('ioredis');
require('dotenv').config();

async function cleanupWithBullMQ() {
    console.log('🧹 Cleaning up queue using BullMQ API...');
    
    const connection = new Redis({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_USE_TLS === 'true' ? {} : undefined
    });
    
    const queue = new Queue('report-generation', {
        connection,
        prefix: process.env.BULLMQ_QUEUE_PREFIX || 'serplexity-queue'
    });
    
    try {
        console.log('✅ Connected to BullMQ');
        
        // Get counts
        const counts = await queue.getJobCounts();
        console.log('📊 Current job counts:', counts);
        
        // Clean failed jobs
        if (counts.failed > 0) {
            const cleanedFailed = await queue.clean(0, 1000, 'failed');
            console.log(`🗑️ Cleaned ${cleanedFailed.length} failed jobs`);
        }
        
        // Clean completed jobs
        if (counts.completed > 0) {
            const cleanedCompleted = await queue.clean(0, 1000, 'completed');
            console.log(`🗑️ Cleaned ${cleanedCompleted.length} completed jobs`);
        }
        
        // Clean active jobs (stalled)
        if (counts.active > 0) {
            const cleanedActive = await queue.clean(0, 1000, 'active');
            console.log(`🗑️ Cleaned ${cleanedActive.length} stalled active jobs`);
        }
        
        console.log('✅ Queue cleanup completed successfully');
        
        // Check final state
        const finalCounts = await queue.getJobCounts();
        console.log('📊 Final job counts:', finalCounts);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await queue.close();
        connection.disconnect();
    }
}

cleanupWithBullMQ().catch(console.error);