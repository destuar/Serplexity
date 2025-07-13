#!/usr/bin/env ts-node

import { reportGenerationQueue } from '../queues/reportGenerationQueue';
import { getBullMQConnection } from '../config/bullmq';
import { Worker } from 'bullmq';

async function testWorker() {
    console.log('🔧 Testing worker connection and status...\n');
    
    try {
        // Check if queue is accessible
        console.log('📋 Checking queue status...');
        const waiting = await reportGenerationQueue?.getWaiting();
        const active = await reportGenerationQueue?.getActive();
        const completed = await reportGenerationQueue?.getCompleted();
        const failed = await reportGenerationQueue?.getFailed();
        
        console.log(`   Waiting: ${waiting?.length || 0}`);
        console.log(`   Active: ${active?.length || 0}`);
        console.log(`   Completed: ${completed?.length || 0}`);
        console.log(`   Failed: ${failed?.length || 0}`);
        
        // Check if there are any workers connected
        console.log('\n🔍 Checking worker connections...');
        const workers = await reportGenerationQueue?.getWorkers();
        console.log(`   Connected workers: ${workers?.length || 0}`);
        
        if (workers && workers.length > 0) {
            workers.forEach((worker, index) => {
                console.log(`   Worker ${index + 1}: ${worker.name} (${worker.id})`);
            });
        }
        
        // Test a simple job
        console.log('\n🧪 Testing simple job processing...');
        const testJob = await reportGenerationQueue?.add('test-job', { test: true }, {
            removeOnComplete: true,
            removeOnFail: true
        });
        
        console.log(`   Test job added: ${testJob?.id}`);
        
        // Wait a moment and check status
        setTimeout(async () => {
            try {
                const jobStatus = await testJob?.getState();
                console.log(`   Test job status: ${jobStatus}`);
                
                if (jobStatus === 'completed') {
                    console.log('✅ Worker is processing jobs correctly');
                } else if (jobStatus === 'failed') {
                    const failedReason = await testJob?.failedReason;
                    console.log(`❌ Test job failed: ${failedReason}`);
                } else {
                    console.log(`⏳ Test job is still: ${jobStatus}`);
                }
            } catch (error) {
                console.error('❌ Error checking test job status:', error);
            }
            
            process.exit(0);
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error testing worker:', error);
        process.exit(1);
    }
}

testWorker().catch(console.error); 