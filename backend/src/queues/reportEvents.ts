import { QueueEvents } from "bullmq";
import { getPrismaClient } from "../config/dbCache";
import { getBullMQOptions } from "../config/bullmq";
import logger from "../utils/logger";

const queueName = "report-generation";
const connectionOptions = getBullMQOptions();

// It's crucial to have a single QueueEvents instance per queue
// to avoid excessive Redis connections and ensure all events are captured.
const reportGenerationEvents = new QueueEvents(queueName, connectionOptions);

reportGenerationEvents.on("failed", async ({ jobId, failedReason }) => {
  if (!jobId) {
    logger.error(
      `[QueueEvents:${queueName}] Failed event received without a jobId.`,
      { failedReason },
    );
    return;
  }

  logger.info(
    `[QueueEvents:${queueName}] Job ${jobId} failed. Updating database status.`,
    { failedReason },
  );

  try {
    const prisma = await getPrismaClient();
    await prisma.reportRun.updateMany({
      where: { jobId: jobId },
      data: {
        status: "FAILED",
        stepStatus:
          `Job failed: ${failedReason}`.slice(0, 255) ||
          "Job failed with an unknown error.",
      },
    });
    logger.info(`[QueueEvents:${queueName}] Database updated for failed job ${jobId}.`);
  } catch (error) {
    logger.error(
      `[QueueEvents:${queueName}] CRITICAL: Failed to update database for failed job ${jobId}.`,
      { error },
    );
  }
});

reportGenerationEvents.on("completed", async ({ jobId, returnvalue }) => {
    if (!jobId) {
        logger.error(`[QueueEvents:${queueName}] Completed event received without a jobId.`, { returnvalue });
        return;
    }

    logger.info(`[QueueEvents:${queueName}] Job ${jobId} completed.`, { returnvalue });

    // While the worker should handle setting the final COMPLETED state,
    // this event can serve as a fallback or for additional logging if needed.
    // For now, we will just log the completion. In a more advanced setup,
    // you might reconcile state here as a safeguard.
});


reportGenerationEvents.on("error", (error) => {
  logger.error(`[QueueEvents:${queueName}] An error occurred`, { error });
});

logger.info(`[QueueEvents:${queueName}] Event listener initialized.`);

// Export the instance if it needs to be accessed elsewhere, though it's
// primarily designed to be self-contained.
export { reportGenerationEvents }; 