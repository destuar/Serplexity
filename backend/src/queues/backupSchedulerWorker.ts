/**
 * @file backupSchedulerWorker.ts
 * @description This file defines the BullMQ worker that processes backup scheduling jobs.
 * It checks for companies that missed their daily reports or had failed reports and queues them for regeneration.
 * It also handles emergency triggers to generate reports for all eligible companies. This worker is crucial for
 * maintaining the integrity and completeness of the report data.
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
 * - backupWorker: The BullMQ worker instance for backup scheduling jobs.
 */
import { Worker, Job } from "bullmq";
import env from "../config/env";
import { getBullMQConnection } from "../config/bullmq";
import { getDbClient } from "../config/database";
import { queueReport } from "../services/reportSchedulingService";
import { alertingService } from "../services/alertingService";

let backupWorker: Worker | null = null;

if (env.NODE_ENV !== "test") {
  backupWorker = new Worker(
    "backup-scheduler",
    async (job: Job) => {
      const startTime = new Date();

      if (job.name === "trigger-backup-daily-reports") {
        console.log(
          "[Backup Scheduler Worker] Starting backup daily report check...",
        );

        try {
          const prisma = await getDbClient();
          // Check which companies should have had reports today but don't
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          // Find companies that have previous completed reports (so they're eligible for daily reports)
          // Only include companies whose users have active subscriptions, active trials, or are admins  
          const eligibleCompanies = await prisma.company.findMany({
            where: {
              runs: {
                some: {
                  status: "COMPLETED",
                },
              },
              // Only include companies whose users have active subscriptions, active trials, or are admins
              user: {
                OR: [
                  // Active subscription
                  { subscriptionStatus: "active" },
                  // Admin users (always get reports)
                  { role: "ADMIN" },
                  // Active trial (not expired)
                  {
                    AND: [
                      { subscriptionStatus: "trialing" },
                      { trialEndsAt: { gt: new Date() } }
                    ]
                  }
                ]
              }
            },
            include: {
              runs: {
                where: {
                  createdAt: {
                    gte: today,
                    lt: tomorrow,
                  },
                },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          });

          console.log(
            `[Backup Scheduler Worker] Found ${eligibleCompanies.length} companies eligible for daily reports.`,
          );

          let companiesWithoutReports = 0;
          let companiesWithFailedReports = 0;
          let backupReportsTriggered = 0;

          for (const company of eligibleCompanies) {
            const todaysRun = company.runs[0];

            // Check if company needs a backup report
            let needsBackupReport = false;
            let reason = "";

            if (!todaysRun) {
              // No report at all today
              needsBackupReport = true;
              reason = "No report generated today";
              companiesWithoutReports++;
            } else if (todaysRun.status === "FAILED") {
              // Report failed
              needsBackupReport = true;
              reason = "Daily report failed";
              companiesWithFailedReports++;
            } else if (
              todaysRun.status === "PENDING" ||
              todaysRun.status === "RUNNING"
            ) {
              // Check if it's been running for too long (more than 2 hours)
              const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
              if (todaysRun.createdAt < twoHoursAgo) {
                needsBackupReport = true;
                reason = "Report stuck in processing for >2 hours";
              }
            }

            if (needsBackupReport) {
              try {
                console.log(
                  `[Backup Scheduler Worker] Triggering backup report for ${company.name}: ${reason}`,
                );

                // Force=true to bypass daily cache since this is a backup
                await queueReport(company.id, true);
                backupReportsTriggered++;

                // Small delay to avoid overwhelming the system
                await new Promise((resolve) => setTimeout(resolve, 100));
              } catch (error) {
                console.error(
                  `[Backup Scheduler Worker] Failed to queue backup report for company ${company.id} (${company.name}):`,
                  error,
                );

                // Alert about backup failure
                await alertingService
                  .alertSystemIssue({
                    component: "SCHEDULER",
                    message: `Backup scheduler failed to queue report for company: ${company.name}`,
                    details: {
                      companyId: company.id,
                      companyName: company.name,
                      reason,
                      error:
                        error instanceof Error ? error.message : String(error),
                    },
                    timestamp: new Date(),
                  })
                  .catch((alertError) => {
                    console.error(
                      "[Backup Scheduler Worker] Failed to send backup failure alert:",
                      alertError,
                    );
                  });
              }
            }
          }

          const duration = Date.now() - startTime.getTime();

          console.log(
            "[Backup Scheduler Worker] Backup scheduling completed:",
            {
              totalEligibleCompanies: eligibleCompanies.length,
              companiesWithoutReports,
              companiesWithFailedReports,
              backupReportsTriggered,
              durationMs: duration,
            },
          );

          // If no reports were triggered, that's actually good news
          if (backupReportsTriggered === 0) {
            console.log(
              "[Backup Scheduler Worker] ✅ All companies have successful reports today - no backup needed!",
            );
          } else {
            // Alert that backup scheduling was needed
            await alertingService
              .alertSystemIssue({
                component: "SCHEDULER",
                message: `Backup scheduler triggered ${backupReportsTriggered} backup reports`,
                details: {
                  backupReportsTriggered,
                  companiesWithoutReports,
                  companiesWithFailedReports,
                  totalEligibleCompanies: eligibleCompanies.length,
                  durationMs: duration,
                },
                timestamp: new Date(),
              })
              .catch((alertError) => {
                console.error(
                  "[Backup Scheduler Worker] Failed to send backup summary alert:",
                  alertError,
                );
              });
          }
        } catch (error) {
          console.error(
            "[Backup Scheduler Worker] Critical error during backup scheduling:",
            error,
          );

          await alertingService
            .alertSystemIssue({
              component: "SCHEDULER",
              message: "Backup scheduler encountered critical error",
              details: {
                error: error instanceof Error ? error.message : String(error),
                errorType: error instanceof Error ? error.name : "Unknown",
              },
              timestamp: new Date(),
            })
            .catch((alertError) => {
              console.error(
                "[Backup Scheduler Worker] Failed to send critical error alert:",
                alertError,
              );
            });

          throw error; // Re-throw to mark job as failed
        }
      } else if (job.name === "trigger-emergency-reports") {
        console.log(
          "[Backup Scheduler Worker] Processing emergency report trigger...",
        );
        const { reason, triggeredAt } = job.data;

        try {
          const prisma = await getDbClient();
          // For emergency triggers, queue reports for ALL eligible companies regardless of today's status
          // Only include companies whose users have active subscriptions, active trials, or are admins
          const companies = await prisma.company.findMany({
            where: {
              runs: {
                some: {
                  status: "COMPLETED",
                },
              },
              // Only include companies whose users have active subscriptions, active trials, or are admins
              user: {
                OR: [
                  // Active subscription
                  { subscriptionStatus: "active" },
                  // Admin users (always get reports)
                  { role: "ADMIN" },
                  // Active trial (not expired)
                  {
                    AND: [
                      { subscriptionStatus: "trialing" },
                      { trialEndsAt: { gt: new Date() } }
                    ]
                  }
                ]
              }
            },
            select: { id: true, name: true },
          });

          console.log(
            `[Backup Scheduler Worker] Emergency trigger: processing ${companies.length} companies (Reason: ${reason})`,
          );

          let successCount = 0;
          let failCount = 0;

          for (const company of companies) {
            try {
              await queueReport(company.id, true); // Force=true for emergency
              successCount++;
              // Small delay to avoid overwhelming
              await new Promise((resolve) => setTimeout(resolve, 50));
            } catch (error) {
              console.error(
                `[Backup Scheduler Worker] Emergency trigger failed for company ${company.id} (${company.name}):`,
                error,
              );
              failCount++;
            }
          }

          console.log(
            `[Backup Scheduler Worker] Emergency trigger completed: ${successCount} success, ${failCount} failed`,
          );

          await alertingService
            .alertSystemIssue({
              component: "SCHEDULER",
              message: `Emergency report trigger completed`,
              details: {
                reason,
                triggeredAt,
                totalCompanies: companies.length,
                successCount,
                failCount,
                completedAt: new Date().toISOString(),
              },
              timestamp: new Date(),
            })
            .catch((alertError) => {
              console.error(
                "[Backup Scheduler Worker] Failed to send emergency completion alert:",
                alertError,
              );
            });
        } catch (error) {
          console.error(
            "[Backup Scheduler Worker] Critical error during emergency trigger:",
            error,
          );
          throw error;
        }
      }
    },
    {
      connection: getBullMQConnection(),
      prefix: env.BULLMQ_QUEUE_PREFIX,
      concurrency: 1, // Only one backup scheduler job should run at a time
      lockDuration: 1000 * 60 * 10, // 10 minutes
    },
  );

  backupWorker.on("completed", (job: Job) => {
    console.log(
      `[Backup Scheduler Worker] Backup scheduler job ${job.id} (${job.name}) has completed.`,
    );
  });

  backupWorker.on("failed", async (job: Job | undefined, err: Error) => {
    if (job) {
      console.error(
        `[Backup Scheduler Worker] Backup scheduler job ${job.id} (${job.name}) has failed with ${err.message}`,
      );
    } else {
      console.error(
        `[Backup Scheduler Worker] A backup scheduler job has failed with ${err.message}`,
      );
    }

    // Send alert for backup scheduler failure
    try {
      await alertingService.alertSystemIssue({
        component: "SCHEDULER",
        message: "Backup scheduler failed",
        details: {
          jobName: job?.name || "unknown",
          jobId: job?.id || "unknown",
          error: err.message,
          errorType: err.name,
        },
        timestamp: new Date(),
      });
    } catch (alertError) {
      console.error(
        "[Backup Scheduler Worker] Failed to send backup scheduler failure alert:",
        alertError,
      );
    }
  });
}

export default backupWorker;
