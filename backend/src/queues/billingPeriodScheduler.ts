import { Job, Queue, Worker } from "bullmq";
import { getBullMQConnection, getBullMQOptions } from "../config/bullmq";
import env from "../config/env";
import { closeDueBillingPeriods } from "../services/billingService";

export const billingSchedulerQueue = new Queue(
  "billing-scheduler",
  getBullMQOptions()
);

export async function scheduleDailyBillingClose() {
  // Remove existing repeatables
  const repeats = await billingSchedulerQueue.getRepeatableJobs();
  for (const r of repeats) {
    await billingSchedulerQueue.removeRepeatableByKey(r.key);
  }
  await billingSchedulerQueue.add(
    "close-billing-periods",
    {},
    {
      repeat: {
        pattern: "5 6 * * *", // Daily 06:05 UTC to follow backup scheduler
      },
      jobId: "daily-billing-close",
    }
  );
}

let worker: Worker | null = null;
if (env.NODE_ENV !== "test") {
  worker = new Worker(
    "billing-scheduler",
    async (job: Job) => {
      if (job.name === "close-billing-periods") {
        const processed = await closeDueBillingPeriods();
        console.log(
          `[Billing Scheduler] Closed/invoiced periods: ${processed}`
        );
      }
    },
    {
      connection: getBullMQConnection(),
      prefix: env.BULLMQ_QUEUE_PREFIX,
      concurrency: 1,
    }
  );

  worker.on("completed", (job: Job) => {
    console.log(`[Billing Scheduler] Job ${job.id} completed.`);
  });
  worker.on("failed", (job: Job | undefined, err: Error) => {
    if (job) {
      console.error(`[Billing Scheduler] Job ${job.id} failed:`, err.message);
    } else {
      console.error(`[Billing Scheduler] Job failed:`, err.message);
    }
  });
}

export default worker;
