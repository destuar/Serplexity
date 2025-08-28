/**
 * @file websiteAnalyticsController.ts
 * @description Controller for website analytics integration endpoints
 *
 * Handles requests for Serplexity users to integrate their websites with analytics platforms
 * (Google Search Console or manual tracking) and view website performance metrics.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { googleAnalyticsService } from "../services/googleAnalyticsService";
import { googleOAuthTokenService } from "../services/googleOAuthTokenService";
import { googleSearchConsoleService } from "../services/googleSearchConsoleService";
import { gscAnalyticsService } from "../services/gscAnalyticsService";
import { syncSchedulerService } from "../services/syncSchedulerService";
import { websiteAnalyticsService } from "../services/websiteAnalyticsService";
import logger from "../utils/logger";

// Validation schemas
const CreateIntegrationSchema = z.object({
  integrationName: z.enum(["google_search_console", "manual_tracking", "google_analytics_4"]),
  verificationMethod: z
    .enum(["meta_tag", "dns_record", "file_upload", "oauth"])
    .optional(),
  gscPropertyUrl: z.string().url().optional(),
  ga4PropertyIdOrTag: z.string().optional(),
});

const GetMetricsSchema = z.object({
  startDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Invalid start date"),
  endDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Invalid end date"),
  integrationId: z.string().optional(),
});

const OAuthCallbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

/**
 * Create a new website analytics integration
 */
export const createIntegration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get companyId from URL params (new pattern) or fall back to user context (legacy)
    const companyId = req.params.companyId || req.user?.companyId;
    if (!companyId) {
      logger.error("[Create Integration] No company ID found", {
        paramsCompanyId: req.params.companyId,
        userCompanyId: req.user?.companyId,
        userCompaniesCount: req.user?.companies?.length || 0,
        firstCompanyId: req.user?.companies?.[0]?.id
      });
      res.status(400).json({ 
        error: "Company ID is required",
        message: "Please create a company first or ensure you're associated with a company"
      });
      return;
    }

    // Verify user has access to this company
    if (req.params.companyId) {
      const userCompanyIds = req.user?.companies?.map(c => c.id) || [];
      if (!userCompanyIds.includes(companyId)) {
        res.status(403).json({ error: "Access denied to this company" });
        return;
      }
    }

    const validatedData = CreateIntegrationSchema.parse(req.body);

    const result = await websiteAnalyticsService.createIntegration({
      companyId,
      ...validatedData,
    });

    if (validatedData.integrationName === "google_search_console") {
      // Return OAuth URL for Google Search Console
      const authUrl = googleSearchConsoleService.getAuthUrl(
        result.integration.id
      );
      res.json({
        ...result,
        authUrl,
      });
    } else if (validatedData.integrationName === "google_analytics_4" && validatedData.verificationMethod === "oauth") {
      // Return OAuth URL for GA4
      const authUrl = googleAnalyticsService.getAuthUrl(result.integration.id);
      res.json({
        ...result,
        authUrl,
      });
    } else {
      // Return verification details for manual tracking or GA4 manual setup
      res.json(result);
    }
  } catch (error) {
    logger.error("Error creating website analytics integration:", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      error: "Failed to create integration",
      message: (error as Error).message,
    });
  }
};

/**
 * Handle Google OAuth callback
 */
export const handleOAuthCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const validatedData = OAuthCallbackSchema.parse(req.query);
    const integrationId = validatedData.state;

    if (!integrationId) {
      res.status(400).json({ error: "Missing integration ID in callback" });
      return;
    }

    // Determine integration type based on stored integration
    const prisma = await (
      await import("../config/dbCache")
    ).dbCache.getPrimaryClient();
    const integration = await prisma.analyticsIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    if (integration.integrationName === "google_search_console") {
      await websiteAnalyticsService.completeOAuthIntegration(
        integrationId,
        validatedData.code
      );
    } else if (integration.integrationName === "google_analytics_4") {
      // Exchange code for GA4 tokens and persist using centralized token store
      const tokens = await googleAnalyticsService.getTokensFromCode(
        validatedData.code
      );
      if (!integration.companyId) {
        res.status(400).json({ error: "Integration missing companyId" });
        return;
      }
      const scopes = (tokens.scope || "").split(/[\s,]+/).filter(Boolean);
      await googleOAuthTokenService.upsertToken(
        integration.companyId,
        scopes,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date,
        "ga4" // Use GA4-specific provider to avoid collision with GSC tokens
      );
      await prisma.analyticsIntegration.update({
        where: { id: integrationId },
        data: {
          status: "pending_property_selection",
          verificationMethod: "oauth",
        },
      });

      // Schedule initial GA4 backfill if property was hinted
      if (integration.trackingCode) {
        try {
          await syncSchedulerService.enqueueGa4Backfill(
            integration.companyId,
            integration.trackingCode,
            90
          );
        } catch (e) {
          logger.warn("Failed to schedule GA4 backfill", { error: e });
        }
      }
    }

    // Redirect based on integration type
    const env = (await import("../config/env")).default;
    let redirectUrl: string;
    
    if (integration.integrationName === "google_analytics_4") {
      redirectUrl = `${env.FRONTEND_URL}/analytics/ga4-setup?integrationId=${integrationId}`;
    } else if (integration.integrationName === "google_search_console") {
      redirectUrl = `${env.FRONTEND_URL}/seo-rankings`;
    } else {
      redirectUrl = `${env.FRONTEND_URL}/web-analytics`;
    }
    
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error("Error handling OAuth callback:", error);

    // Redirect to frontend error page
    const env = (await import("../config/env")).default;
    const errorUrl = `${env.FRONTEND_URL}/analytics/integration/error?message=${encodeURIComponent((error as Error).message)}`;
    res.redirect(errorUrl);
  }
};

/**
 * Verify manual integration
 */
export const verifyIntegration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: "Integration ID is required" });
      return;
    }

    const result =
      await websiteAnalyticsService.verifyManualIntegration(integrationId);
    res.json(result);
  } catch (error) {
    logger.error("Error verifying integration:", error);
    res.status(500).json({
      error: "Failed to verify integration",
      message: (error as Error).message,
    });
  }
};

/**
 * Get company integrations
 */
export const getIntegrations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get companyId from URL params (new pattern) or fall back to user context (legacy)
    const companyId = req.params.companyId || req.user?.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    // Verify user has access to this company
    if (req.params.companyId) {
      const userCompanyIds = req.user?.companies?.map(c => c.id) || [];
      if (!userCompanyIds.includes(companyId)) {
        res.status(403).json({ error: "Access denied to this company" });
        return;
      }
    }

    const integrations =
      await websiteAnalyticsService.getCompanyIntegrations(companyId);
    res.json({ integrations });
  } catch (error) {
    logger.error("Error getting integrations:", error);
    res.status(500).json({
      error: "Failed to get integrations",
      message: (error as Error).message,
    });
  }
};

/**
 * Get website analytics metrics
 */
export const getMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get companyId from URL params (new pattern) or fall back to user context (legacy)
    const companyId = req.params.companyId || req.user?.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    // Verify user has access to this company
    if (req.params.companyId) {
      const userCompanyIds = req.user?.companies?.map(c => c.id) || [];
      if (!userCompanyIds.includes(companyId)) {
        res.status(403).json({ error: "Access denied to this company" });
        return;
      }
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
    logger.error("Error getting website analytics metrics:", error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      error: "Failed to get metrics",
      message: (error as Error).message,
    });
  }
};

/**
 * Get GA4 (visitor) analytics metrics
 * Requires: either a GA4 OAuth integration for the company or a provided propertyId
 */
export const getGa4Metrics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get companyId from URL params (new pattern) or fall back to user context (legacy)
    const companyId = req.params.companyId || req.user?.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    // Verify user has access to this company
    if (req.params.companyId) {
      const userCompanyIds = req.user?.companies?.map(c => c.id) || [];
      if (!userCompanyIds.includes(companyId)) {
        res.status(403).json({ error: "Access denied to this company" });
        return;
      }
    }

    const startDateParam = req.query["startDate"] as string;
    const endDateParam = req.query["endDate"] as string;
    const propertyIdParam = req.query["propertyId"] as string | undefined;

    if (!startDateParam || !endDateParam) {
      res
        .status(400)
        .json({ error: "startDate and endDate are required (YYYY-MM-DD)" });
      return;
    }

    const prisma = await (
      await import("../config/dbCache")
    ).dbCache.getPrimaryClient();
    const ga4Integration = await prisma.analyticsIntegration.findFirst({
      where: {
        companyId,
        integrationName: "google_analytics_4",
        status: "active",
      },
    });

    if (!ga4Integration && !propertyIdParam) {
      res.status(404).json({
        error:
          "No active GA4 integration found. Connect GA4 or provide propertyId.",
      });
      return;
    }

    const propertyId = propertyIdParam || ga4Integration?.trackingCode; // if stored
    if (!propertyId) {
      res.status(400).json({
        error:
          "GA4 propertyId is required. Store it during integration or pass ?propertyId=",
      });
      return;
    }

    const stored = await googleOAuthTokenService.getDecryptedToken(companyId, "ga4");
    if (!stored?.accessToken) {
      res.status(400).json({ error: "No Google OAuth token. Reconnect GA4." });
      return;
    }

    let accessToken = stored.accessToken;
    
    // Try to refresh token if it's expired or close to expiring
    if (stored.expiry && stored.expiry <= new Date(Date.now() + 5 * 60 * 1000)) { // 5 minutes buffer
      try {
        if (!stored.refreshToken) {
          res.status(400).json({ error: "Access token expired and no refresh token available. Please reconnect GA4." });
          return;
        }
        
        const refreshedTokens = await googleAnalyticsService.refreshAccessToken(stored.refreshToken);
        
        // Update stored tokens
        await googleOAuthTokenService.upsertToken(
          companyId,
          stored.scopes,
          refreshedTokens.access_token,
          refreshedTokens.refresh_token,
          refreshedTokens.expiry_date
        );
        
        accessToken = refreshedTokens.access_token;
        logger.info(`[GA4] Refreshed access token for company ${companyId}`);
      } catch (refreshError) {
        logger.error(`[GA4] Failed to refresh token for company ${companyId}:`, refreshError);
        res.status(400).json({ error: "Failed to refresh access token. Please reconnect GA4." });
        return;
      }
    }

    try {
      const metrics = await googleAnalyticsService.getSummaryMetrics(
        accessToken,
        propertyId,
        startDateParam,
        endDateParam
      );
      res.json({ metrics });
    } catch (apiError: any) {
      // If we get a 401 unauthorized error, try to refresh the token once
      if (apiError.code === 401 || apiError.message?.includes('unauthorized') || apiError.message?.includes('invalid_grant')) {
        try {
          if (!stored.refreshToken) {
            res.status(400).json({ error: "Access token unauthorized and no refresh token available. Please reconnect GA4." });
            return;
          }
          
          logger.info(`[GA4] API call failed with 401, attempting token refresh for company ${companyId}`);
          const refreshedTokens = await googleAnalyticsService.refreshAccessToken(stored.refreshToken);
          
          // Update stored tokens
          await googleOAuthTokenService.upsertToken(
            companyId,
            stored.scopes,
            refreshedTokens.access_token,
            refreshedTokens.refresh_token,
            refreshedTokens.expiry_date
          );
          
          // Retry the API call with new token
          const metrics = await googleAnalyticsService.getSummaryMetrics(
            refreshedTokens.access_token,
            propertyId,
            startDateParam,
            endDateParam
          );
          res.json({ metrics });
          logger.info(`[GA4] Successfully refreshed token and retried API call for company ${companyId}`);
        } catch (retryError) {
          logger.error(`[GA4] Failed to refresh token after API 401 for company ${companyId}:`, retryError);
          res.status(400).json({ error: "Token refresh failed after API unauthorized error. Please reconnect GA4." });
        }
      } else {
        // Re-throw non-auth errors
        throw apiError;
      }
    }
  } catch (error) {
    logger.error("Error getting GA4 metrics:", error);
    res.status(500).json({
      error: "Failed to get GA4 metrics",
      message: (error as Error).message,
    });
  }
};

/**
 * Get real-time active users from GA4
 */
export const getGa4ActiveUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get companyId from URL params (new pattern) or fall back to user context (legacy)
    const companyId = req.params.companyId || req.user?.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    // Verify user has access to this company
    if (req.params.companyId) {
      const userCompanyIds = req.user?.companies?.map(c => c.id) || [];
      if (!userCompanyIds.includes(companyId)) {
        res.status(403).json({ error: "Access denied to this company" });
        return;
      }
    }

    const propertyIdParam = req.query["propertyId"] as string | undefined;

    const prisma = await (
      await import("../config/dbCache")
    ).dbCache.getPrimaryClient();
    const ga4Integration = await prisma.analyticsIntegration.findFirst({
      where: {
        companyId,
        integrationName: "google_analytics_4",
        status: "active",
      },
    });

    if (!ga4Integration && !propertyIdParam) {
      res.status(404).json({
        error: "No active GA4 integration found. Connect GA4 or provide propertyId.",
      });
      return;
    }

    const propertyId = propertyIdParam || ga4Integration?.trackingCode;
    if (!propertyId) {
      res.status(400).json({
        error: "GA4 propertyId is required. Store it during integration or pass ?propertyId=",
      });
      return;
    }

    const stored = await googleOAuthTokenService.getDecryptedToken(companyId, "ga4");
    if (!stored?.accessToken) {
      res.status(400).json({ error: "No Google OAuth token. Reconnect GA4." });
      return;
    }

    let accessToken = stored.accessToken;
    
    // Try to refresh token if it's expired or close to expiring
    if (stored.expiry && stored.expiry <= new Date(Date.now() + 5 * 60 * 1000)) {
      try {
        if (!stored.refreshToken) {
          res.status(400).json({ error: "Access token expired and no refresh token available. Please reconnect GA4." });
          return;
        }
        
        const refreshedTokens = await googleAnalyticsService.refreshAccessToken(stored.refreshToken);
        
        // Update stored tokens
        await googleOAuthTokenService.upsertToken(
          companyId,
          stored.scopes,
          refreshedTokens.access_token,
          refreshedTokens.refresh_token,
          refreshedTokens.expiry_date
        );
        
        accessToken = refreshedTokens.access_token;
        logger.info(`[GA4] Refreshed access token for company ${companyId}`);
      } catch (refreshError) {
        logger.error(`[GA4] Failed to refresh token for company ${companyId}:`, refreshError);
        res.status(400).json({ error: "Failed to refresh access token. Please reconnect GA4." });
        return;
      }
    }

    try {
      const activeUsers = await googleAnalyticsService.getCurrentActiveUsers(
        accessToken,
        propertyId
      );
      res.json({ activeUsers });
    } catch (apiError: any) {
      // If we get a 401 unauthorized error, try to refresh the token once
      if (apiError.code === 401 || apiError.message?.includes('unauthorized') || apiError.message?.includes('invalid_grant')) {
        try {
          if (!stored.refreshToken) {
            res.status(400).json({ error: "Access token unauthorized and no refresh token available. Please reconnect GA4." });
            return;
          }
          
          logger.info(`[GA4] Real-time API call failed with 401, attempting token refresh for company ${companyId}`);
          const refreshedTokens = await googleAnalyticsService.refreshAccessToken(stored.refreshToken);
          
          // Update stored tokens
          await googleOAuthTokenService.upsertToken(
            companyId,
            stored.scopes,
            refreshedTokens.access_token,
            refreshedTokens.refresh_token,
            refreshedTokens.expiry_date
          );
          
          // Retry the API call with new token
          const activeUsers = await googleAnalyticsService.getCurrentActiveUsers(
            refreshedTokens.access_token,
            propertyId
          );
          res.json({ activeUsers });
          logger.info(`[GA4] Successfully refreshed token and retried real-time API call for company ${companyId}`);
        } catch (retryError) {
          logger.error(`[GA4] Failed to refresh token after real-time API 401 for company ${companyId}:`, retryError);
          res.status(400).json({ error: "Token refresh failed after API unauthorized error. Please reconnect GA4." });
        }
      } else {
        // Re-throw non-auth errors
        throw apiError;
      }
    }
  } catch (error) {
    logger.error("Error getting GA4 active users:", error);
    res.status(500).json({
      error: "Failed to get GA4 active users",
      message: (error as Error).message,
    });
  }
};

/**
 * Delete an integration
 */
export const deleteIntegration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: "Integration ID is required" });
      return;
    }

    await websiteAnalyticsService.deleteIntegration(integrationId);
    res.json({ success: true });
  } catch (error) {
    logger.error("Error deleting integration:", error);
    res.status(500).json({
      error: "Failed to delete integration",
      message: (error as Error).message,
    });
  }
};

/**
 * Get Google Search Console properties for authenticated user
 */
export const getGSCProperties = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { integrationId } = req.params;
    const companyId = req.user?.companyId;

    if (!integrationId) {
      res.status(400).json({ error: "Integration ID is required" });
      return;
    }

    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    // Get the integration to verify it exists and belongs to the company
    const prisma = await (await import("../config/dbCache")).dbCache.getPrimaryClient();
    const integration = await prisma.analyticsIntegration.findFirst({
      where: { id: integrationId, companyId }
    });

    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    // Get GSC token for this company
    const stored = await googleOAuthTokenService.getDecryptedToken(companyId, "gsc");
    if (!stored?.accessToken) {
      res.status(400).json({ error: "No Google Search Console OAuth token. Complete OAuth first." });
      return;
    }

    // Fetch available properties from GSC
    const properties = await googleSearchConsoleService.getProperties(stored.accessToken);
    
    res.json({
      properties: properties.map(prop => ({
        siteUrl: prop.siteUrl,
        permissionLevel: prop.permissionLevel
      }))
    });
  } catch (error) {
    logger.error("Error getting GSC properties:", error);
    res.status(500).json({
      error: "Failed to get properties",
      message: (error as Error).message,
    });
  }
};

/**
 * Trigger manual data sync for Google Search Console integration
 */
export const syncIntegrationData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: "Integration ID is required" });
      return;
    }

    await googleSearchConsoleService.syncIntegrationData(integrationId);
    res.json({ success: true, message: "Data sync initiated" });
  } catch (error) {
    logger.error("Error syncing integration data:", error);
    res.status(500).json({
      error: "Failed to sync data",
      message: (error as Error).message,
    });
  }
};

/**
 * Handle manual tracking events (for websites with Serplexity tracking code)
 */
export const trackEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { trackingId, event, data: _data } = req.body;

    if (!trackingId || !event) {
      res.status(400).json({ error: "Tracking ID and event are required" });
      return;
    }

    // TODO: Implement manual tracking event processing
    // This would process events from the JavaScript tracking code
    // and store them in the AnalyticsData table

    logger.info(
      `Received tracking event: ${event} for tracking ID: ${trackingId}`
    );

    res.json({ success: true });
  } catch (error) {
    logger.error("Error tracking event:", error);
    res.status(500).json({
      error: "Failed to track event",
      message: (error as Error).message,
    });
  }
};

/**
 * Get integration health status
 */
export const getIntegrationHealth = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { integrationId } = req.params;

    if (!integrationId) {
      res.status(400).json({ error: "Integration ID is required" });
      return;
    }

    // Get companyId from URL params (new pattern) or fall back to user context (legacy)
    const companyId = req.params.companyId || req.user?.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    // Verify user has access to this company
    if (req.params.companyId) {
      const userCompanyIds = req.user?.companies?.map(c => c.id) || [];
      if (!userCompanyIds.includes(companyId)) {
        res.status(403).json({ error: "Access denied to this company" });
        return;
      }
    }

    const integrations =
      await websiteAnalyticsService.getCompanyIntegrations(companyId);
    const integration = integrations.find((i) => i.id === integrationId);

    if (!integration) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    res.json({
      healthStatus: integration.healthStatus,
      healthMessage: integration.healthMessage,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
    });
  } catch (error) {
    logger.error("Error getting integration health:", error);
    res.status(500).json({
      error: "Failed to get integration health",
      message: (error as Error).message,
    });
  }
};

/**
 * Get available GA4 properties for authenticated user
 */
export const getGA4Properties = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    const stored = await googleOAuthTokenService.getDecryptedToken(companyId, "ga4");
    if (!stored?.accessToken) {
      res.status(400).json({ error: "No Google OAuth token. Complete GA4 OAuth first." });
      return;
    }

    const properties = await googleAnalyticsService.discoverGA4Properties(stored.accessToken);
    res.json({ properties });
  } catch (error) {
    logger.error("Error getting GA4 properties:", error);
    res.status(500).json({
      error: "Failed to get GA4 properties",
      message: (error as Error).message,
    });
  }
};

/**
 * Get GSC (Search Console) analytics metrics
 * Requires: active GSC OAuth integration for the company
 */
export const getGscMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Get companyId from URL params (new pattern) or fall back to user context (legacy)
    const companyId = req.params.companyId || req.user?.companyId;
    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    // Verify user has access to this company
    if (req.params.companyId) {
      const userCompanyIds = req.user?.companies?.map(c => c.id) || [];
      if (!userCompanyIds.includes(companyId)) {
        res.status(403).json({ error: "Access denied to this company" });
        return;
      }
    }

    const startDateParam = req.query["startDate"] as string;
    const endDateParam = req.query["endDate"] as string;

    if (!startDateParam || !endDateParam) {
      res
        .status(400)
        .json({ error: "startDate and endDate are required (YYYY-MM-DD)" });
      return;
    }

    // Validate GSC integration exists and is active  
    const validation = await gscAnalyticsService.validateGscIntegration(companyId);
    if (!validation.isValid) {
      res.status(404).json({
        error: validation.error || "No active GSC integration found",
      });
      return;
    }

    // Get GSC integration details
    const integration = validation.integration;
    if (!integration.gscPropertyUrl) {
      res.status(400).json({
        error: "GSC property URL not configured for this integration",
      });
      return;
    }

    // Get GSC token for real-time API calls (like GA4)
    const stored = await googleOAuthTokenService.getDecryptedToken(companyId, "gsc");
    if (!stored?.accessToken) {
      res.status(400).json({ error: "No Google Search Console OAuth token. Reconnect GSC." });
      return;
    }

    let accessToken = stored.accessToken;
    
    // Try to refresh token if it's expired or close to expiring
    if (stored.expiry && stored.expiry <= new Date(Date.now() + 5 * 60 * 1000)) { // 5 minutes buffer
      try {
        if (!stored.refreshToken) {
          res.status(400).json({ error: "Access token expired and no refresh token available. Please reconnect GSC." });
          return;
        }
        
        const refreshedTokens = await googleSearchConsoleService.refreshAccessToken(stored.refreshToken);
        
        // Update stored tokens
        await googleOAuthTokenService.upsertToken(
          companyId,
          stored.scopes,
          refreshedTokens.access_token,
          refreshedTokens.refresh_token,
          refreshedTokens.expiry_date,
          "gsc"
        );
        
        accessToken = refreshedTokens.access_token;
        logger.info(`[GSC] Refreshed access token for company ${companyId}`);
      } catch (refreshError) {
        logger.error(`[GSC] Failed to refresh token for company ${companyId}:`, refreshError);
        res.status(400).json({ error: "Failed to refresh access token. Please reconnect GSC." });
        return;
      }
    }

    try {
      // Fetch GSC metrics from real-time API (like GA4)
      const metrics = await googleSearchConsoleService.getSummaryMetrics(
        accessToken,
        integration.gscPropertyUrl,
        startDateParam,
        endDateParam
      );
      res.json({ metrics });
    } catch (apiError: any) {
      // If we get a 401 unauthorized error, try to refresh the token once
      if (apiError.code === 401 || apiError.message?.includes('unauthorized') || apiError.message?.includes('invalid_grant')) {
        try {
          if (!stored.refreshToken) {
            res.status(400).json({ error: "Access token unauthorized and no refresh token available. Please reconnect GSC." });
            return;
          }
          
          logger.info(`[GSC] API call failed with 401, attempting token refresh for company ${companyId}`);
          const refreshedTokens = await googleSearchConsoleService.refreshAccessToken(stored.refreshToken);
          
          // Update stored tokens
          await googleOAuthTokenService.upsertToken(
            companyId,
            stored.scopes,
            refreshedTokens.access_token,
            refreshedTokens.refresh_token,
            refreshedTokens.expiry_date,
            "gsc"
          );
          
          // Retry the API call with new token
          const metrics = await googleSearchConsoleService.getSummaryMetrics(
            refreshedTokens.access_token,
            integration.gscPropertyUrl,
            startDateParam,
            endDateParam
          );
          res.json({ metrics });
          logger.info(`[GSC] Successfully refreshed token and retried API call for company ${companyId}`);
        } catch (retryError) {
          logger.error(`[GSC] Failed to refresh token after API 401 for company ${companyId}:`, retryError);
          res.status(400).json({ error: "Token refresh failed after API unauthorized error. Please reconnect GSC." });
        }
      } else {
        // Re-throw non-auth errors
        throw apiError;
      }
    }
  } catch (error) {
    logger.error("Error getting GSC metrics:", error);
    res.status(500).json({
      error: "Failed to get GSC metrics",
      message: (error as Error).message,
    });
  }
};

/**
 * Set selected GA4 property for an integration
 */
export const setGSCProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { integrationId } = req.params;
    const { siteUrl } = req.body;
    const companyId = req.user?.companyId;

    if (!integrationId || !siteUrl) {
      res.status(400).json({ error: "Integration ID and site URL are required" });
      return;
    }

    if (!companyId) {
      res.status(400).json({ error: "Company ID is required" });
      return;
    }

    // Get the integration to verify it exists and belongs to the company
    const prisma = await (await import("../config/dbCache")).dbCache.getPrimaryClient();
    const integration = await prisma.analyticsIntegration.findFirst({
      where: { id: integrationId, companyId, integrationName: "google_search_console" }
    });

    if (!integration) {
      res.status(404).json({ error: "GSC integration not found" });
      return;
    }

    // Get GSC token and validate property access
    const stored = await googleOAuthTokenService.getDecryptedToken(companyId, "gsc");
    if (!stored?.accessToken) {
      res.status(400).json({ error: "No Google Search Console OAuth token. Complete OAuth first." });
      return;
    }

    // Validate that user has access to this property
    const hasAccess = await googleSearchConsoleService.validatePropertyAccess(
      stored.accessToken,
      siteUrl
    );

    if (!hasAccess) {
      res.status(403).json({ error: "No access to the specified Search Console property" });
      return;
    }

    // Update integration with selected property
    await prisma.analyticsIntegration.update({
      where: { id: integrationId },
      data: {
        gscPropertyUrl: siteUrl,
        status: "active",
        verificationMethod: "oauth"
      }
    });

    // Trigger initial data sync
    try {
      await googleSearchConsoleService.syncIntegrationData(integrationId);
    } catch (syncError) {
      logger.warn("Initial GSC data sync failed, will retry later:", syncError);
    }

    res.json({ 
      success: true,
      message: "GSC property selected successfully",
      siteUrl 
    });
  } catch (error) {
    logger.error("Error setting GSC property:", error);
    res.status(500).json({ 
      error: "Failed to set GSC property",
      message: (error as Error).message 
    });
  }
};

export const setGA4Property = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { integrationId } = req.params;
    const { propertyId } = req.body;

    if (!integrationId) {
      res.status(400).json({ error: "Integration ID is required" });
      return;
    }

    if (!propertyId) {
      res.status(400).json({ error: "Property ID is required" });
      return;
    }

    const prisma = await (
      await import("../config/dbCache")
    ).dbCache.getPrimaryClient();

    // Update the integration with the selected property ID
    const integration = await prisma.analyticsIntegration.update({
      where: { id: integrationId },
      data: {
        trackingCode: propertyId,
        status: "active",
      },
    });

    logger.info(`[GA4] Set property ${propertyId} for integration ${integrationId}`);
    res.json({ success: true, integration });
  } catch (error) {
    logger.error("Error setting GA4 property:", error);
    res.status(500).json({
      error: "Failed to set GA4 property",
      message: (error as Error).message,
    });
  }
};
