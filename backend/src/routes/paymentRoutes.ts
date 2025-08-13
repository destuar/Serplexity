import { Router } from "express";
import {
  createCheckoutSession,
  getStripeConfig,
  stripeWebhook,
} from "../controllers/paymentController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

router.get("/config", authenticate, getStripeConfig);
router.post("/checkout", authenticate, createCheckoutSession);
// Webhook route should NOT have authentication; ensure raw body parsing is configured in app.ts
router.post("/webhook", stripeWebhook);

export default router;
