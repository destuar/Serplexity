/**
 * @file masterSchedulerWorker.ts
 * @description This file defines the BullMQ worker that processes the main daily report generation jobs.
 * It iterates through eligible companies and queues a report generation job for each, respecting the daily cache.
 * This worker uses distributed locking to prevent race conditions with backup schedulers.
 *
 * @dependencies
 * - bullmq: The BullMQ library for creating workers.
 * - ../config/env: Environment variable configuration.
 * - ../config/bullmq: BullMQ connection configuration.
 * - ../config/db: The singleton Prisma client instance.
 * - ../services/reportSchedulingService: Service for queuing report generation.
 * - ../services/alertingService: Service for sending system alerts.
 * - ../services/distributedLockService: Service for preventing scheduler race conditions.
 *
 * @exports
 * - worker: The BullMQ worker instance for master scheduling jobs.
 */
import { Job, Worker } from "bullmq";
import { getBullMQConnection } from "../config/bullmq";
import { getDbClient } from "../config/database";
import env from "../config/env";
import { alertingService } from "../services/alertingService";
import { shouldGenerateToday } from "../services/reportScheduleService";
import { queueReport } from "../services/reportSchedulingService";
import { distributedLockService } from "../services/distributedLockService";

let worker: Worker | null = null;

if (env.NODE_ENV !== "test") {
  worker = new Worker(
    "master-scheduler",
    async (job: Job) => {
      if (job.name === "trigger-daily-reports") {
        const lockKey = "daily-report-scheduler";
        const lockResult = await distributedLockService.acquireLock(lockKey, {
          ttl: 1000 * 60 * 15, // 15 minutes - longer than expected processing time
          maxRetries: 3,
          retryDelay: 2000,
        });

        if (!lockResult.acquired) {
          console.log(
            "[Master Scheduler] Could not acquire lock - another scheduler is running or recently completed. Skipping execution."
          );
          return;
        }

        console.log(
          `[Master Scheduler] Lock acquired (${lockResult.lockId}) - starting to queue daily reports for all companies...`
        );

        try {
          const prisma = await getDbClient();
          const companies = await prisma.company.findMany({
            where: {
              // Only select companies that have at least one completed report run.
              // This ensures the scheduler doesn't generate the very first report.
              runs: {
                some: {
                  status: "COMPLETED",
                },
              },
              // Only include companies whose users have active subscriptions or are admins (trials removed)
              user: {
                OR: [
                  // Active subscription
                  { subscriptionStatus: "active" },
                  // Admin users (always get reports)
                  { role: "ADMIN" },
                  // Trials removed
                ],
              },
            },
            select: { id: true },
          });

          console.log(
            `[Master Scheduler] Found ${companies.length} companies to process for daily reports.`
          );

          let processedCount = 0;
          let errorCount = 0;

          for (const company of companies) {
            try {
              // Respect per-company schedule
              const ok = await shouldGenerateToday(prisma as any, company.id);
              if (!ok) {
                continue;
              }
              // We call queueReport with force=false, so it respects the daily cache.
              await queueReport(company.id, false);
              processedCount++;
            } catch (error) {
              errorCount++;
              console.error(
                `[Master Scheduler] Failed to queue report for company ${company.id}:`,
                error
              );
              // Continue to the next company even if one fails
            }
          }

          console.log(
            `[Master Scheduler] Finished queuing daily reports. Processed: ${processedCount}, Errors: ${errorCount}, Total companies: ${companies.length}`
          );
        } finally {
          // Always release the lock, even if there was an error
          if (lockResult.lockId) {
            const released = await distributedLockService.releaseLock(lockKey, lockResult.lockId);
            console.log(
              `[Master Scheduler] Lock ${released ? 'released' : 'release failed'} (${lockResult.lockId})`
            );
          }
        }
      }
    },
    {
      connection: getBullMQConnection(),
      prefix: env.BULLMQ_QUEUE_PREFIX,
      concurrency: 1, // Only one of these scheduler jobs should run at a time.
      lockDuration: 1000 * 60 * 5, // 5 minutes
    }
  );

  worker.on("completed", (job: Job) => {
    console.log(
      `[Scheduler Worker] Master scheduler job ${job.id} has completed.`
    );
  });

  worker.on("failed", async (job: Job | undefined, err: Error) => {
    if (job) {
      console.error(
        `[Scheduler Worker] Master scheduler job ${job.id} has failed with ${err.message}`
      );
    } else {
      console.error(
        `[Scheduler Worker] A master scheduler job has failed with ${err.message}`
      );
    }

    // Send alert for scheduler failure
    try {
      await alertingService.alertSchedulerFailure(err, new Date());
    } catch (alertError) {
      console.error(
        "[Scheduler Worker] Failed to send scheduler failure alert:",
        alertError
      );
    }
  });
}

export default worker;
