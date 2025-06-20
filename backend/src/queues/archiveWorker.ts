import { Worker, Job, Queue } from 'bullmq';
import env from '../config/env';
import prisma from '../config/db';
import AWS from 'aws-sdk';

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

// --- Queue for scheduling ---
export const archiveQueue = new Queue('archive-jobs', { connection });

// --- Repeatable Job Scheduling ---
const scheduleArchiveJob = async () => {
  await archiveQueue.add('archive-old-answers', {}, {
    repeat: {
      pattern: '0 2 * * *', // Every day at 2 AM UTC
    },
    jobId: 'daily-archive-job', // Ensures only one instance of this repeatable job exists
    removeOnComplete: true,
    removeOnFail: 10,
  });
  console.log('Daily answer archive job scheduled.');
};

scheduleArchiveJob().catch(err => console.error('Failed to schedule archive job', err));

// --- Worker Implementation ---
const processArchiveJob = async (job: Job) => {
  if (job.name === 'archive-old-answers') {
    console.log('[ARCHIVE WORKER] Starting job to archive old answers...');
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const oldAnswers = await prisma.answer.findMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });

    if (oldAnswers.length > 0) {
      console.log(`[ARCHIVE WORKER] Found ${oldAnswers.length} answers to archive.`);
      
      try {
        // 1. Archive to S3 (placeholder)
        console.log('[ARCHIVE WORKER] Simulating upload to S3 Glacier...');
        console.log('[ARCHIVE WORKER] Simulated upload complete.');

        // 2. Delete from primary database ONLY if archive is successful
        console.log('[ARCHIVE WORKER] SKIPPING DELETE STEP. This is a destructive operation and the S3 upload is not yet implemented.');
        
        console.log('[ARCHIVE WORKER] Finished archiving job successfully.');
      } catch (error) {
        console.error('[ARCHIVE WORKER] Failed to archive or delete answers.', error);
        // Do not re-throw the error, to prevent the job from being retried,
        // as a partial success might have occurred. A more robust implementation
        // would use a transactional approach or a dead-letter queue.
      }
    } else {
      console.log('[ARCHIVE WORKER] No old answers found to archive.');
    }
  }
};

const archiveWorker = new Worker('archive-jobs', processArchiveJob, { connection });

archiveWorker.on('completed', (job: Job) => {
  console.log(`Archive job ${job.id} has completed.`);
});

archiveWorker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`Archive job ${job?.id} failed:`, error);
});

export default archiveWorker; 