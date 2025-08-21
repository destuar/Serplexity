import { Router } from "express";
import {
  getBillingSummary,
  getInvoiceHistory,
  getReportsSeries,
  getUsageSeries,
  updateBudget,
  updatePlan,
} from "../controllers/billingController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

// All billing routes require authentication
router.use(authenticate);

router.get("/summary", getBillingSummary);
router.get("/usage", getUsageSeries);
router.get("/reports", getReportsSeries);
router.get("/invoices", getInvoiceHistory);
router.post("/budget", updateBudget);
router.post("/plan", updatePlan);

export default router;
