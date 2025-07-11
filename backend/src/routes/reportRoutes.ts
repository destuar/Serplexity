import { Router } from 'express';
import { createReport, getReportStatus, getLatestReport, getCompetitorRankingsForReport, getReportResponses } from '../controllers/reportController';
import { getCompanyOptimizationTasks, toggleOptimizationTaskCompletion, updateOptimizationTaskStatus, getCompanyVisibilitySummary } from '../controllers/optimizationController';
import { authenticate } from '../middleware/authMiddleware';
import { paymentGuard } from '../middleware/paymentGuard';

const router = Router();

// Enhanced report creation endpoint with company ID as URL parameter
// This endpoint is protected by authentication and a payment check
router.post('/companies/:companyId', authenticate, paymentGuard, createReport);

// This endpoint is protected by authentication
router.get('/:id/status', authenticate, getReportStatus);

router.get('/latest/:companyId', authenticate, getLatestReport);

router.get('/:runId/competitor-rankings', authenticate, getCompetitorRankingsForReport);

router.get('/:runId/responses', authenticate, getReportResponses);

// Optimization task endpoints
router.get('/companies/:companyId/optimization-tasks', authenticate, getCompanyOptimizationTasks);
router.patch('/reports/:reportRunId/tasks/:taskId/toggle', authenticate, toggleOptimizationTaskCompletion);
router.patch('/reports/:reportRunId/tasks/:taskId/status', authenticate, updateOptimizationTaskStatus);
router.get('/companies/:companyId/visibility-summary', authenticate, getCompanyVisibilitySummary);

export default router; 