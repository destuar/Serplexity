/**
 * @file googleSearchConsoleService.ts
 * @description Google Search Console API integration service for analytics data collection
 *
 * This service handles:
 * - OAuth authentication flow for Google Search Console
 * - Search Console API data fetching (performance data)
 * - Token management and refresh
 * - Data transformation for storage
 */

import { google } from 'googleapis';
import logger from '../utils/logger';
import { dbCache } from '../config/dbCache';
import env from '../config/env';

export interface GSCPerformanceData {
  query?: string;
  page?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
  device?: string;
  country?: string;
}

export interface GSCPropertyInfo {
  siteUrl: string;
  permissionLevel: string;
}

export interface GSCAuthTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

class GoogleSearchConsoleService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_CALLBACK_URL || `${env.FRONTEND_URL}/analytics/callback`
    );
  }

  /**
   * Generate OAuth authorization URL for Google Search Console
   */
  getAuthUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/webmasters'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state || '',
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for access tokens
   */
  async getTokensFromCode(code: string): Promise<GSCAuthTokens> {
    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope || '',
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date
      };
    } catch (error) {
      logger.error('Error exchanging code for tokens:', error);
      throw new Error(`Failed to get tokens: ${(error as Error).message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GSCAuthTokens> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      return {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || refreshToken,
        scope: credentials.scope || '',
        token_type: credentials.token_type || 'Bearer',
        expiry_date: credentials.expiry_date
      };
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw new Error(`Failed to refresh token: ${(error as Error).message}`);
    }
  }

  /**
   * Get list of Search Console properties for authenticated user
   */
  async getProperties(accessToken: string): Promise<GSCPropertyInfo[]> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const webmasters = google.webmasters({ version: 'v3', auth: this.oauth2Client });

      const response = await webmasters.sites.list();
      
      return (response.data.siteEntry || []).map(site => ({
        siteUrl: site.siteUrl!,
        permissionLevel: site.permissionLevel!
      }));
    } catch (error) {
      logger.error('Error fetching Search Console properties:', error);
      throw new Error(`Failed to get properties: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch search performance data from Google Search Console
   */
  async getPerformanceData(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: string[] = ['query', 'page'],
    filters?: Array<{ dimension: string; operator: string; expression: string }>
  ): Promise<GSCPerformanceData[]> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const webmasters = google.webmasters({ version: 'v3', auth: this.oauth2Client });

      const requestBody: any = {
        startDate,
        endDate,
        dimensions,
        rowLimit: 25000, // Maximum allowed by API
        startRow: 0
      };

      if (filters && filters.length > 0) {
        requestBody.dimensionFilterGroups = [{
          filters: filters.map(filter => ({
            dimension: filter.dimension,
            operator: filter.operator,
            expression: filter.expression
          }))
        }];
      }

      const response = await webmasters.searchanalytics.query({
        siteUrl,
        requestBody
      });

      if (!response.data.rows) {
        return [];
      }

      return response.data.rows.map(row => {
        const data: GSCPerformanceData = {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
          date: startDate // Simplified - in real usage, you'd need to handle date dimension
        };

        // Map dimensions to data properties
        if (row.keys && dimensions) {
          dimensions.forEach((dimension, index) => {
            switch (dimension) {
              case 'query':
                data.query = row.keys![index];
                break;
              case 'page':
                data.page = row.keys![index];
                break;
              case 'device':
                data.device = row.keys![index];
                break;
              case 'country':
                data.country = row.keys![index];
                break;
            }
          });
        }

        return data;
      });
    } catch (error) {
      logger.error('Error fetching performance data:', error);
      throw new Error(`Failed to get performance data: ${(error as Error).message}`);
    }
  }

  /**
   * Store analytics data in database
   */
  async storePerformanceData(
    integrationId: string,
    performanceData: GSCPerformanceData[]
  ): Promise<void> {
    try {
      const prisma = await dbCache.getPrimaryClient();

      const analyticsData = performanceData.map(data => ({
        integrationId,
        date: new Date(data.date),
        source: 'search_console',
        query: data.query || null,
        page: data.page || null,
        impressions: data.impressions,
        clicks: data.clicks,
        ctr: data.ctr,
        position: data.position,
        deviceType: data.device || null,
        country: data.country || null,
        searchVolume: null, // GSC doesn't provide search volume
        attribution: null
      }));

      // Use createMany for bulk insert, handling duplicates gracefully
      await prisma.analyticsData.createMany({
        data: analyticsData,
        skipDuplicates: true
      });

      logger.info(`Stored ${analyticsData.length} analytics data points for integration ${integrationId}`);
    } catch (error) {
      logger.error('Error storing performance data:', error);
      throw new Error(`Failed to store data: ${(error as Error).message}`);
    }
  }

  /**
   * Sync data for a specific integration
   */
  async syncIntegrationData(integrationId: string): Promise<void> {
    try {
      const prisma = await dbCache.getPrimaryClient();
      
      const integration = await prisma.analyticsIntegration.findUnique({
        where: { id: integrationId },
        include: { company: true }
      });

      if (!integration || integration.status !== 'active') {
        throw new Error('Integration not found or not active');
      }

      if (!integration.accessToken || !integration.gscPropertyUrl) {
        throw new Error('Missing access token or property URL');
      }

      // Calculate date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const formatDate = (date: Date) => date.toISOString().split('T')[0];

      // Fetch performance data
      const performanceData = await this.getPerformanceData(
        integration.accessToken,
        integration.gscPropertyUrl,
        formatDate(startDate),
        formatDate(endDate),
        ['query', 'page', 'device', 'country']
      );

      // Store the data
      await this.storePerformanceData(integrationId, performanceData);

      // Update last sync timestamp
      await prisma.analyticsIntegration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date() }
      });

      logger.info(`Successfully synced data for integration ${integrationId}`);
    } catch (error) {
      logger.error(`Error syncing integration ${integrationId}:`, error);
      throw error;
    }
  }

  /**
   * Validate Search Console access for a property
   */
  async validatePropertyAccess(accessToken: string, siteUrl: string): Promise<boolean> {
    try {
      const properties = await this.getProperties(accessToken);
      return properties.some(prop => 
        prop.siteUrl === siteUrl && 
        ['siteOwner', 'siteFullUser', 'siteRestrictedUser'].includes(prop.permissionLevel)
      );
    } catch (error) {
      logger.error('Error validating property access:', error);
      return false;
    }
  }
}

export const googleSearchConsoleService = new GoogleSearchConsoleService();
export default googleSearchConsoleService;