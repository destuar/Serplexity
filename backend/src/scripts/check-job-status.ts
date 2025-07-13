#!/usr/bin/env ts-node

import { reportGenerationQueue } from '../queues/reportGenerationQueue';

async function checkJobStatus() {
    console.log('🔍 Checking job status...\n');
    
    try {
        if (!reportGenerationQueue) {
            console.log('❌ Report generation queue not available');
            return;
        }

        const failed = await reportGenerationQueue.getFailed();
        const completed = await reportGenerationQueue.getCompleted();
        const waiting = await reportGenerationQueue.getWaiting();
        const active = await reportGenerationQueue.getActive();
        
        console.log(`📊 Queue Status:`);
        console.log(`   Waiting: ${waiting.length}`);
        console.log(`   Active: ${active.length}`);
        console.log(`   Completed: ${completed.length}`);
        console.log(`   Failed: ${failed.length}`);
        
        if (failed.length > 0) {
            console.log('\n❌ Recent failures:');
            failed.slice(-3).forEach(job => {
                console.log(`   - Job ${job.id}: ${job.failedReason}`);
                console.log(`     Data: ${JSON.stringify(job.data)}`);
            });
        }
        
        if (completed.length > 0) {
            console.log('\n✅ Recent completions:');
            completed.slice(-3).forEach(job => {
                console.log(`   - Job ${job.id}: ${job.returnvalue || 'completed'}`);
                console.log(`     Data: ${JSON.stringify(job.data)}`);
            });
        }
        
        if (waiting.length > 0) {
            console.log('\n⏳ Waiting jobs:');
            waiting.forEach(job => {
                console.log(`   - Job ${job.id}: ${job.name}`);
                console.log(`     Data: ${JSON.stringify(job.data)}`);
            });
        }
        
        if (active.length > 0) {
            console.log('\n🔄 Active jobs:');
            active.forEach(job => {
                console.log(`   - Job ${job.id}: ${job.name}`);
                console.log(`     Data: ${JSON.stringify(job.data)}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking job status:', error);
    }
}

checkJobStatus().catch(console.error); 