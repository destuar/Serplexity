/**
 * @file usageRoutes.ts
 * @description Routes for usage analytics and report history
 */

import { Router } from 'express';
import { getReportHistory, getUsageStatistics } from '../controllers/usageController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Get report history for authenticated user
router.get('/reports', authenticate, getReportHistory);

// Get usage statistics summary for authenticated user
router.get('/stats', authenticate, getUsageStatistics);

export default router;