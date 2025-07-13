import { Queue } from 'bullmq';
import env from '../config/env';
import { getBullMQOptions } from '../config/bullmq';

export const backupSchedulerQueue = new Queue('backup-scheduler', getBullMQOptions());

/**
 * Schedules the backup daily job to trigger report generation for companies that missed their reports.
 * Runs 1 hour after the main scheduler to catch any failures.
 */
export async function scheduleBackupDailyReportTrigger() {
    // Remove any old repeatable jobs to ensure we only have one.
    const repeatableJobs = await backupSchedulerQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        await backupSchedulerQueue.removeRepeatableByKey(job.key);
    }

    // Add the new repeatable job - runs at 6:00 AM UTC (1 hour after main scheduler)
    await backupSchedulerQueue.add(
        'trigger-backup-daily-reports',
        {}, // No data needed for the trigger job
        {
            repeat: {
                pattern: '0 6 * * *', // Every day at 6:00 AM UTC
            },
            jobId: 'backup-daily-report-trigger', // A fixed ID to prevent duplicates
        }
    );
    console.log('[Backup Scheduler] Backup daily report trigger job scheduled to run at 6:00 AM UTC.');
}

/**
 * Schedules an emergency scheduler that can be triggered manually or in case of critical failures
 */
export async function scheduleEmergencyReportTrigger(delayMinutes: number = 30) {
    await backupSchedulerQueue.add(
        'trigger-emergency-reports',
        { 
            reason: 'Emergency trigger',
            triggeredAt: new Date().toISOString() 
        },
        {
            delay: delayMinutes * 60 * 1000, // Convert minutes to milliseconds
            jobId: `emergency-trigger-${Date.now()}`, // Unique ID for tracking
        }
    );
    console.log(`[Backup Scheduler] Emergency report trigger scheduled to run in ${delayMinutes} minutes.`);
}