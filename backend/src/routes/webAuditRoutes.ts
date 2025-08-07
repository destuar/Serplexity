/**
 * @file webAuditRoutes.ts
 * @description Web audit API routes
 * 
 * Defines REST endpoints for web audit functionality:
 * - POST /start - Start new audit
 * - GET /:id - Get audit results
 * - GET /:id/status - Get audit status only
 * - GET /history - Get audit history
 * - DELETE /:id - Delete audit
 * - GET /health - Service health check
 * 
 * @dependencies
 * - Express router
 * - Web audit controller
 * - Authentication middleware
 * - Rate limiting middleware
 */

import express from "express";
import rateLimit from "express-rate-limit";
import {
  startAudit,
  getAudit,
  getAuditHistory,
  deleteAudit,
  getAuditStatus,
  healthCheck,
} from "../controllers/webAuditController";
import { authenticate } from "../middleware/authMiddleware";

const router = express.Router();

// Rate limiting for audit requests
const auditRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 audit requests per windowMs
  message: {
    error: "Too many audit requests",
    message: "You can only start 10 audits per 15 minutes. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for result requests (more lenient)
const resultRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 result requests per minute
  message: {
    error: "Too many requests",
    message: "Too many result requests. Please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint (no auth required)
router.get("/health", healthCheck);

// Start new web audit (company-scoped)
router.post("/companies/:companyId/start", authenticate, auditRateLimit, startAudit);

// Get audit history for company
router.get("/companies/:companyId/history", authenticate, resultRateLimit, getAuditHistory);

// Get audit status only (lightweight)
router.get("/:id/status", authenticate, resultRateLimit, getAuditStatus);

// Get full audit results
router.get("/:id", authenticate, resultRateLimit, getAudit);

// Delete audit (company-scoped)
router.delete("/companies/:companyId/audits/:id", authenticate, deleteAudit);

export default router;