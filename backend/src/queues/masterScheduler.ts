/**
 * @file masterScheduler.ts
 * @description This file defines the BullMQ queue and function for scheduling the main daily report generation.
 * It ensures that only one daily report trigger job is scheduled, preventing duplicates. This is a core component
 * for automating the report generation process.
 *
 * @dependencies
 * - bullmq: The BullMQ library for creating queues.
 * - ../config/env: Environment variable configuration.
 * - ../config/bullmq: BullMQ configuration options.
 *
 * @exports
 * - masterSchedulerQueue: The BullMQ queue for master scheduling.
 * - scheduleDailyReportTrigger: Function to schedule the daily report trigger.
 */
import { Queue } from "bullmq";
import env from "../config/env";
import { getBullMQOptions } from "../config/bullmq";

export const masterSchedulerQueue = new Queue(
  "master-scheduler",
  getBullMQOptions(),
);

/**
 * Schedules the daily job to trigger report generation for all companies.
 * It removes any old repeatable jobs to ensure there's only one scheduled.
 */
export async function scheduleDailyReportTrigger() {
  // Remove any old repeatable jobs to ensure we only have one.
  const repeatableJobs = await masterSchedulerQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await masterSchedulerQueue.removeRepeatableByKey(job.key);
  }

  // Add the new repeatable job.
  await masterSchedulerQueue.add(
    "trigger-daily-reports",
    {}, // No data needed for the trigger job
    {
      repeat: {
        pattern: "0 5 * * *", // Every day at 5:00 AM UTC
      },
      jobId: "daily-report-trigger", // A fixed ID to prevent duplicates
    },
  );
  console.log(
    "[Scheduler] Daily report trigger job scheduled to run at 5:00 AM UTC.",
  );
}
