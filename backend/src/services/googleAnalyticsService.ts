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
                  websiteUrl: property.websiteUrl || undefined,
                  industryCategory: property.industryCategory || undefined,
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
   * Fetch a minimal set of summary metrics from GA4 Analytics Data API
   */
  async getSummaryMetrics(
    accessToken: string,
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<Ga4SummaryMetrics> {
    try {
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
            { name: "bounceRate" },
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
        bounceRate,
      ] = values;

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

      return {
        sessions: sessions || 0,
        totalUsers: totalUsers || 0,
        screenPageViews: screenPageViews || 0,
        averageSessionDuration: avgSessionDuration || 0,
        bounceRate: bounceRate || 0,
        topPages,
      };
    } catch (error) {
      logger.error("[GA4] Error fetching summary metrics:", error);
      // Return safe defaults instead of failing the page
      return {
        sessions: 0,
        totalUsers: 0,
        screenPageViews: 0,
        averageSessionDuration: 0,
        bounceRate: 0,
        topPages: [],
      };
    }
  }
}

export const googleAnalyticsService = new GoogleAnalyticsService();
export default googleAnalyticsService;
