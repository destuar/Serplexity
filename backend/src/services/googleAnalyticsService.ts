/**
 * @file googleAnalyticsService.ts
 * @description Google Analytics 4 (GA4) integration service for visitor analytics data
 *
 * Responsibilities:
 * - OAuth2 flow for GA4
 * - Fetch summary metrics (sessions, users, page views, engagement)
 */

import { google, analyticsdata_v1beta, analyticsadmin_v1alpha } from "googleapis";
import env from "../config/env";
import logger from "../utils/logger";

export interface GA4AuthTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

export interface Ga4SummaryMetrics {
  sessions: number;
  totalUsers: number;
  screenPageViews: number;
  averageSessionDuration: number; // seconds
  bounceRate: number; // percentage 0-100
  topPages: Array<{ pagePath: string; views: number; users: number }>; // limited selection
  topReferrers: Array<{ source: string; medium: string; sessions: number; users: number }>; // traffic sources
  timeSeriesData?: Array<{
    date: string;
    sessions: number;
    totalUsers: number;
    screenPageViews: number;
    averageSessionDuration: number;
    bounceRate: number;
  }>;
}

export interface GA4Property {
  propertyId: string;
  displayName: string;
  websiteUrl?: string;
  industryCategory?: string;
  timeZone?: string;
}

class GoogleAnalyticsService {
  private oauth2: any;

  constructor() {
    this.oauth2 = new google.auth.OAuth2(
      env.GA4_GOOGLE_CLIENT_ID,
      env.GA4_GOOGLE_CLIENT_SECRET,
      env.GA4_GOOGLE_CALLBACK_URL
    );
  }

  getAuthUrl(state?: string): string {
    const scopes = [
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/analytics.manage.users.readonly"
    ];

    return this.oauth2.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: state || "",
      prompt: "consent",
    });
  }

  async getTokensFromCode(code: string): Promise<GA4AuthTokens> {
    try {
      const { tokens } = await this.oauth2.getToken(code);
      if (!tokens.access_token) {
        throw new Error("No access token received from Google");
      }
      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope || "",
        token_type: tokens.token_type || "Bearer",
        expiry_date: tokens.expiry_date,
      };
    } catch (error) {
      logger.error("[GA4] Error exchanging code for tokens:", error);
      throw new Error(`Failed to get GA4 tokens: ${(error as Error).message}`);
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<GA4AuthTokens> {
    try {
      this.oauth2.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2.refreshAccessToken();
      return {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || refreshToken,
        scope: credentials.scope || "",
        token_type: credentials.token_type || "Bearer",
        expiry_date: credentials.expiry_date,
      };
    } catch (error) {
      logger.error("[GA4] Error refreshing access token:", error);
      throw new Error(
        `Failed to refresh GA4 token: ${(error as Error).message}`
      );
    }
  }

  /**
   * Discover available GA4 properties for the authenticated user
   */
  async discoverGA4Properties(accessToken: string): Promise<GA4Property[]> {
    try {
      this.oauth2.setCredentials({ access_token: accessToken });
      const analyticsAdmin: analyticsadmin_v1alpha.Analyticsadmin = google.analyticsadmin("v1alpha");

      // List all accounts first
      const accountsResponse = await analyticsAdmin.accounts.list({
        auth: this.oauth2,
      });

      const properties: GA4Property[] = [];

      // For each account, list its properties
      for (const account of accountsResponse.data.accounts || []) {
        if (!account.name) continue;

        try {
          const propertiesResponse = await analyticsAdmin.properties.list({
            filter: `parent:${account.name}`,
            auth: this.oauth2,
          });

          for (const property of propertiesResponse.data.properties || []) {
            if (property.name && property.displayName) {
              // Extract numeric property ID from resource name (e.g., "properties/123456789")
              const propertyIdMatch = property.name.match(/properties\/(\d+)/);
              if (propertyIdMatch) {
                properties.push({
                  propertyId: propertyIdMatch[1],
                  displayName: property.displayName,
                  websiteUrl: undefined, // Not available in current API response
                  industryCategory: undefined, // Not available in current API response  
                  timeZone: property.timeZone || undefined,
                });
              }
            }
          }
        } catch (propertyError) {
          logger.warn(`[GA4] Failed to list properties for account ${account.name}:`, propertyError);
          // Continue with other accounts
        }
      }

      logger.info(`[GA4] Discovered ${properties.length} GA4 properties`);
      return properties;
    } catch (error) {
      logger.error("[GA4] Error discovering GA4 properties:", error);
      throw new Error(`Failed to discover GA4 properties: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch current active users from GA4 Real-time Reporting API
   */
  async getCurrentActiveUsers(
    accessToken: string,
    propertyId: string
  ): Promise<number> {
    try {
      this.oauth2.setCredentials({ access_token: accessToken });
      const analyticsData: analyticsdata_v1beta.Analyticsdata = google.analyticsdata("v1beta");

      const realtimeReport = await analyticsData.properties.runRealtimeReport({
        property: `properties/${String(propertyId)}`,
        requestBody: {
          metrics: [{ name: "activeUsers" }],
        },
        auth: this.oauth2,
      });

      const activeUsers = Number(realtimeReport.data.rows?.[0]?.metricValues?.[0]?.value || 0);
      logger.info(`[GA4] Real-time active users: ${activeUsers}`);
      
      return activeUsers;
    } catch (error) {
      logger.error("[GA4] Error fetching real-time active users:", error);
      return 0;
    }
  }

  /**
   * Fetch a minimal set of summary metrics from GA4 Analytics Data API
   */
  async getSummaryMetrics(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<Ga4SummaryMetrics> {
    try {
      // Debug: Log the input parameters
      logger.info(`[GA4] getSummaryMetrics called with propertyId=${propertyId}, dateRange=${startDate} to ${endDate}`);
      
      this.oauth2.setCredentials({ access_token: accessToken });
      const analyticsData: analyticsdata_v1beta.Analyticsdata = google.analyticsdata("v1beta");

      // Core summary metrics
      const report = await analyticsData.properties.runReport({
        property: `properties/${String(propertyId)}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
            { name: "engagementRate" },
          ],
        },
        auth: this.oauth2,
      });

      const values = (report.data.rows?.[0]?.metricValues || []).map(
        (m) => Number(m.value) || 0
      );
      const [
        sessions,
        totalUsers,
        screenPageViews,
        avgSessionDuration,
        engagementRate,
      ] = values;
      
      // Calculate bounce rate as 1 - engagement rate (GA4 standard)
      const bounceRate = (1 - (engagementRate || 0)) * 100;

      // Top pages (limit to 10)
      const topPagesReport = await analyticsData.properties.runReport({
        property: `properties/${String(propertyId)}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
          limit: "10",
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        },
        auth: this.oauth2,
      });

      const topPages = (topPagesReport.data.rows || []).map((row: any) => ({
        pagePath: row.dimensionValues?.[0]?.value || "",
        views: Number(row.metricValues?.[0]?.value || 0),
        users: Number(row.metricValues?.[1]?.value || 0),
      }));

      // Top referrers (traffic sources - limit to 10)
      const topReferrersReport = await analyticsData.properties.runReport({
        property: `properties/${String(propertyId)}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
          metrics: [{ name: "sessions" }, { name: "totalUsers" }],
          limit: "10",
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        },
        auth: this.oauth2,
      });

      const topReferrers = (topReferrersReport.data.rows || []).map((row: any) => ({
        source: row.dimensionValues?.[0]?.value || "unknown",
        medium: row.dimensionValues?.[1]?.value || "unknown", 
        sessions: Number(row.metricValues?.[0]?.value || 0),
        users: Number(row.metricValues?.[1]?.value || 0),
      }));

      // Fetch daily time series data
      const timeSeriesReport = await analyticsData.properties.runReport({
        property: `properties/${String(propertyId)}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
            { name: "engagementRate" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
        },
        auth: this.oauth2,
      });

      // Debug: Log raw time series response
      logger.info(`[GA4] Time series API returned ${timeSeriesReport.data.rows?.length || 0} rows`);
      
      const timeSeriesData = (timeSeriesReport.data.rows || [])
        .map((row: any, index: number) => {
          const rawDate = row.dimensionValues?.[0]?.value || "";
          const metricValues = (row.metricValues || []).map((m: any) => Number(m.value) || 0);
          const [dailySessions, dailyUsers, dailyPageViews, dailyAvgDuration, dailyEngagementRate] = metricValues;
          
          // Calculate bounce rate as 1 - engagement rate (GA4 standard)
          const dailyBounceRate = (1 - (dailyEngagementRate || 0)) * 100;

          // Debug: Log first few rows for inspection
          if (index < 3) {
            logger.info(`[GA4] Row ${index}: rawDate=${rawDate}, users=${dailyUsers}, sessions=${dailySessions}`);
          }

          // Convert GA4 date format (YYYYMMDD) to ISO format (YYYY-MM-DD)
          let formattedDate = "";
          if (rawDate && rawDate.length === 8) {
            const year = rawDate.substring(0, 4);
            const month = rawDate.substring(4, 6);
            const day = rawDate.substring(6, 8);
            formattedDate = `${year}-${month}-${day}`;
            
            // Validate the date is actually valid
            const testDate = new Date(formattedDate);
            if (isNaN(testDate.getTime())) {
              logger.warn(`[GA4] Invalid date format received: ${rawDate}`);
              return null; // Will be filtered out
            }
          } else {
            logger.warn(`[GA4] Unexpected date format received: ${rawDate}`);
            return null; // Will be filtered out
          }

          return {
            date: formattedDate,
            sessions: dailySessions,
            totalUsers: dailyUsers,
            screenPageViews: dailyPageViews,
            averageSessionDuration: dailyAvgDuration,
            bounceRate: dailyBounceRate,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null); // Remove invalid dates
      
      // Debug: Log final processed time series data
      logger.info(`[GA4] Processed timeSeriesData: ${timeSeriesData.length} valid entries`);
      if (timeSeriesData.length > 0) {
        logger.info(`[GA4] Date range: ${timeSeriesData[0].date} to ${timeSeriesData[timeSeriesData.length - 1].date}`);
      }

      return {
        sessions: sessions || 0,
        totalUsers: totalUsers || 0,
        screenPageViews: screenPageViews || 0,
        averageSessionDuration: avgSessionDuration || 0,
        bounceRate: bounceRate || 0,
        topPages,
        topReferrers,
        timeSeriesData,
      };
    } catch (error) {
      logger.error("[GA4] Error fetching summary metrics:", error);
      
      // Log specific error details for debugging
      if (error instanceof Error) {
        logger.error("[GA4] Error message:", error.message);
        logger.error("[GA4] Error stack:", error.stack);
      }
      
      // Log API response details if available
      if (error && typeof error === 'object' && 'response' in error) {
        const apiError = error as any;
        logger.error("[GA4] API Error Status:", apiError.response?.status);
        logger.error("[GA4] API Error Data:", JSON.stringify(apiError.response?.data, null, 2));
      }
      
      // Return safe defaults but log that we're doing so
      logger.warn("[GA4] Returning empty timeSeriesData due to error - daily charts will not display");
      return {
        sessions: 0,
        totalUsers: 0,
        screenPageViews: 0,
        averageSessionDuration: 0,
        bounceRate: 0,
        topPages: [],
        topReferrers: [],
        timeSeriesData: [],
      };
    }
  }
}

export const googleAnalyticsService = new GoogleAnalyticsService();
export default googleAnalyticsService;
