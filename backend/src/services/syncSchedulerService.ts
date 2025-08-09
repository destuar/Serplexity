import { Queue } from "bullmq";
import { getBullMQOptions } from "../config/bullmq";
import { dbCache } from "../config/dbCache";

// Queue names must not contain ':'; prefix is applied via BullMQ options
const ga4Queue = new Queue("ga4-sync", getBullMQOptions());
const gscQueue = new Queue("gsc-sync", getBullMQOptions());

class SyncSchedulerService {
  async enqueueGa4Backfill(
    companyId: string,
    propertyId: string,
    days: number = 90
  ): Promise<void> {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await ga4Queue.add(
      "ga4-backfill",
      {
        companyId,
        propertyId,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
      },
      { attempts: 5 }
    );
    const prisma = await dbCache.getPrimaryClient();
    await prisma.syncJob.create({
      data: {
        companyId,
        provider: "ga4",
        targetType: "property",
        targetId: propertyId,
        startDate: start,
        endDate: end,
        status: "queued",
      },
    });
  }

  async enqueueGscBackfill(
    companyId: string,
    siteUrl: string,
    days: number = 90
  ): Promise<void> {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    await gscQueue.add(
      "gsc-backfill",
      {
        companyId,
        siteUrl,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        dimensions: ["date", "query", "page", "country", "device"],
      },
      { attempts: 5 }
    );
    const prisma = await dbCache.getPrimaryClient();
    await prisma.syncJob.create({
      data: {
        companyId,
        provider: "gsc",
        targetType: "site",
        targetId: siteUrl,
        startDate: start,
        endDate: end,
        status: "queued",
      },
    });
  }
}

export const syncSchedulerService = new SyncSchedulerService();
export default syncSchedulerService;
