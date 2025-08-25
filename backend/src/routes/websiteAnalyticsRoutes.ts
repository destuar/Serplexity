/**
 * @file websiteAnalyticsRoutes.ts
 * @description Routes for website analytics integration endpoints
 *
 * These routes allow Serplexity users to:
 * - Set up Google Search Console integration
 * - Set up manual tracking via JavaScript
 * - View their website analytics metrics
 * - Manage their analytics integrations
 */

import { Router } from "express";
import * as websiteAnalyticsController from "../controllers/websiteAnalyticsController";
import { authenticate } from "../middleware/authMiddleware";
import { addCompanyContext } from "../middleware/companyMiddleware";

const router = Router();

// OAuth callback routes (MUST be public - no authentication required)
// OAuth providers (Google) call these directly without auth headers
router.get("/oauth/callback", websiteAnalyticsController.handleOAuthCallback);
router.get(
  "/integrations/google/callback",
  websiteAnalyticsController.handleOAuthCallback
);

// All other routes require authentication - these are for Serplexity users managing their website analytics
router.use(authenticate);
router.use(addCompanyContext);

// Integration management routes - company-scoped
router.post("/companies/:companyId/integrations", websiteAnalyticsController.createIntegration);
router.get("/companies/:companyId/integrations", websiteAnalyticsController.getIntegrations);
router.delete(
  "/companies/:companyId/integrations/:integrationId",
  websiteAnalyticsController.deleteIntegration
);

// Legacy routes (for backward compatibility)
router.post("/integrations", websiteAnalyticsController.createIntegration);
router.get("/integrations", websiteAnalyticsController.getIntegrations);
router.delete(
  "/integrations/:integrationId",
  websiteAnalyticsController.deleteIntegration
);

// Verification routes
router.post(
  "/integrations/:integrationId/verify",
  websiteAnalyticsController.verifyIntegration
);
router.get(
  "/integrations/:integrationId/health",
  websiteAnalyticsController.getIntegrationHealth
);

router.get(
  "/integrations/:integrationId/properties",
  websiteAnalyticsController.getGSCProperties
);
router.post(
  "/integrations/:integrationId/sync",
  websiteAnalyticsController.syncIntegrationData
);

// Analytics data routes
router.get("/metrics", websiteAnalyticsController.getMetrics);
router.get("/ga4/metrics", websiteAnalyticsController.getGa4Metrics);
router.get("/ga4/active-users", websiteAnalyticsController.getGa4ActiveUsers);

// GA4 property management routes
router.get("/ga4/properties", websiteAnalyticsController.getGA4Properties);
router.post("/integrations/:integrationId/ga4-property", websiteAnalyticsController.setGA4Property);

// Manual tracking route (for JavaScript tracking code on user websites)
router.post("/track", websiteAnalyticsController.trackEvent);

export default router;
