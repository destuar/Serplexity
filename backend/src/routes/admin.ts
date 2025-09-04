/**
 * @file admin.ts
 * @description Admin routes for dead letter queue management and system monitoring
 */

import { Router } from "express";
import { authenticateAdmin } from "../middleware/authMiddleware";
import {
  getFailedJobs,
  retryFailedJob,
  bulkRetryJobs,
  markJobsAsPermanent,
  getSystemHealth,
  forceCircuitRecovery,
  cleanupDeadLetterQueue,
  getHistoricalMetrics,
  acknowledgeAlert,
  triggerHealthCheck,
  getActiveReports,
  getReportProgress,
} from "../controllers/adminController";

const router = Router();

// All admin routes require admin authentication
router.use(authenticateAdmin);

// Dead letter queue management
router.get("/failed-jobs", getFailedJobs);
router.post("/failed-jobs/:jobId/retry", retryFailedJob);
router.post("/failed-jobs/bulk-retry", bulkRetryJobs);
router.post("/failed-jobs/mark-permanent", markJobsAsPermanent);
router.post("/failed-jobs/cleanup", cleanupDeadLetterQueue);

// System health and recovery
router.get("/system-health", getSystemHealth);
router.get("/metrics/historical", getHistoricalMetrics);
router.post("/alerts/:alertId/acknowledge", acknowledgeAlert);
router.post("/health/trigger", triggerHealthCheck);
router.post("/circuit-breakers/force-recovery", forceCircuitRecovery);

// Report progress tracking
router.get("/reports/active", getActiveReports);
router.get("/reports/:runId/progress", getReportProgress);

export default router;