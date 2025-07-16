/**
 * @file masterSchedulerWorker.ts
 * @description This file defines the BullMQ worker that processes the main daily report generation jobs.
 * It iterates through eligible companies and queues a report generation job for each, respecting the daily cache.
 * This worker is essential for automating the regular generation of reports.
 *
 * @dependencies
 * - bullmq: The BullMQ library for creating workers.
 * - ../config/env: Environment variable configuration.
 * - ../config/bullmq: BullMQ connection configuration.
 * - ../config/db: The singleton Prisma client instance.
 * - ../services/reportSchedulingService: Service for queuing report generation.
 * - ../services/alertingService: Service for sending system alerts.
 *
 * @exports
 * - worker: The BullMQ worker instance for master scheduling jobs.
 */
import { Worker, Job } from 'bullmq';
import env from '../config/env';
import { getBullMQConnection } from '../config/bullmq';
import { getDbClient } from '../config/database';
import { queueReport } from '../services/reportSchedulingService';
import { alertingService } from '../services/alertingService';

let worker: Worker | null = null;

if (env.NODE_ENV !== 'test') {
  worker = new Worker('master-scheduler', async (job: Job) => {
    if (job.name === 'trigger-daily-reports') {
        console.log('[Scheduler Worker] Starting to queue daily reports for all companies...');
        const prisma = await getDbClient();
        const companies = await prisma.company.findMany({
            where: {
                // Only select companies that have at least one completed report run.
                // This ensures the scheduler doesn't generate the very first report.
                runs: {
                    some: {
                        status: 'COMPLETED',
                    },
                },
            },
            select: { id: true },
        });

        console.log(`[Scheduler Worker] Found ${companies.length} companies to process for daily reports.`);

        for (const company of companies) {
            try {
                // We call queueReport with force=false, so it respects the daily cache.
                await queueReport(company.id, false);
            } catch (error) {
                console.error(`[Scheduler Worker] Failed to queue report for company ${company.id}`, error);
                // Continue to the next company even if one fails
            }
        }
        console.log('[Scheduler Worker] Finished queuing daily reports for all companies.');
    }
}, {
    connection: getBullMQConnection(),
    prefix: env.BULLMQ_QUEUE_PREFIX,
    concurrency: 1, // Only one of these scheduler jobs should run at a time.
    lockDuration: 1000 * 60 * 5, // 5 minutes
});

worker.on('completed', (job: Job) => { 
    console.log(`[Scheduler Worker] Master scheduler job ${job.id} has completed.`);
});

worker.on('failed', async (job: Job | undefined, err: Error) => { 
    if (job) {
        console.error(`[Scheduler Worker] Master scheduler job ${job.id} has failed with ${err.message}`);
    } else {
        console.error(`[Scheduler Worker] A master scheduler job has failed with ${err.message}`);
    }
    
    // Send alert for scheduler failure
    try {
        await alertingService.alertSchedulerFailure(err, new Date());
    } catch (alertError) {
        console.error('[Scheduler Worker] Failed to send scheduler failure alert:', alertError);
    }
});
}

export default worker; 