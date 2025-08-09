/**
 * @file googleAnalyticsService.ts
 * @description Google Analytics 4 (GA4) integration service for visitor analytics data
 *
 * Responsibilities:
 * - OAuth2 flow for GA4
 * - Fetch summary metrics (sessions, users, page views, engagement)
 */

import { google } from "googleapis";
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

class GoogleAnalyticsService {
  private oauth2: any;

  constructor() {
    this.oauth2 = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      // Use shared callback env for simplicity; must include the GA4 route in OAuth config
      env.GOOGLE_CALLBACK_URL ||
        `${env.FRONTEND_URL}/api/website-analytics/oauth/callback`
    );
  }

  getAuthUrl(state?: string): string {
    const scopes = ["https://www.googleapis.com/auth/analytics.readonly"];

    return this.oauth2.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: state || "",
      prompt: "consent",
    });
  }

  async getTokensFromCode(code: string): Promise<GA4AuthTokens> {
    try {
      const { tokens } = await this.oauth2.getAccessToken(code);
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
      const analyticsData = google.analyticsdata("v1");

      // Core summary metrics
      const report = await analyticsData.properties.runReport({
        auth: this.oauth2,
        property: `properties/${propertyId}`,
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
        auth: this.oauth2,
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
          limit: 10,
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        },
      });

      const topPages = (topPagesReport.data.rows || []).map((row) => ({
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
