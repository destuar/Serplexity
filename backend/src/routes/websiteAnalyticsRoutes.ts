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

import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as websiteAnalyticsController from '../controllers/websiteAnalyticsController';

const router = Router();

// All routes require authentication - these are for Serplexity users managing their website analytics
router.use(authenticate);

// Integration management routes
router.post('/integrations', websiteAnalyticsController.createIntegration);
router.get('/integrations', websiteAnalyticsController.getIntegrations);
router.delete('/integrations/:integrationId', websiteAnalyticsController.deleteIntegration);

// Verification routes
router.post('/integrations/:integrationId/verify', websiteAnalyticsController.verifyIntegration);
router.get('/integrations/:integrationId/health', websiteAnalyticsController.getIntegrationHealth);

// Google Search Console specific routes
router.get('/oauth/callback', websiteAnalyticsController.handleOAuthCallback);
router.get('/integrations/:integrationId/properties', websiteAnalyticsController.getGSCProperties);
router.post('/integrations/:integrationId/sync', websiteAnalyticsController.syncIntegrationData);

// Analytics data routes
router.get('/metrics', websiteAnalyticsController.getMetrics);

// Manual tracking route (for JavaScript tracking code on user websites)
router.post('/track', websiteAnalyticsController.trackEvent);

export default router;