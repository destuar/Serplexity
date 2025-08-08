/**
 * @file websiteAnalyticsService.ts
 * @description Website analytics integration service for Serplexity users to track their own website analytics
 *
 * This service provides analytics integration capabilities for Serplexity users, allowing them to:
 * - Connect their websites to Google Search Console
 * - Set up manual tracking via JavaScript snippets
 * - View website performance metrics (CTR, impressions, clicks, etc.)
 * - Analyze their website's search performance
 *
 * This is NOT for tracking Serplexity platform usage - it's for users to analyze their own websites.
 */

import { randomBytes } from "crypto";
import { dbCache } from "../config/dbCache";
import logger from "../utils/logger";
import { analyticsVerificationService } from "./analyticsVerificationService";
import { googleSearchConsoleService } from "./googleSearchConsoleService";

export interface CreateIntegrationRequest {
  companyId: string;
  integrationName:
    | "google_search_console"
    | "manual_tracking"
    | "google_analytics_4";
  verificationMethod?: "meta_tag" | "dns_record" | "file_upload" | "oauth";
  gscPropertyUrl?: string; // for Search Console
  ga4PropertyIdOrTag?: string; // for GA4 manual or property selection
}

export interface WebsiteAnalyticsMetrics {
  totalImpressions: number;
  totalClicks: number;
  averageCtr: number;
  averagePosition: number;
  totalQueries: number;
  topQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  countryBreakdown: Array<{
    country: string;
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
  performanceOverTime: Array<{
    date: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
}

export interface IntegrationStatus {
  id: string;
  integrationName: string;
  status: string;
  verificationMethod?: string;
  verificationToken?: string;
  gscPropertyUrl?: string;
  lastSyncAt?: Date;
  createdAt: Date;
  isConfigured: boolean;
  healthStatus: "healthy" | "warning" | "error";
  healthMessage?: string;
}

class WebsiteAnalyticsService {
  /**
   * Create a new website analytics integration for a Serplexity user's company
   */
  async createIntegration(request: CreateIntegrationRequest): Promise<{
    integration: any;
    verificationDetails?: any;
  }> {
    try {
      const prisma = await dbCache.getPrimaryClient();

      // Check if integration already exists
      const existingIntegration = await prisma.analyticsIntegration.findFirst({
        where: {
          companyId: request.companyId,
          integrationName: request.integrationName,
        },
      });

      if (existingIntegration && existingIntegration.status === "active") {
        throw new Error("Integration already exists and is active");
      }

      let verificationDetails = null;
      const integrationData: any = {
        companyId: request.companyId,
        integrationName: request.integrationName,
        status: "pending",
        verificationMethod: request.verificationMethod,
      };

      if (request.integrationName === "google_search_console") {
        // Google Search Console integrations must use OAuth
        if (request.verificationMethod !== "oauth") {
          throw new Error("Google Search Console requires OAuth verification");
        }

        // Prefer provided property URL; otherwise default to the company's website
        let propertyUrl = request.gscPropertyUrl;

        if (!propertyUrl) {
          const companyForUrl = await prisma.company.findUnique({
            where: { id: request.companyId },
            select: { website: true },
          });

          if (!companyForUrl || !companyForUrl.website) {
            throw new Error(
              "Company website not found; please set a website in your company profile"
            );
          }

          propertyUrl = companyForUrl.website.startsWith("http")
            ? companyForUrl.website
            : `https://${companyForUrl.website}`;
        }

        integrationData.gscPropertyUrl = propertyUrl;
      } else if (request.integrationName === "manual_tracking") {
        // Generate verification token and tracking code for the user's website
        const company = await prisma.company.findUnique({
          where: { id: request.companyId },
        });

        if (!company) {
          throw new Error("Company not found");
        }

        const verificationToken =
          analyticsVerificationService.generateVerificationToken(
            company.website
          );
        const trackingCode = this.generateWebsiteTrackingCode(
          request.companyId,
          company.website
        );

        integrationData.verificationToken = verificationToken.token;
        integrationData.trackingCode = trackingCode;

        verificationDetails = {
          verificationToken: verificationToken.token,
          metaTag: verificationToken.metaTag,
          dnsRecord: verificationToken.dnsRecord,
          fileName: verificationToken.fileName,
          fileContent: verificationToken.fileContent,
          trackingCode,
        };
      } else if (request.integrationName === "google_analytics_4") {
        // GA4 supports OAuth or manual measurementId/tag capture
        if (request.verificationMethod === "oauth") {
          // OAuth flow; property selection handled after callback if needed
          integrationData.integrationName = "google_analytics_4";
          // optional: store initial hint (propertyId or tag) if provided
          if (request.ga4PropertyIdOrTag) {
            integrationData.trackingCode = request.ga4PropertyIdOrTag;
          }
        } else if (request.verificationMethod === "meta_tag") {
          // Manual GA4 measurement ID / tag is stored in trackingCode
          if (!request.ga4PropertyIdOrTag) {
            throw new Error("GA4 manual setup requires a Measurement ID");
          }
          integrationData.integrationName = "google_analytics_4";
          integrationData.status = "active";
          integrationData.trackingCode = request.ga4PropertyIdOrTag; // e.g., G-XXXXXXX
        } else {
          throw new Error("Unsupported GA4 verification method");
        }
      }

      // Delete existing integration if it exists (replace with new one)
      if (existingIntegration) {
        await prisma.analyticsIntegration.delete({
          where: { id: existingIntegration.id },
        });
      }

      const integration = await prisma.analyticsIntegration.create({
        data: integrationData,
      });

      logger.info(
        `Created website analytics integration ${integration.id} for company ${request.companyId}`
      );

      return {
        integration,
        verificationDetails,
      };
    } catch (error) {
      logger.error("Error creating website analytics integration:", error);
      throw error;
    }
  }

  /**
   * Complete OAuth integration with Google Search Console
   */
  async completeOAuthIntegration(
    integrationId: string,
    authCode: string
  ): Promise<void> {
    try {
      const prisma = await dbCache.getPrimaryClient();

      const integration = await prisma.analyticsIntegration.findUnique({
        where: { id: integrationId },
      });

      if (!integration) {
        throw new Error("Integration not found");
      }

      // Exchange code for tokens
      const tokens =
        await googleSearchConsoleService.getTokensFromCode(authCode);

      // Validate property access if property URL is specified
      if (integration.gscPropertyUrl) {
        const hasAccess =
          await googleSearchConsoleService.validatePropertyAccess(
            tokens.access_token,
            integration.gscPropertyUrl
          );

        if (!hasAccess) {
          throw new Error("No access to specified Search Console property");
        }
      }

      // Update integration with tokens
      await prisma.analyticsIntegration.update({
        where: { id: integrationId },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          status: "active",
          verificationMethod: "oauth",
        },
      });

      // Trigger initial data sync
      try {
        await googleSearchConsoleService.syncIntegrationData(integrationId);
      } catch (syncError) {
        logger.warn("Initial data sync failed, will retry later:", syncError);
      }

      logger.info(`Completed OAuth integration ${integrationId}`);
    } catch (error) {
      logger.error("Error completing OAuth integration:", error);
      throw error;
    }
  }

  /**
   * Verify manual integration for user's website
   */
  async verifyManualIntegration(integrationId: string): Promise<any> {
    try {
      const result =
        await analyticsVerificationService.verifyIntegration(integrationId);

      if (result.verified) {
        const prisma = await dbCache.getPrimaryClient();
        await prisma.analyticsIntegration.update({
          where: { id: integrationId },
          data: { status: "active" },
        });
      }

      return result;
    } catch (error) {
      logger.error("Error verifying manual integration:", error);
      throw error;
    }
  }

  /**
   * Get website analytics integrations for a company
   */
  async getCompanyIntegrations(
    companyId: string
  ): Promise<IntegrationStatus[]> {
    try {
      const prisma = await dbCache.getPrimaryClient();

      const integrations = await prisma.analyticsIntegration.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
      });

      return integrations.map((integration) => {
        const isConfigured = integration.status === "active";
        let healthStatus: "healthy" | "warning" | "error" = "healthy";
        let healthMessage: string | undefined;

        // Determine health status
        if (integration.status === "failed") {
          healthStatus = "error";
          healthMessage = "Verification failed";
        } else if (integration.status === "pending") {
          healthStatus = "warning";
          healthMessage = "Pending verification";
        } else if (
          integration.integrationName === "google_search_console" &&
          integration.lastSyncAt
        ) {
          const lastSync = new Date(integration.lastSyncAt);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (lastSync < oneDayAgo) {
            healthStatus = "warning";
            healthMessage = "Data sync overdue";
          }
        }

        return {
          id: integration.id,
          integrationName: integration.integrationName,
          status: integration.status,
          verificationMethod: integration.verificationMethod || undefined,
          verificationToken: integration.verificationToken || undefined,
          gscPropertyUrl: integration.gscPropertyUrl || undefined,
          lastSyncAt: integration.lastSyncAt || undefined,
          createdAt: integration.createdAt,
          isConfigured,
          healthStatus,
          healthMessage,
        };
      });
    } catch (error) {
      logger.error("Error getting company integrations:", error);
      throw error;
    }
  }

  /**
   * Get website analytics metrics for a company
   */
  async getWebsiteAnalyticsMetrics(
    companyId: string,
    startDate: Date,
    endDate: Date,
    integrationId?: string
  ): Promise<WebsiteAnalyticsMetrics> {
    try {
      const prisma = await dbCache.getPrimaryClient();

      const whereClause: any = {
        integration: { companyId },
        date: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (integrationId) {
        whereClause.integrationId = integrationId;
      }

      const analyticsData = await prisma.analyticsData.findMany({
        where: whereClause,
        orderBy: { date: "desc" },
      });

      return this.calculateWebsiteMetrics(analyticsData);
    } catch (error) {
      logger.error("Error getting website analytics metrics:", error);
      throw error;
    }
  }

  /**
   * Delete a website analytics integration
   */
  async deleteIntegration(integrationId: string): Promise<void> {
    try {
      const prisma = await dbCache.getPrimaryClient();

      await prisma.analyticsIntegration.delete({
        where: { id: integrationId },
      });

      logger.info(`Deleted website analytics integration ${integrationId}`);
    } catch (error) {
      logger.error("Error deleting integration:", error);
      throw error;
    }
  }

  /**
   * Generate tracking code for user's website (not for Serplexity platform)
   */
  private generateWebsiteTrackingCode(
    companyId: string,
    websiteUrl: string
  ): string {
    const trackingId = `sa-${companyId.slice(0, 8)}-${randomBytes(4).toString("hex")}`;
    const domain = new URL(websiteUrl).hostname;

    return `
<!-- Serplexity Website Analytics -->
<script>
(function(window, document) {
  // Analytics for ${domain} - powered by Serplexity
  var sa = window.sa = window.sa || function() {
    (sa.q = sa.q || []).push(arguments);
  };
  sa.l = +new Date();
  sa.config = {
    trackingId: '${trackingId}',
    companyId: '${companyId}',
    website: '${websiteUrl}',
    apiEndpoint: '${process.env.FRONTEND_URL || "https://app.serplexity.com"}/api/website-analytics/track'
  };

  var script = document.createElement('script');
  script.async = true;
  script.src = '${process.env.FRONTEND_URL || "https://app.serplexity.com"}/sa-tracker.js';
  document.head.appendChild(script);

  // Track page view
  sa('page_view', {
    page: window.location.pathname + window.location.search,
    title: document.title,
    referrer: document.referrer
  });
})(window, document);
</script>
<!-- End Serplexity Website Analytics -->
    `.trim();
  }

  /**
   * Calculate website analytics metrics from raw data
   */
  private calculateWebsiteMetrics(data: any[]): WebsiteAnalyticsMetrics {
    if (data.length === 0) {
      return {
        totalImpressions: 0,
        totalClicks: 0,
        averageCtr: 0,
        averagePosition: 0,
        totalQueries: 0,
        topQueries: [],
        topPages: [],
        deviceBreakdown: [],
        countryBreakdown: [],
        performanceOverTime: [],
      };
    }

    // Aggregate totals
    const totalImpressions = data.reduce(
      (sum, row) => sum + (row.impressions || 0),
      0
    );
    const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
    const averageCtr =
      totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    // Calculate weighted average position
    const weightedPositionSum = data.reduce(
      (sum, row) => sum + (row.position || 0) * (row.impressions || 0),
      0
    );
    const averagePosition =
      totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;

    // Get unique queries
    const uniqueQueries = new Set(data.map((row) => row.query).filter(Boolean));
    const totalQueries = uniqueQueries.size;

    // Top queries aggregation
    const queryStats = new Map();
    data.forEach((row) => {
      if (row.query) {
        const existing = queryStats.get(row.query) || {
          query: row.query,
          impressions: 0,
          clicks: 0,
          totalPosition: 0,
          count: 0,
        };
        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        existing.totalPosition += (row.position || 0) * (row.impressions || 0);
        existing.count += row.impressions || 0;
        queryStats.set(row.query, existing);
      }
    });

    const topQueries = Array.from(queryStats.values())
      .map((stat) => ({
        query: stat.query,
        impressions: stat.impressions,
        clicks: stat.clicks,
        ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
        position: stat.count > 0 ? stat.totalPosition / stat.count : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    // Top pages aggregation
    const pageStats = new Map();
    data.forEach((row) => {
      if (row.page) {
        const existing = pageStats.get(row.page) || {
          page: row.page,
          impressions: 0,
          clicks: 0,
          totalPosition: 0,
          count: 0,
        };
        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        existing.totalPosition += (row.position || 0) * (row.impressions || 0);
        existing.count += row.impressions || 0;
        pageStats.set(row.page, existing);
      }
    });

    const topPages = Array.from(pageStats.values())
      .map((stat) => ({
        page: stat.page,
        impressions: stat.impressions,
        clicks: stat.clicks,
        ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
        position: stat.count > 0 ? stat.totalPosition / stat.count : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    // Device breakdown
    const deviceStats = new Map();
    data.forEach((row) => {
      if (row.deviceType) {
        const existing = deviceStats.get(row.deviceType) || {
          device: row.deviceType,
          impressions: 0,
          clicks: 0,
        };
        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        deviceStats.set(row.deviceType, existing);
      }
    });

    const deviceBreakdown = Array.from(deviceStats.values()).map((stat) => ({
      device: stat.device,
      impressions: stat.impressions,
      clicks: stat.clicks,
      ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
    }));

    // Country breakdown
    const countryStats = new Map();
    data.forEach((row) => {
      if (row.country) {
        const existing = countryStats.get(row.country) || {
          country: row.country,
          impressions: 0,
          clicks: 0,
        };
        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        countryStats.set(row.country, existing);
      }
    });

    const countryBreakdown = Array.from(countryStats.values())
      .map((stat) => ({
        country: stat.country,
        impressions: stat.impressions,
        clicks: stat.clicks,
        ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10);

    // Performance over time
    const dateStats = new Map();
    data.forEach((row) => {
      const dateKey = row.date.toISOString().split("T")[0];
      const existing = dateStats.get(dateKey) || {
        date: dateKey,
        impressions: 0,
        clicks: 0,
        totalPosition: 0,
        count: 0,
      };
      existing.impressions += row.impressions || 0;
      existing.clicks += row.clicks || 0;
      existing.totalPosition += (row.position || 0) * (row.impressions || 0);
      existing.count += row.impressions || 0;
      dateStats.set(dateKey, existing);
    });

    const performanceOverTime = Array.from(dateStats.values())
      .map((stat) => ({
        date: stat.date,
        impressions: stat.impressions,
        clicks: stat.clicks,
        ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
        position: stat.count > 0 ? stat.totalPosition / stat.count : 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      totalImpressions,
      totalClicks,
      averageCtr,
      averagePosition,
      totalQueries,
      topQueries,
      topPages,
      deviceBreakdown,
      countryBreakdown,
      performanceOverTime,
    };
  }
}

export const websiteAnalyticsService = new WebsiteAnalyticsService();
export default websiteAnalyticsService;
