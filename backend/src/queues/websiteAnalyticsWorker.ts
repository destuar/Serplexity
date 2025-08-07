/**
 * @file websiteAnalyticsWorker.ts
 * @description Background worker for syncing Google Search Console data
 */

import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { dbCache } from '../config/dbCache';
import { googleSearchConsoleService } from '../services/googleSearchConsoleService';
import env from '../config/env';

interface SyncJobData {
  integrationId: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

const QUEUE_NAME = `${env.BULLMQ_QUEUE_PREFIX}website-analytics`;

// Initialize the worker
const websiteAnalyticsWorker = new Worker(
  QUEUE_NAME,
  async (job: Job<SyncJobData>) => {
    const { integrationId, dateRange } = job.data;
    
    console.log(`🔄 Starting analytics sync for integration ${integrationId}`);
    
    try {
      // Get the integration details
      const prisma = await dbCache.getPrimaryClient();
      const integration = await prisma.analyticsIntegration.findUnique({
        where: { id: integrationId },
        include: { company: true }
      });

      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      if (integration.integrationName !== 'google_search_console') {
        console.log(`⏭️ Skipping sync for integration type: ${integration.integrationName}`);
        return { skipped: true, reason: 'Not a Google Search Console integration' };
      }

      if (integration.status !== 'active') {
        console.log(`⏭️ Skipping sync for inactive integration: ${integration.status}`);
        return { skipped: true, reason: `Integration status: ${integration.status}` };
      }

      // Initialize Google Search Console service
      const gscService = googleSearchConsoleService;

      // Set date range - default to last 7 days
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];
      const startDate = dateRange?.startDate || 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      console.log(`📊 Fetching GSC data for ${startDate} to ${endDate}`);

      // Fetch search performance data
      const performanceData = await gscService.getPerformanceData(
        integration.accessToken!,
        integration.gscPropertyUrl!,
        startDate,
        endDate
      );

      console.log(`📈 Retrieved ${performanceData.length} performance records`);

      // Store the data in batches
      const batchSize = 100;
      let processed = 0;

      for (let i = 0; i < performanceData.length; i += batchSize) {
        const batch = performanceData.slice(i, i + batchSize);
        
        const analyticsData = batch.map(data => ({
          integrationId: integration.id,
          date: new Date(data.date),
          source: 'search_console',
          query: data.query,
          page: data.page,
          impressions: data.impressions,
          clicks: data.clicks,
          ctr: data.ctr,
          position: data.position,
          deviceType: data.device,
          country: data.country
        }));

        // Create records in batches
        await prisma.analyticsData.createMany({
          data: analyticsData,
          skipDuplicates: true
        });

        processed += batch.length;
        console.log(`💾 Processed ${processed}/${performanceData.length} records`);
      }

      // Update integration last sync timestamp
      await prisma.analyticsIntegration.update({
        where: { id: integrationId },
        data: { 
          lastSyncAt: new Date()
        }
      });

      console.log(`✅ Analytics sync completed for integration ${integrationId}`);
      
      return {
        success: true,
        recordsProcessed: processed,
        dateRange: { startDate, endDate }
      };

    } catch (error) {
      console.error(`❌ Analytics sync failed for integration ${integrationId}:`, error);
      
      // Update integration with error status
      const prisma = await dbCache.getPrimaryClient();
      await prisma.analyticsIntegration.update({
        where: { id: integrationId },
        data: { 
          lastSyncAt: new Date()
        }
      }).catch(dbError => {
        console.error('Failed to update integration error status:', dbError);
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2, // Process up to 2 sync jobs simultaneously
    limiter: {
      max: 10, // Max 10 jobs per duration
      duration: 60 * 1000 // 1 minute
    }
  }
);

// Error handling
websiteAnalyticsWorker.on('completed', (job) => {
  console.log(`✅ Website analytics job ${job.id} completed successfully`);
});

websiteAnalyticsWorker.on('failed', (job, err) => {
  console.error(`❌ Website analytics job ${job?.id} failed:`, err.message);
});

websiteAnalyticsWorker.on('error', (err) => {
  console.error('❌ Website analytics worker error:', err);
});

console.log('🚀 Website Analytics Worker initialized');

export { websiteAnalyticsWorker, QUEUE_NAME };