#!/usr/bin/env ts-node

import { masterSchedulerQueue, scheduleDailyReportTrigger } from '../queues/masterScheduler';
import prisma from '../config/db';

async function fixSchedulerCron() {
    console.log('🔧 Fixing scheduler cron job configuration...');
    
    try {
        // Show current repeatable jobs
        console.log('\n📋 Current repeatable jobs:');
        const currentJobs = await masterSchedulerQueue.getRepeatableJobs();
        currentJobs.forEach((job, index) => {
            console.log(`  ${index + 1}. ${job.name} - Key: ${job.key}`);
            console.log(`     Cron: ${(job as any).cron || 'MISSING'}`);
            console.log(`     Pattern: ${(job as any).pattern || 'N/A'}`);
            console.log(`     Next: ${job.next ? new Date(job.next).toISOString() : 'N/A'}`);
        });
        
        // Re-schedule the daily report trigger (this will clean up old jobs)
        console.log('\n🔄 Re-scheduling daily report trigger...');
        await scheduleDailyReportTrigger();
        
        // Verify the new job is correctly registered
        console.log('\n✅ Verification - New repeatable jobs:');
        const newJobs = await masterSchedulerQueue.getRepeatableJobs();
        newJobs.forEach((job, index) => {
            console.log(`  ${index + 1}. ${job.name} - Key: ${job.key}`);
            console.log(`     Cron: ${(job as any).cron || 'MISSING'}`);
            console.log(`     Next: ${job.next ? new Date(job.next).toISOString() : 'N/A'}`);
        });
        
        // Test that we can queue a manual trigger
        console.log('\n🧪 Testing manual trigger (will queue reports for all companies)...');
        console.log('⚠️  This will actually queue reports - proceed? (y/N)');
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise<string>((resolve) => {
            readline.question('', resolve);
        });
        
        if (answer.toLowerCase() === 'y') {
            await masterSchedulerQueue.add('trigger-daily-reports', {});
            console.log('✅ Manual trigger queued successfully');
        } else {
            console.log('⏭️  Manual trigger skipped');
        }
        
        readline.close();
        
        console.log('\n🎉 Scheduler fix completed successfully!');
        console.log('📅 Next automatic run: Tomorrow at 5:00 AM UTC');
        
    } catch (error) {
        console.error('❌ Error fixing scheduler:', error);
        process.exit(1);
    } finally {
        await masterSchedulerQueue.close();
        await prisma.$disconnect();
    }
}

fixSchedulerCron().catch(console.error); 