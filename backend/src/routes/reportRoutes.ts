/**
 * @file reportRoutes.ts
 * @description This file defines the API routes for report generation, status checking, and retrieval,
 * as well as optimization tasks and system health. It integrates with `reportController` and `optimizationController`
 * for business logic, and `authMiddleware` and `paymentGuard` for authentication and authorization.
 * It also includes emergency endpoints for manual report triggering.
 *
 * @dependencies
 * - express: The Express framework for creating router instances.
 * - ../controllers/reportController: Controllers for report-related business logic.
 * - ../controllers/optimizationController: Controllers for optimization task business logic.
 * - ../middleware/authMiddleware: Middleware for authentication.
 * - ../middleware/paymentGuard: Middleware for payment status authorization.
 *
 * @exports
 * - router: The Express router instance for report routes.
 */
import { Role } from "@prisma/client";
import { Router } from "express";
import {
  addOptimizationTask,
  getCompanyOptimizationTasks,
  toggleOptimizationTaskCompletion,
  updateOptimizationTaskStatus,
} from "../controllers/optimizationController";
import {
  createReport,
  emergencyTriggerAllReports,
  emergencyTriggerCompanyReport,
  getCompetitorRankingsForReport,
  getLatestReport,
  getReportCitationDebug,
  getReportResponses,
  getReportStatus,
  getSystemHealth,
} from "../controllers/reportController";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { subscriptionGuard } from "../middleware/subscriptionGuard";

const router = Router();

// Enhanced report creation endpoint with company ID as URL parameter
// This endpoint is protected by authentication and active subscription
router.post(
  "/companies/:companyId",
  authenticate,
  subscriptionGuard,
  createReport
);

// This endpoint is protected by authentication
router.get("/:id/status", authenticate, getReportStatus);

router.get("/latest/:companyId", authenticate, getLatestReport);

router.get(
  "/:runId/competitor-rankings",
  authenticate,
  getCompetitorRankingsForReport
);

router.get("/:runId/responses", authenticate, getReportResponses);

// Debug endpoint for checking citation data
router.get("/:runId/citations/debug", authenticate, getReportCitationDebug);

// Optimization task endpoints
router.get(
  "/companies/:companyId/optimization-tasks",
  authenticate,
  getCompanyOptimizationTasks
);
router.post(
  "/companies/:companyId/optimization-tasks",
  authenticate,
  addOptimizationTask
);
router.patch(
  "/reports/:reportRunId/tasks/:taskId/toggle",
  authenticate,
  toggleOptimizationTaskCompletion
);
router.patch(
  "/reports/:reportRunId/tasks/:taskId/status",
  authenticate,
  updateOptimizationTaskStatus
);

// Emergency endpoints (admin/system use - may need additional admin authentication in production)
router.post(
  "/emergency/companies/:companyId/trigger-report",
  authenticate,
  authorize(Role.ADMIN),
  emergencyTriggerCompanyReport
);
router.post(
  "/emergency/trigger-all-reports",
  authenticate,
  authorize(Role.ADMIN),
  emergencyTriggerAllReports
);

// System health endpoint
router.get("/system/health", getSystemHealth);

export default router;
