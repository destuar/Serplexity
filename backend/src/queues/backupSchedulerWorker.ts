/**
 * @file backupSchedulerWorker.ts
 * @description This file defines the BullMQ worker that processes backup scheduling jobs.
 * It checks for companies that missed their daily reports or had failed reports and queues them for regeneration.
 * It also handles emergency triggers to generate reports for all eligible companies. This worker uses distributed
 * locking to coordinate with the master scheduler and prevent duplicate processing.
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
 * - backupWorker: The BullMQ worker instance for backup scheduling jobs.
 */
import { Job, Worker } from "bullmq";
import { getBullMQConnection } from "../config/bullmq";
import { getDbClient } from "../config/database";
import env from "../config/env";
import { alertingService } from "../services/alertingService";
import { shouldGenerateToday } from "../services/reportScheduleService";
import { queueReport } from "../services/reportSchedulingService";
import { distributedLockService } from "../services/distributedLockService";

let backupWorker: Worker | null = null;

if (env.NODE_ENV !== "test") {
  backupWorker = new Worker(
    "backup-scheduler",
    async (job: Job) => {
      const startTime = new Date();

      if (job.name === "trigger-backup-daily-reports") {
        const lockKey = "daily-report-scheduler";
        
        // Check if the master scheduler is still running or recently completed
        const lockStatus = await distributedLockService.isLockHeld(lockKey);
        if (lockStatus.held && lockStatus.remainingTtl && lockStatus.remainingTtl > 600000) { // More than 10 minutes remaining
          console.log(
            "[Backup Scheduler] Master scheduler is still active - skipping backup execution"
          );
          return;
        }

        // Try to acquire backup lock to prevent multiple backup schedulers
        const backupLockKey = "backup-report-scheduler";
        const lockResult = await distributedLockService.acquireLock(backupLockKey, {
          ttl: 1000 * 60 * 20, // 20 minutes - longer than expected processing time
          maxRetries: 2,
          retryDelay: 1000,
        });

        if (!lockResult.acquired) {
          console.log(
            "[Backup Scheduler] Could not acquire backup lock - another backup scheduler is running. Skipping execution."
          );
          return;
        }

        console.log(
          `[Backup Scheduler] Lock acquired (${lockResult.lockId}) - starting backup daily report check...`
        );

        try {
          const prisma = await getDbClient();
          // Check which companies should have had reports today but don't
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          // Find companies that have previous completed reports (so they're eligible for daily reports)
          // Only include companies whose users have active subscriptions or are admins (trials removed)
          const eligibleCompanies = await prisma.company.findMany({
            where: {
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
            `[Backup Scheduler Worker] Found ${eligibleCompanies.length} companies eligible for daily reports.`
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

            // Respect per-company schedule: only backfill if a run was expected today
            const scheduledToday = await shouldGenerateToday(
              prisma as any,
              company.id
            );
            if (!scheduledToday) {
              continue;
            }

            if (needsBackupReport) {
              try {
                console.log(
                  `[Backup Scheduler Worker] Triggering backup report for ${company.name}: ${reason}`
                );

                // Force=true to bypass daily cache since this is a backup
                await queueReport(company.id, true);
                backupReportsTriggered++;

                // Small delay to avoid overwhelming the system
                await new Promise((resolve) => setTimeout(resolve, 100));
              } catch (error) {
                console.error(
                  `[Backup Scheduler Worker] Failed to queue backup report for company ${company.id} (${company.name}):`,
                  error
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
                      alertError
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
            }
          );

          // If no reports were triggered, that's actually good news
          if (backupReportsTriggered === 0) {
            console.log(
              "[Backup Scheduler Worker] ✅ All companies have successful reports today - no backup needed!"
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
                  alertError
                );
              });
          }
        } catch (error) {
          console.error(
            "[Backup Scheduler] Critical error during backup scheduling:",
            error
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
                "[Backup Scheduler] Failed to send critical error alert:",
                alertError
              );
            });

          throw error; // Re-throw to mark job as failed
        } finally {
          // Always release the backup lock, even if there was an error
          if (lockResult.lockId) {
            const released = await distributedLockService.releaseLock(backupLockKey, lockResult.lockId);
            console.log(
              `[Backup Scheduler] Lock ${released ? 'released' : 'release failed'} (${lockResult.lockId})`
            );
          }
        }
      } else if (job.name === "trigger-emergency-reports") {
        console.log(
          "[Backup Scheduler] Processing emergency report trigger..."
        );
        const { reason, triggeredAt } = job.data;

        // Acquire emergency lock to prevent multiple emergency triggers
        const emergencyLockKey = "emergency-report-scheduler";
        const emergencyLockResult = await distributedLockService.acquireLock(emergencyLockKey, {
          ttl: 1000 * 60 * 30, // 30 minutes - emergency operations can take longer
          maxRetries: 1,
          retryDelay: 5000,
        });

        if (!emergencyLockResult.acquired) {
          console.log(
            "[Backup Scheduler] Could not acquire emergency lock - another emergency trigger is running. Skipping execution."
          );
          return;
        }

        console.log(
          `[Backup Scheduler] Emergency lock acquired (${emergencyLockResult.lockId}) - processing emergency trigger...`
        );

        try {
          const prisma = await getDbClient();
          // For emergency triggers, queue reports for ALL eligible companies regardless of today's status
          // Only include companies whose users have active subscriptions or are admins (trials removed)
          const companies = await prisma.company.findMany({
            where: {
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
            select: { id: true, name: true },
          });

          console.log(
            `[Backup Scheduler Worker] Emergency trigger: processing ${companies.length} companies (Reason: ${reason})`
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
                error
              );
              failCount++;
            }
          }

          console.log(
            `[Backup Scheduler Worker] Emergency trigger completed: ${successCount} success, ${failCount} failed`
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
                alertError
              );
            });
        } catch (error) {
          console.error(
            "[Backup Scheduler] Critical error during emergency trigger:",
            error
          );
          throw error;
        } finally {
          // Always release the emergency lock, even if there was an error
          if (emergencyLockResult.lockId) {
            const released = await distributedLockService.releaseLock(emergencyLockKey, emergencyLockResult.lockId);
            console.log(
              `[Backup Scheduler] Emergency lock ${released ? 'released' : 'release failed'} (${emergencyLockResult.lockId})`
            );
          }
        }
      }
    },
    {
      connection: getBullMQConnection(),
      prefix: env.BULLMQ_QUEUE_PREFIX,
      concurrency: 1, // Only one backup scheduler job should run at a time
      lockDuration: 1000 * 60 * 10, // 10 minutes
    }
  );

  backupWorker.on("completed", (job: Job) => {
    console.log(
      `[Backup Scheduler Worker] Backup scheduler job ${job.id} (${job.name}) has completed.`
    );
  });

  backupWorker.on("failed", async (job: Job | undefined, err: Error) => {
    if (job) {
      console.error(
        `[Backup Scheduler Worker] Backup scheduler job ${job.id} (${job.name}) has failed with ${err.message}`
      );
    } else {
      console.error(
        `[Backup Scheduler Worker] A backup scheduler job has failed with ${err.message}`
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
        alertError
      );
    }
  });
}

export default backupWorker;
