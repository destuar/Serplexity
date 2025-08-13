/**
 * @file reportSchedulingService.ts
 * @description This file defines the `reportSchedulingService`, which is responsible for queuing report generation jobs.
 * It acts as the single source of truth for initiating report runs, handling concurrency with a locking mechanism,
 * checking for existing reports to prevent duplicates (unless forced), and creating new report run entries in the database
 * before adding the job to the BullMQ queue. This service is crucial for managing the report generation workflow.
 *
 * @dependencies
 * - ../queues/reportGenerationQueue: The BullMQ queue for report generation jobs.
 * - ../config/db: The singleton Prisma client instance.
 * - @prisma/client: Prisma client types.
 *
 * @exports
 * - queueReport: Function to queue a new report generation job.
 * - scheduleReport: Function to schedule a report for a specific company (placeholder).
 */
import { getDbClient } from "../config/database";
import { reportGenerationQueue } from "../queues/reportGenerationQueue";
import { startReportForBilling } from "./usageService";

// Enhanced logging for the report scheduling service
interface SchedulingLogContext {
  companyId: string;
  runId?: string;
  step?: string;
  duration?: number;
  force?: boolean;
  error?: unknown;
  metadata?: Record<string, unknown>;
}

const schedulingLog = (
  context: SchedulingLogContext,
  message: string,
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" = "INFO"
) => {
  const timestamp = new Date().toISOString();
  const { companyId, runId, step, duration, force, error, metadata } = context;

  let logLine = `[${timestamp}][ReportSchedulingService][${level}]`;

  if (companyId) logLine += `[Company:${companyId}]`;
  if (runId) logLine += `[Run:${runId}]`;
  if (step) logLine += `[${step}]`;
  if (duration !== undefined) logLine += `[${duration}ms]`;
  if (force !== undefined) logLine += `[Force:${force}]`;

  logLine += ` ${message}`;

  if (metadata && Object.keys(metadata).length > 0) {
    logLine += ` | Meta: ${JSON.stringify(metadata)}`;
  }

  console.log(logLine);

  if (error) {
    const errorDetails =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : {
            message: String(error),
            stack: undefined,
            name: "Unknown",
          };

    console.error(`[${timestamp}][ReportSchedulingService][ERROR_DETAIL]`, {
      ...errorDetails,
      companyId,
      runId,
      step,
      metadata,
    });
  }
};

const reportQueueLocks = new Set<string>();

interface QueueResult {
  isNew: boolean;
  runId: string;
  status: string;
}

/**
 * Queues a new report generation job for a company, or returns an existing one if run today.
 * This is the single source of truth for starting a report run.
 * @param companyId The ID of the company to generate the report for.
 * @param force Whether to bypass the daily cache.
 * @returns A promise that resolves with the result of the queueing operation.
 */
export async function queueReport(
  companyId: string,
  force = false
): Promise<QueueResult> {
  const prisma = await getDbClient();
  const startTime = Date.now();

  if (reportQueueLocks.has(companyId)) {
    schedulingLog(
      {
        companyId,
        step: "LOCK_CHECK",
        metadata: { locked: true },
      },
      "Report queuing already in progress for this company.",
      "WARN"
    );

    // A report is already being queued. Find the most recent run to return its status.
    const recentRun = await prisma.reportRun.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    if (recentRun) {
      return {
        isNew: false,
        runId: recentRun.id,
        status: recentRun.status,
      };
    }

    // This case is unlikely, but as a fallback, we indicate a locked state.
    // The client should interpret this as "a process is running, please wait".
    throw new Error(
      "A report for this company is already being processed. Please wait a moment."
    );
  }

  reportQueueLocks.add(companyId);

  try {
    schedulingLog(
      {
        companyId,
        force,
        step: "START",
        metadata: { timestamp: new Date().toISOString() },
      },
      `Report queue request received - Force mode: ${force}`
    );

    // Check for existing runs first (unless forced)
    if (!force) {
      const checkTimer = Date.now();
      schedulingLog(
        { companyId, force, step: "EXISTING_CHECK" },
        "Checking for existing report runs today"
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingRun = await prisma.reportRun.findFirst({
        where: {
          companyId,
          status: { in: ["COMPLETED", "RUNNING", "PENDING"] },
          createdAt: { gte: today },
        },
        orderBy: { createdAt: "desc" },
      });

      const checkDuration = Date.now() - checkTimer;

      if (existingRun) {
        const totalDuration = Date.now() - startTime;
        schedulingLog(
          {
            companyId,
            runId: existingRun.id,
            force,
            step: "EXISTING_FOUND",
            duration: totalDuration,
            metadata: {
              existingStatus: existingRun.status,
              existingCreatedAt: existingRun.createdAt,
              checkDuration,
            },
          },
          `Found existing report run: ${existingRun.id} (${existingRun.status})`
        );

        return {
          isNew: false,
          runId: existingRun.id,
          status: existingRun.status,
        };
      }

      schedulingLog(
        {
          companyId,
          force,
          step: "NO_EXISTING_FOUND",
          duration: checkDuration,
        },
        "No existing report runs found for today - proceeding with new report"
      );
    } else {
      schedulingLog(
        { companyId, force, step: "FORCE_SKIP_CHECK" },
        "Force mode enabled - skipping existing run check"
      );
    }

    // Fetch company data
    const companyFetchTimer = Date.now();
    schedulingLog(
      { companyId, force, step: "COMPANY_FETCH" },
      "Fetching company data and competitors"
    );

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        competitors: true,
      },
    });

    const companyFetchDuration = Date.now() - companyFetchTimer;

    if (!company) {
      const totalDuration = Date.now() - startTime;
      schedulingLog(
        {
          companyId,
          force,
          step: "COMPANY_NOT_FOUND",
          duration: totalDuration,
          error: new Error(`Company with ID ${companyId} not found`),
        },
        `Company not found: ${companyId}`,
        "ERROR"
      );

      throw new Error(`Company with ID ${companyId} not found.`);
    }

    schedulingLog(
      {
        companyId,
        force,
        step: "COMPANY_LOADED",
        duration: companyFetchDuration,
        metadata: {
          companyName: company.name,
          industry: company.industry,
          competitorsCount: company.competitors.length,
          productsCount: 0,
          visibilityQuestionsCount: 0,
          benchmarkQuestionsCount: 0,
        },
      },
      `Company loaded: ${company.name} (${company.competitors.length} competitors)`
    );

    // Create new report run
    const reportCreateTimer = Date.now();
    schedulingLog(
      { companyId, force, step: "REPORT_CREATE" },
      "Creating new report run in database"
    );

    const reportRun = await prisma.reportRun.create({
      data: {
        companyId,
        status: "PENDING",
        stepStatus: "Queued for processing",
      },
    });

    const reportCreateDuration = Date.now() - reportCreateTimer;
    schedulingLog(
      {
        companyId,
        runId: reportRun.id,
        force,
        step: "REPORT_CREATED",
        duration: reportCreateDuration,
        metadata: {
          reportId: reportRun.id,
          initialStatus: reportRun.status,
          createdAt: reportRun.createdAt,
        },
      },
      `Report run created: ${reportRun.id}`
    );

    // Add job to queue
    const queueTimer = Date.now();
    schedulingLog(
      {
        companyId,
        runId: reportRun.id,
        force,
        step: "QUEUE_ADD",
      },
      "Adding report generation job to queue"
    );

    const jobOptions = {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 5000 },
    };

    if (!reportGenerationQueue) {
      throw new Error(
        "Report generation queue is not available in test environment"
      );
    }

    const job = await reportGenerationQueue.add(
      "report-generation",
      {
        runId: reportRun.id,
        company: company,
        force: force,
      },
      jobOptions
    );

    // Now that we have the job ID, update the report run record
    await prisma.reportRun.update({
      where: { id: reportRun.id },
      data: { jobId: job.id },
    });

    // Billing: decide if overage and place budget hold if needed, using conservative defaults
    try {
      await startReportForBilling(
        company.userId,
        company.id,
        reportRun.id,
        20,
        4
      );
    } catch (billingError) {
      // Mark run as failed and do not enqueue further work
      await prisma.reportRun.update({
        where: { id: reportRun.id },
        data: {
          status: "FAILED",
          stepStatus:
            billingError instanceof Error
              ? billingError.message
              : "Billing check failed",
        },
      });
      throw billingError;
    }

    const queueDuration = Date.now() - queueTimer;
    const totalDuration = Date.now() - startTime;

    schedulingLog(
      {
        companyId,
        runId: reportRun.id,
        force,
        step: "QUEUE_SUCCESS",
        duration: totalDuration,
        metadata: {
          queueDuration,
          jobOptions,
          queueName: "report-generation",
          companyName: company.name,
        },
      },
      `Report generation job queued successfully - Total time: ${totalDuration}ms`
    );

    return {
      isNew: true,
      runId: reportRun.id,
      status: reportRun.status,
    };
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    schedulingLog(
      {
        companyId,
        force,
        step: "ERROR",
        duration: totalDuration,
        error,
      },
      `Failed to queue report generation: ${error instanceof Error ? error.message : String(error)}`,
      "ERROR"
    );

    // Re-throw the error to be handled by the calling controller
    throw error;
  } finally {
    reportQueueLocks.delete(companyId);
    schedulingLog(
      { companyId, step: "LOCK_RELEASED" },
      "Report queue lock released."
    );
  }
}

/**
 * Schedules a report for a specific company if it has a schedule.
 */
export async function scheduleReport(_companyId: string) {
  const _prisma = await getDbClient();
  // Implementation of scheduleReport function
}
