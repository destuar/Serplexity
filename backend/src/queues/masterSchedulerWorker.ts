import { Worker, Job } from 'bullmq';
import env from '../config/env';
import prisma from '../config/db';
import { queueReport } from '../services/reportSchedulingService';

const worker = new Worker('master-scheduler', async (job: Job) => {
    if (job.name === 'trigger-daily-reports') {
        console.log('[Scheduler Worker] Starting to queue daily reports for all companies...');
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
    connection: { host: env.REDIS_HOST, port: env.REDIS_PORT },
    concurrency: 1, // Only one of these scheduler jobs should run at a time.
});

worker.on('completed', (job: Job) => { 
    console.log(`[Scheduler Worker] Master scheduler job ${job.id} has completed.`);
});

worker.on('failed', (job: Job | undefined, err: Error) => { 
    if (job) {
        console.error(`[Scheduler Worker] Master scheduler job ${job.id} has failed with ${err.message}`);
    } else {
        console.error(`[Scheduler Worker] A master scheduler job has failed with ${err.message}`);
    }
});

export default worker; 