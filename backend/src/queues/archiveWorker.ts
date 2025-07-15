import { Worker, Job, Queue } from 'bullmq';
import env from '../config/env';
import { getBullMQConnection } from '../config/bullmq';
import prisma from '../config/db';
import { GlacierClient, UploadArchiveCommand } from '@aws-sdk/client-glacier';

const connection = getBullMQConnection();

// Initialize Glacier client
const glacierClient = new GlacierClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

// --- Queue for scheduling ---
export const archiveQueue = new Queue('archive-jobs', { 
  connection,
  prefix: env.BULLMQ_QUEUE_PREFIX 
});

// Helper function to export responses to Glacier
async function exportResponsesToGlacier(runIds: string[], companyId: string): Promise<string> {
  console.log(`[ARCHIVE] Exporting ${runIds.length} runs for company ${companyId} to Glacier`);
  
  // Fetch all responses for these runs
  const fanoutResponses = await prisma.fanoutResponse.findMany({
    where: { runId: { in: runIds } },
    include: { mentions: true }
  });

  // Create archive payload
  const archiveData = {
    companyId,
    runIds,
    archivedAt: new Date().toISOString(),
    data: {
      fanoutResponses,
    },
  };

  const archiveBody = JSON.stringify(archiveData);
  const archiveDescription = `Company ${companyId} - ${runIds.length} runs - ${new Date().toISOString()}`;

  // Upload to Glacier
  const uploadCommand = new UploadArchiveCommand({
    vaultName: env.GLACIER_VAULT_NAME,
    accountId: env.GLACIER_ACCOUNT_ID,
    archiveDescription,
    body: Buffer.from(archiveBody),
  });

  const result = await glacierClient.send(uploadCommand);
  console.log(`[ARCHIVE] Successfully uploaded to Glacier. Archive ID: ${result.archiveId}`);
  
  return result.archiveId!;
}

// --- Worker Implementation ---
export const processArchiveJob = async (job: Job) => {
  if (job.name === 'archive-old-responses') {
    const { companyId } = job.data;
    console.log(`[ARCHIVE WORKER] Starting archive job for company ${companyId}...`);
    
    // Find reports older than the latest 3 for this company
    const allRuns = await prisma.reportRun.findMany({
      where: { 
        companyId,
        status: 'COMPLETED'
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true }
    });

    if (allRuns.length <= 3) {
      console.log(`[ARCHIVE WORKER] Company ${companyId} has ${allRuns.length} completed runs. Nothing to archive.`);
      return;
    }

    // Keep latest 3, archive the rest
    const runsToArchive = allRuns.slice(3);
    const runIds = runsToArchive.map(r => r.id);
    
    console.log(`[ARCHIVE WORKER] Found ${runIds.length} runs to archive for company ${companyId}`);
    
    try {
      // 1. Archive to Glacier
      const archiveId = await exportResponsesToGlacier(runIds, companyId);
      
      // 2. Delete from RDS in a transaction (mentions cascade delete automatically)
      await prisma.fanoutResponse.deleteMany({ where: { runId: { in: runIds } } });
      
      console.log(`[ARCHIVE WORKER] Successfully archived and deleted ${runIds.length} runs for company ${companyId}. Archive ID: ${archiveId}`);
      
    } catch (error) {
      console.error(`[ARCHIVE WORKER] Failed to archive responses for company ${companyId}:`, error);
      throw error; // Re-throw to mark job as failed
    }
  }
};

const archiveWorker = new Worker('archive-jobs', processArchiveJob, { 
  connection,
  prefix: env.BULLMQ_QUEUE_PREFIX,
  lockDuration: 1000 * 60 * 5, // 5 minutes
});

archiveWorker.on('completed', (job: Job) => {
  console.log(`Archive job ${job.id} has completed.`);
});

archiveWorker.on('failed', (job: Job | undefined, error: Error) => {
  console.error(`Archive job ${job?.id} failed:`, error);
});

export default archiveWorker; 