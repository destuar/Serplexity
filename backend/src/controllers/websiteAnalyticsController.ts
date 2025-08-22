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
        tokens.expiry_date
      );
      await prisma.analyticsIntegration.update({
        where: { id: integrationId },
        data: {
          status: "active",
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

    // Redirect to frontend success page
    const env = (await import("../config/env")).default;
    const redirectUrl = `${env.FRONTEND_URL}/analytics/integration/success?id=${integrationId}`;
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

    const stored = await googleOAuthTokenService.getDecryptedToken(companyId);
    if (!stored?.accessToken) {
      res.status(400).json({ error: "No Google OAuth token. Reconnect GA4." });
      return;
    }
    const metrics = await googleAnalyticsService.getSummaryMetrics(
      stored.accessToken,
      propertyId,
      startDateParam,
      endDateParam
    );

    res.json({ metrics });
  } catch (error) {
    logger.error("Error getting GA4 metrics:", error);
    res.status(500).json({
      error: "Failed to get GA4 metrics",
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

    if (!integrationId) {
      res.status(400).json({ error: "Integration ID is required" });
      return;
    }

    // This would be called after OAuth to get available properties
    // For now, we'll return a placeholder - this would need the user's access token
    res.json({
      properties: [],
      message: "Properties will be available after OAuth completion",
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
