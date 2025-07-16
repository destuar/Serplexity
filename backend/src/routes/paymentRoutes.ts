/**
 * @file paymentRoutes.ts
 * @description This file defines the API routes for payment processing, including creating Stripe checkout sessions
 * and handling Stripe webhooks. It integrates with `paymentController` for business logic and `authMiddleware` for authentication,
 * with the webhook route intentionally left unauthenticated as per Stripe's requirements.
 *
 * @dependencies
 * - express: The Express framework for creating router instances.
 * - ../controllers/paymentController: Controllers for payment-related business logic.
 * - ../middleware/authMiddleware: Middleware for authentication.
 *
 * @exports
 * - router: The Express router instance for payment routes.
 */
import { Router } from 'express';
import { createCheckoutSession, getStripeConfig, stripeWebhook } from '../controllers/paymentController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/config', authenticate, getStripeConfig);
router.post('/create-checkout-session', authenticate, createCheckoutSession);
router.post('/webhook', stripeWebhook);  // Webhook route should NOT have authentication

export default router; 