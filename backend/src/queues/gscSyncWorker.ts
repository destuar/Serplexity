import { Job, Worker } from "bullmq";
import { google } from "googleapis";
import { getBullMQConnection, getWorkerOptions } from "../config/bullmq";
import { dbCache } from "../config/dbCache";
import env from "../config/env";
import { googleOAuthTokenService } from "../services/googleOAuthTokenService";
import logger from "../utils/logger";

interface GscSyncJobData {
  companyId: string;
  siteUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions: string[]; // e.g., ["date"], ["query"], etc.
}

const QUEUE_NAME = `${env.BULLMQ_QUEUE_PREFIX}gsc:sync`;

const worker = new Worker<GscSyncJobData>(
  QUEUE_NAME,
  async (job: Job<GscSyncJobData>) => {
    const { companyId, siteUrl, startDate, endDate, dimensions } = job.data;
    const prisma = await dbCache.getPrimaryClient();
    try {
      const token = await googleOAuthTokenService.getDecryptedToken(companyId, "gsc");
      if (!token?.accessToken) throw new Error("Missing Google OAuth token");
      const oauth2 = new (google as any).auth.OAuth2();
      oauth2.setCredentials({ access_token: token.accessToken });
      const webmasters = google.webmasters({ version: "v3", auth: oauth2 });

      // page through Search Console rows using rowLimit and startRow
      const rowLimit = 25000;
      let startRow = 0;
      while (true) {
        const resp = await webmasters.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate,
            endDate,
            dimensions,
            rowLimit,
            startRow,
          },
        });
        const rows = resp.data.rows || [];
        if (rows.length === 0) break;

        const normalized = rows.map((row) => {
          const keys = row.keys || [];
          const indexOf = (name: string) => dimensions.indexOf(name);
          const idxDate = indexOf("date");
          const idxQuery = indexOf("query");
          const idxPage = indexOf("page");
          const idxCountry = indexOf("country");
          const idxDevice = indexOf("device");
          const dateStr = idxDate >= 0 ? keys[idxDate] : startDate;
          return {
            companyId,
            siteUrl,
            date: new Date(dateStr as string),
            query: idxQuery >= 0 ? (keys[idxQuery] as string) : null,
            page: idxPage >= 0 ? (keys[idxPage] as string) : null,
            country: idxCountry >= 0 ? (keys[idxCountry] as string) : null,
            device: idxDevice >= 0 ? (keys[idxDevice] as string) : null,
            impressions: row.impressions || 0,
            clicks: row.clicks || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
          };
        });

        await prisma.gscDailyMetrics.createMany({
          data: normalized,
          skipDuplicates: true,
        });
        startRow += rows.length;
        if (rows.length < rowLimit) break;
      }

      await prisma.syncJob.updateMany({
        where: { companyId, provider: "gsc", status: "running" },
        data: { status: "success", finishedAt: new Date() },
      });
      return { status: "ok" };
    } catch (error) {
      logger.error("[GSC Sync] Job failed", { error });
      await prisma.syncJob.updateMany({
        where: { companyId, provider: "gsc", status: "running" },
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
  logger.info(`[GSC Sync] Worker ready on ${QUEUE_NAME}`)
);
worker.on("failed", (job, err) =>
  logger.error(`[GSC Sync] Job ${job?.id} failed`, { err })
);

export default worker;
