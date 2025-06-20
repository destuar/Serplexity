import { Router } from 'express';
import { createCheckoutSession, getStripeConfig } from '../controllers/paymentController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/config', authenticate, getStripeConfig);
router.post('/create-checkout-session', authenticate, createCheckoutSession);

export default router; 