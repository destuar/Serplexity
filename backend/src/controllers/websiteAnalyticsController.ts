/**
 * @file websiteAnalyticsController.ts
 * @description Controller for website analytics integration endpoints
 *
 * Handles requests for Serplexity users to integrate their websites with analytics platforms
 * (Google Search Console or manual tracking) and view website performance metrics.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { websiteAnalyticsService } from '../services/websiteAnalyticsService';
import { googleSearchConsoleService } from '../services/googleSearchConsoleService';

// Validation schemas
const CreateIntegrationSchema = z.object({
  integrationName: z.enum(['google_search_console', 'manual_tracking']),
  verificationMethod: z.enum(['meta_tag', 'dns_record', 'file_upload', 'oauth']).optional(),
  gscPropertyUrl: z.string().url().optional()
});

const GetMetricsSchema = z.object({
  startDate: z.string().refine(date => !isNaN(Date.parse(date)), 'Invalid start date'),
  endDate: z.string().refine(date => !isNaN(Date.parse(date)), 'Invalid end date'),
  integrationId: z.string().optional()
});

const OAuthCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional()
});

/**
 * Create a new website analytics integration
 */
export const createIntegration = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Company not found' });
      return;
    }

    const validatedData = CreateIntegrationSchema.parse(req.body);

    const result = await websiteAnalyticsService.createIntegration({
      companyId,
      ...validatedData
    });

    if (validatedData.integrationName === 'google_search_console') {
      // Return OAuth URL for Google Search Console
      const authUrl = googleSearchConsoleService.getAuthUrl(result.integration.id);
      res.json({
        ...result,
        authUrl
      });
    } else {
      // Return verification details for manual tracking
      res.json(result);
    }
  } catch (error) {
    logger.error('Error creating website analytics integration:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors
      });
      return;
    }

    res.status(500).json({ 
      error: 'Failed to create integration',
      message: (error as Error).message
    });
  }
};

/**
 * Handle Google OAuth callback
 */
export const handleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = OAuthCallbackSchema.parse(req.query);
    const integrationId = validatedData.state;

    if (!integrationId) {
      res.status(400).json({ error: 'Missing integration ID in callback' });
      return;
    }

    await websiteAnalyticsService.completeOAuthIntegration(integrationId, validatedData.code);

    // Redirect to frontend success page
    const redirectUrl = `${process.env.FRONTEND_URL}/analytics/integration/success?id=${integrationId}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Error handling OAuth callback:', error);
    
    // Redirect to frontend error page
    const errorUrl = `${process.env.FRONTEND_URL}/analytics/integration/error?message=${encodeURIComponent((error as Error).message)}`;
    res.redirect(errorUrl);
  }
};

/**
 * Verify manual integration
 */
export const verifyIntegration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: 'Integration ID is required' });
      return;
    }

    const result = await websiteAnalyticsService.verifyManualIntegration(integrationId);
    res.json(result);
  } catch (error) {
    logger.error('Error verifying integration:', error);
    res.status(500).json({ 
      error: 'Failed to verify integration',
      message: (error as Error).message
    });
  }
};

/**
 * Get company integrations
 */
export const getIntegrations = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Company not found' });
      return;
    }

    const integrations = await websiteAnalyticsService.getCompanyIntegrations(companyId);
    res.json({ integrations });
  } catch (error) {
    logger.error('Error getting integrations:', error);
    res.status(500).json({ 
      error: 'Failed to get integrations',
      message: (error as Error).message
    });
  }
};

/**
 * Get website analytics metrics
 */
export const getMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Company not found' });
      return;
    }

    const validatedData = GetMetricsSchema.parse(req.query);

    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    const metrics = await websiteAnalyticsService.getWebsiteAnalyticsMetrics(
      companyId,
      startDate,
      endDate,
      validatedData.integrationId
    );

    res.json({ metrics });
  } catch (error) {
    logger.error('Error getting website analytics metrics:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors
      });
      return;
    }

    res.status(500).json({ 
      error: 'Failed to get metrics',
      message: (error as Error).message
    });
  }
};

/**
 * Delete an integration
 */
export const deleteIntegration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: 'Integration ID is required' });
      return;
    }

    await websiteAnalyticsService.deleteIntegration(integrationId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting integration:', error);
    res.status(500).json({ 
      error: 'Failed to delete integration',
      message: (error as Error).message
    });
  }
};

/**
 * Get Google Search Console properties for authenticated user
 */
export const getGSCProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: 'Integration ID is required' });
      return;
    }

    // This would be called after OAuth to get available properties
    // For now, we'll return a placeholder - this would need the user's access token
    res.json({ 
      properties: [],
      message: 'Properties will be available after OAuth completion'
    });
  } catch (error) {
    logger.error('Error getting GSC properties:', error);
    res.status(500).json({ 
      error: 'Failed to get properties',
      message: (error as Error).message
    });
  }
};

/**
 * Trigger manual data sync for Google Search Console integration
 */
export const syncIntegrationData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: 'Integration ID is required' });
      return;
    }

    await googleSearchConsoleService.syncIntegrationData(integrationId);
    res.json({ success: true, message: 'Data sync initiated' });
  } catch (error) {
    logger.error('Error syncing integration data:', error);
    res.status(500).json({ 
      error: 'Failed to sync data',
      message: (error as Error).message
    });
  }
};

/**
 * Handle manual tracking events (for websites with Serplexity tracking code)
 */
export const trackEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { trackingId, event, data } = req.body;

    if (!trackingId || !event) {
      res.status(400).json({ error: 'Tracking ID and event are required' });
      return;
    }

    // TODO: Implement manual tracking event processing
    // This would process events from the JavaScript tracking code
    // and store them in the AnalyticsData table

    logger.info(`Received tracking event: ${event} for tracking ID: ${trackingId}`);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error tracking event:', error);
    res.status(500).json({ 
      error: 'Failed to track event',
      message: (error as Error).message
    });
  }
};

/**
 * Get integration health status
 */
export const getIntegrationHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: 'Integration ID is required' });
      return;
    }

    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: 'Company not found' });
      return;
    }

    const integrations = await websiteAnalyticsService.getCompanyIntegrations(companyId);
    const integration = integrations.find(i => i.id === integrationId);

    if (!integration) {
      res.status(404).json({ error: 'Integration not found' });
      return;
    }

    res.json({
      healthStatus: integration.healthStatus,
      healthMessage: integration.healthMessage,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt
    });
  } catch (error) {
    logger.error('Error getting integration health:', error);
    res.status(500).json({ 
      error: 'Failed to get integration health',
      message: (error as Error).message
    });
  }
};