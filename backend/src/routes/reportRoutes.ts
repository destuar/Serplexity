import { Router } from 'express';
import { createReport, getReportStatus, getLatestReport } from '../controllers/reportController';
import { authenticate } from '../middleware/authMiddleware';
import { paymentGuard } from '../middleware/paymentGuard';

const router = Router();

// This endpoint is protected by authentication and a payment check
router.post('/', authenticate, paymentGuard, createReport);

// This endpoint is protected by authentication
router.get('/:id/status', authenticate, getReportStatus);

router.get('/latest/:companyId', authenticate, getLatestReport);

export default router; 