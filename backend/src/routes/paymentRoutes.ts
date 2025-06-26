import { Router } from 'express';
import { createCheckoutSession, getStripeConfig, stripeWebhook } from '../controllers/paymentController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/config', authenticate, getStripeConfig);
router.post('/create-checkout-session', authenticate, createCheckoutSession);
router.post('/webhook', stripeWebhook);  // Webhook route should NOT have authentication

export default router; 