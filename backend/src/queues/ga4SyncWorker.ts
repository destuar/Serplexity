import { Job, Worker } from "bullmq";
import { google, analyticsdata_v1beta } from "googleapis";
import { getBullMQConnection, getWorkerOptions } from "../config/bullmq";
import { dbCache } from "../config/dbCache";
import env from "../config/env";
import { googleOAuthTokenService } from "../services/googleOAuthTokenService";
import logger from "../utils/logger";

interface Ga4SyncJobData {
  companyId: string;
  propertyId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

const QUEUE_NAME = `${env.BULLMQ_QUEUE_PREFIX}ga4:sync`;

const worker = new Worker<Ga4SyncJobData>(
  QUEUE_NAME,
  async (job: Job<Ga4SyncJobData>) => {
    const { companyId, propertyId, startDate, endDate } = job.data;
    const prisma = await dbCache.getPrimaryClient();
    try {
      const token = await googleOAuthTokenService.getDecryptedToken(companyId);
      if (!token?.accessToken) throw new Error("Missing Google OAuth token");
      const oauth2 = new google.auth.OAuth2();
      oauth2.setCredentials({ access_token: token.accessToken });
      const analyticsData: analyticsdata_v1beta.Analyticsdata = google.analyticsdata("v1beta");

      // Pull batched report with common dimensions to normalize into Ga4DailyMetrics
      const response = await analyticsData.properties.runReport({
        property: `properties/${String(propertyId)}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: "date" },
            { name: "country" },
            { name: "deviceCategory" },
            { name: "pagePath" },
            { name: "sessionDefaultChannelGroup" },
          ],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "activeUsers" },
            { name: "engagedSessions" },
            { name: "eventCount" },
            { name: "conversions" },
            { name: "averageSessionDuration" },
            { name: "averageEngagementTime" },
          ],
          limit: "100000",
        },
        auth: oauth2,
      });

      const rows = response.data?.rows || [];
      const records = rows.map((row: any) => {
        const dv = row.dimensionValues || [];
        const mv = row.metricValues || [];
        const dateStr = dv[0]?.value as string;
        return {
          companyId,
          propertyId,
          date: new Date(
            `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
          ),
          country: dv[1]?.value || null,
          device: dv[2]?.value || null,
          pagePath: dv[3]?.value || null,
          channelGroup: dv[4]?.value || null,
          sessions: Number(mv[0]?.value || 0),
          totalUsers: Number(mv[1]?.value || 0),
          activeUsers: Number(mv[2]?.value || 0),
          engagedSessions: Number(mv[3]?.value || 0),
          eventCount: Number(mv[4]?.value || 0),
          conversions: Number(mv[5]?.value || 0),
          sessionDurationSeconds: Number(mv[6]?.value || 0),
          avgEngagementTime: Number(mv[7]?.value || 0),
        };
      });

      // Upsert into normalized cache table
      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await prisma.ga4DailyMetrics.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }

      await prisma.syncJob.updateMany({
        where: { companyId, provider: "ga4", status: "running" },
        data: { status: "success", finishedAt: new Date() },
      });

      return { inserted: records.length };
    } catch (error) {
      logger.error("[GA4 Sync] Job failed", { error });
      await prisma.syncJob.updateMany({
        where: { companyId, provider: "ga4", status: "running" },
        data: {
          status: "failed",
          lastError: (error as Error).message,
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  },
  { ...getWorkerOptions(), connection: getBullMQConnection() }
);

worker.on("ready", () =>
  logger.info(`[GA4 Sync] Worker ready on ${QUEUE_NAME}`)
);
worker.on("failed", (job, err) =>
  logger.error(`[GA4 Sync] Job ${job?.id} failed`, { err })
);

export default worker;
