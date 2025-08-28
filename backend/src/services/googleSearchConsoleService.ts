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

import { google } from "googleapis";
import { dbCache } from "../config/dbCache";
import env from "../config/env";
import logger from "../utils/logger";

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

/**
 * Helper function to generate complete date range array
 */
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDiff = end.getTime() - start.getTime();
  const dayCount = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1; // +1 to include end date
  
  for (let i = 0; i < dayCount; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    dates.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD format
  }
  
  return dates;
}

/**
 * Helper function to fill missing dates in time series data with appropriate defaults
 */
function fillMissingDates(
  apiData: GSCPerformanceData[],
  expectedDates: string[]
): GSCPerformanceData[] {
  const dataMap = new Map<string, GSCPerformanceData>();
  
  // Build map of existing data by date
  apiData.forEach(row => {
    if (row.date) {
      dataMap.set(row.date, row);
    }
  });
  
  // Fill in missing dates with zero values
  const completeData: GSCPerformanceData[] = [];
  expectedDates.forEach(date => {
    if (dataMap.has(date)) {
      completeData.push(dataMap.get(date)!);
    } else {
      // Create zero-value entry for missing dates
      completeData.push({
        date,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0
      });
    }
  });
  
  return completeData;
}

class GoogleSearchConsoleService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      env.GSC_GOOGLE_CLIENT_ID,
      env.GSC_GOOGLE_CLIENT_SECRET,
      env.GSC_GOOGLE_CALLBACK_URL
    );
  }

  /**
   * Generate OAuth authorization URL for Google Search Console
   */
  getAuthUrl(state?: string): string {
    const scopes = ["https://www.googleapis.com/auth/webmasters.readonly"];

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: state || "",
      prompt: "consent", // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for access tokens
   */
  async getTokensFromCode(code: string): Promise<GSCAuthTokens> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

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
      logger.error("Error exchanging code for tokens:", error);
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
        scope: credentials.scope || "",
        token_type: credentials.token_type || "Bearer",
        expiry_date: credentials.expiry_date,
      };
    } catch (error) {
      logger.error("Error refreshing access token:", error);
      throw new Error(`Failed to refresh token: ${(error as Error).message}`);
    }
  }

  /**
   * Get list of Search Console properties for authenticated user
   */
  async getProperties(accessToken: string): Promise<GSCPropertyInfo[]> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const webmasters = google.webmasters({
        version: "v3",
        auth: this.oauth2Client,
      });

      const response = await webmasters.sites.list();

      return (response.data.siteEntry || []).map((site) => ({
        siteUrl: site.siteUrl!,
        permissionLevel: site.permissionLevel!,
      }));
    } catch (error) {
      logger.error("Error fetching Search Console properties:", error);
      throw new Error(`Failed to get properties: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch search performance data from Google Search Console with pagination
   */
  async getPerformanceData(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimensions: string[] = ["query", "page"],
    filters?: Array<{ dimension: string; operator: string; expression: string }>
  ): Promise<GSCPerformanceData[]> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      const webmasters = google.webmasters({
        version: "v3",
        auth: this.oauth2Client,
      });

      const allData: GSCPerformanceData[] = [];
      let startRow = 0;
      const rowLimit = 25000; // Maximum allowed by API per request
      let hasMoreData = true;

      // Implement pagination to get complete dataset
      while (hasMoreData) {
        const requestBody: any = {
          startDate,
          endDate,
          dimensions,
          rowLimit,
          startRow,
          dataState: "all", // Include fresh/incomplete data for more complete results
          aggregationType: "auto", // Let API determine best aggregation method
        };

        // Note: GSC API automatically sorts by date when using date dimension (ascending order)

        if (filters && filters.length > 0) {
          requestBody.dimensionFilterGroups = [
            {
              filters: filters.map((filter) => ({
                dimension: filter.dimension,
                operator: filter.operator,
                expression: filter.expression,
              })),
            },
          ];
        }

        const response = await webmasters.searchanalytics.query({
          siteUrl,
          requestBody,
        });

        if (!response.data.rows || response.data.rows.length === 0) {
          hasMoreData = false;
          break;
        }

        // COMPREHENSIVE DIAGNOSTIC LOGGING for date dimension
        if (dimensions.includes("date") && startRow === 0) {
          logger.info(`[GSC-DIAGNOSTIC] ===== COMPREHENSIVE API RESPONSE ANALYSIS =====`);
          logger.info(`[GSC-DIAGNOSTIC] Request parameters:`, {
            siteUrl: siteUrl,
            startDate: startDate,
            endDate: endDate,
            dimensions: dimensions,
            rowLimit: rowLimit,
            startRow: startRow,
            dataState: requestBody.dataState,
            aggregationType: requestBody.aggregationType
          });
          
          logger.info(`[GSC-DIAGNOSTIC] API Response summary:`, {
            totalRows: response.data.rows?.length || 0,
            hasRows: !!response.data.rows,
            responseStructure: Object.keys(response.data || {})
          });
          
          if (response.data.rows && response.data.rows.length > 0) {
            logger.info(`[GSC-DIAGNOSTIC] First 10 raw API rows with complete structure:`);
            response.data.rows.slice(0, 10).forEach((row, i) => {
              logger.info(`[GSC-DIAGNOSTIC] Row ${i}:`, {
                keys: row.keys,
                keysType: typeof row.keys,
                keysIsArray: Array.isArray(row.keys),
                keysLength: row.keys?.length,
                keysContent: row.keys ? [...row.keys] : null,
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr,
                position: row.position,
                otherFields: Object.keys(row).filter(k => !['keys', 'clicks', 'impressions', 'ctr', 'position'].includes(k))
              });
            });
            
            // Analyze keys patterns
            const keysPatterns = response.data.rows.slice(0, 10).map(row => ({
              length: row.keys?.length || 0,
              firstKey: row.keys?.[0],
              firstKeyType: typeof row.keys?.[0],
              firstKeyLength: typeof row.keys?.[0] === 'string' ? row.keys[0].length : 0
            }));
            logger.info(`[GSC-DIAGNOSTIC] Keys patterns analysis:`, keysPatterns);
          } else {
            logger.warn(`[GSC-DIAGNOSTIC] NO ROWS RETURNED by GSC API - this is the root cause`);
          }
          
          logger.info(`[GSC-DIAGNOSTIC] ===== END DIAGNOSTIC ANALYSIS =====`);
        }

        // Process this batch of data
        const batchData = response.data.rows.map((row) => {
          const data: GSCPerformanceData = {
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
            date: startDate, // Default date, will be overridden if date dimension present
          };

          // Map dimensions to data properties
          if (row.keys && dimensions) {
            dimensions.forEach((dimension, index) => {
              switch (dimension) {
                case "query":
                  data.query = row.keys![index];
                  break;
                case "page":
                  data.page = row.keys![index];
                  break;
                case "device":
                  data.device = row.keys![index];
                  break;
                case "country":
                  data.country = row.keys![index];
                  break;
                case "date":
                  // COMPREHENSIVE DATE PROCESSING DIAGNOSTIC
                  const rawDate = row.keys![index];
                  logger.info(`[GSC-DATE-DIAGNOSTIC] Processing date for row with dimensions [${dimensions.join(", ")}]:`);
                  logger.info(`[GSC-DATE-DIAGNOSTIC] - rawDate: "${rawDate}" (type: ${typeof rawDate})`);
                  logger.info(`[GSC-DATE-DIAGNOSTIC] - index: ${index}`);
                  logger.info(`[GSC-DATE-DIAGNOSTIC] - row.keys: ${JSON.stringify(row.keys)}`);
                  logger.info(`[GSC-DATE-DIAGNOSTIC] - row.keys.length: ${row.keys?.length}`);
                  logger.info(`[GSC-DATE-DIAGNOSTIC] - startDate fallback: ${startDate}`);
                  
                  if (rawDate && typeof rawDate === 'string') {
                    if (rawDate.length === 8) {
                      // Handle YYYYMMDD format (expected format)
                      const year = rawDate.substring(0, 4);
                      const month = rawDate.substring(4, 6);
                      const day = rawDate.substring(6, 8);
                      data.date = `${year}-${month}-${day}`;
                      logger.info(`[GSC-DATE-DIAGNOSTIC] ✅ SUCCESS: Converted YYYYMMDD ${rawDate} → ${data.date}`);
                    } else if (rawDate.length === 10 && rawDate.includes('-')) {
                      // Handle YYYY-MM-DD format (actual GSC API format)
                      data.date = rawDate;
                      logger.info(`[GSC-DATE-DIAGNOSTIC] ✅ SUCCESS: Using YYYY-MM-DD format directly: ${data.date}`);
                    } else {
                      logger.error(`[GSC-DATE-DIAGNOSTIC] ❌ FAILED: Unrecognized date format`);
                      logger.error(`[GSC-DATE-DIAGNOSTIC] - rawDate value: ${JSON.stringify(rawDate)}`);
                      logger.error(`[GSC-DATE-DIAGNOSTIC] - rawDate length: ${rawDate?.length}`);
                      logger.error(`[GSC-DATE-DIAGNOSTIC] - Using fallback: ${startDate}`);
                      data.date = startDate; // Fallback to start date
                    }
                  } else {
                    logger.error(`[GSC-DATE-DIAGNOSTIC] ❌ FAILED: Invalid date (null/undefined/non-string)`);
                    logger.error(`[GSC-DATE-DIAGNOSTIC] - rawDate: ${JSON.stringify(rawDate)} (type: ${typeof rawDate})`);
                    logger.error(`[GSC-DATE-DIAGNOSTIC] - Using fallback: ${startDate}`);
                    data.date = startDate; // Fallback to start date
                  }
                  break;
              }
            });
          }

          return data;
        });

        allData.push(...batchData);

        // Check if we got less data than requested (indicates we've reached the end)
        if (response.data.rows.length < rowLimit) {
          hasMoreData = false;
        } else {
          startRow += rowLimit;
        }

        // Log progress for large datasets
        if (allData.length > rowLimit) {
          logger.info(`[GSC] Fetched ${allData.length} rows so far for dimensions: [${dimensions.join(", ")}]`);
        }
      }

      logger.info(`[GSC] Completed fetching ${allData.length} total rows for dimensions: [${dimensions.join(", ")}]`);
      return allData;
    } catch (error) {
      logger.error("Error fetching performance data:", error);
      throw new Error(
        `Failed to get performance data: ${(error as Error).message}`
      );
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

      const analyticsData = performanceData.map((data) => ({
        integrationId,
        date: new Date(data.date),
        source: "search_console",
        query: data.query || null,
        page: data.page || null,
        impressions: data.impressions,
        clicks: data.clicks,
        ctr: data.ctr,
        position: data.position,
        deviceType: data.device || null,
        country: data.country || null,
        searchVolume: null, // GSC doesn't provide search volume
        attribution: null,
      }));

      // Use createMany for bulk insert, handling duplicates gracefully
      await prisma.analyticsData.createMany({
        data: analyticsData as any,
        skipDuplicates: true,
      });

      logger.info(
        `Stored ${analyticsData.length} analytics data points for integration ${integrationId}`
      );
    } catch (error) {
      logger.error("Error storing performance data:", error);
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
        include: { company: true },
      });

      if (!integration || integration.status !== "active") {
        throw new Error("Integration not found or not active");
      }

      if (!integration.accessToken || !integration.gscPropertyUrl) {
        throw new Error("Missing access token or property URL");
      }

      // Calculate date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const formatDate = (date: Date) => date.toISOString().split("T")[0];

      // Fetch performance data
      const performanceData = await this.getPerformanceData(
        integration.accessToken,
        integration.gscPropertyUrl,
        formatDate(startDate),
        formatDate(endDate),
        ["query", "page", "device", "country"]
      );

      // Store the data
      await this.storePerformanceData(integrationId, performanceData);

      // Update last sync timestamp
      await prisma.analyticsIntegration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date() },
      });

      logger.info(`Successfully synced data for integration ${integrationId}`);
    } catch (error) {
      logger.error(`Error syncing integration ${integrationId}:`, error);
      throw error;
    }
  }

  /**
   * Get summary metrics from GSC (real-time API calls like GA4)
   */
  async getSummaryMetrics(
    accessToken: string,
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<{
    totalClicks: number;
    totalImpressions: number;
    averageCtr: number;
    averagePosition: number;
    totalQueries: number;
    topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
    topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>;
    deviceBreakdown: Array<{ device: string; clicks: number; impressions: number; ctr: number; position: number }>;
    countryBreakdown: Array<{ country: string; clicks: number; impressions: number; ctr: number; position: number }>;
    timeSeriesData: Array<{ date: string; clicks: number; impressions: number; ctr: number; position: number }>;
  }> {
    try {
      logger.info(`[GSC] getSummaryMetrics called with siteUrl=${siteUrl}, dateRange=${startDate} to ${endDate}`);

      // Get overall summary data - no dimensions for site-wide totals
      const summaryData = await this.getPerformanceData(
        accessToken,
        siteUrl,
        startDate,
        endDate,
        [] // Empty dimensions returns site-wide aggregated totals
      );

      // Get top queries
      const topQueries = await this.getPerformanceData(
        accessToken,
        siteUrl,
        startDate,
        endDate,
        ["query"]
      );

      // Get top pages
      const topPages = await this.getPerformanceData(
        accessToken,
        siteUrl,
        startDate,
        endDate,
        ["page"]
      );

      // Get device breakdown
      const deviceBreakdown = await this.getPerformanceData(
        accessToken,
        siteUrl,
        startDate,
        endDate,
        ["device"]
      );

      // Get country breakdown
      const countryBreakdown = await this.getPerformanceData(
        accessToken,
        siteUrl,
        startDate,
        endDate,
        ["country"]
      );

      // Get time series data with enhanced parameters
      logger.info(`[GSC] Fetching time series data with enhanced API parameters: ${startDate} to ${endDate}`);
      const rawTimeSeriesData = await this.getPerformanceData(
        accessToken,
        siteUrl,
        startDate,
        endDate,
        ["date"]
      );

      // EXPERIMENTAL: Try alternative query approach for better data completeness
      logger.info(`[GSC-EXPERIMENTAL] Testing alternative API query for impression-only data`);
      try {
        // Attempt query with different aggregation approach
        const alternativeTimeSeriesData = await this.getPerformanceData(
          accessToken,
          siteUrl,
          startDate,
          endDate,
          ["date"],
          [] // No filters to get maximum data
        );
        
        const alternativeUniqueDates = [...new Set(alternativeTimeSeriesData.map(row => row.date))];
        logger.info(`[GSC-EXPERIMENTAL] Alternative query returned ${alternativeTimeSeriesData.length} rows with ${alternativeUniqueDates.length} unique dates`);
        
        if (alternativeTimeSeriesData.length > rawTimeSeriesData.length) {
          logger.info(`[GSC-EXPERIMENTAL] ✅ Alternative query found ${alternativeTimeSeriesData.length - rawTimeSeriesData.length} additional rows`);
          // TODO: Consider merging or using alternative data if significantly better
        } else {
          logger.info(`[GSC-EXPERIMENTAL] ✅ Primary query already returned optimal data`);
        }
      } catch (error) {
        logger.warn(`[GSC-EXPERIMENTAL] Alternative query failed:`, error);
      }

      // FINAL DATA FLOW DIAGNOSTIC
      const uniqueDates = [...new Set(rawTimeSeriesData.map(row => row.date))];
      logger.info(`[GSC-FINAL-DIAGNOSTIC] ===== TIME SERIES DATA ANALYSIS =====`);
      logger.info(`[GSC-FINAL-DIAGNOSTIC] Raw time series data: ${rawTimeSeriesData.length} rows`);
      logger.info(`[GSC-FINAL-DIAGNOSTIC] Unique dates found: [${uniqueDates.join(", ")}]`);
      logger.info(`[GSC-FINAL-DIAGNOSTIC] Total unique dates: ${uniqueDates.length}`);
      
      if (rawTimeSeriesData.length > 0) {
        logger.info(`[GSC-FINAL-DIAGNOSTIC] First 5 processed rows:`, rawTimeSeriesData.slice(0, 5).map((row, i) => ({
          index: i,
          date: row.date,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position
        })));
      }
      
      if (uniqueDates.length === 1) {
        logger.error(`[GSC-FINAL-DIAGNOSTIC] ❌ CRITICAL ISSUE: All rows have the same date (${uniqueDates[0]})`);
        logger.error(`[GSC-FINAL-DIAGNOSTIC] This means date processing failed for all rows`);
      } else {
        logger.info(`[GSC-FINAL-DIAGNOSTIC] ✅ SUCCESS: Found ${uniqueDates.length} different dates`);
      }
      logger.info(`[GSC-FINAL-DIAGNOSTIC] ===== END TIME SERIES ANALYSIS =====`);
      
      // ===== NEW DATE GAP FILLING IMPLEMENTATION =====
      logger.info(`[GSC-GAP-FILLING] Starting date gap filling process`);
      
      // Generate complete expected date range
      const expectedDates = generateDateRange(startDate, endDate);
      logger.info(`[GSC-GAP-FILLING] Expected ${expectedDates.length} dates from ${startDate} to ${endDate}`);
      logger.info(`[GSC-GAP-FILLING] API returned ${rawTimeSeriesData.length} rows with ${uniqueDates.length} unique dates`);
      
      // Fill missing dates with appropriate zero values
      const timeSeriesData = fillMissingDates(rawTimeSeriesData, expectedDates);
      
      // Log the gap filling results
      const filledDatesCount = timeSeriesData.length - rawTimeSeriesData.length;
      if (filledDatesCount > 0) {
        logger.info(`[GSC-GAP-FILLING] ✅ Filled ${filledDatesCount} missing dates with zero values`);
        logger.info(`[GSC-GAP-FILLING] Complete time series: ${timeSeriesData.length} total dates`);
      } else {
        logger.info(`[GSC-GAP-FILLING] ✅ No date gaps found - API returned complete data`);
      }
      
      // Enhanced diagnostic information
      if (uniqueDates.length <= 1 && rawTimeSeriesData.length > 0) {
        logger.warn(`[GSC-GAP-FILLING] API returned sparse data (${uniqueDates.length} unique dates). Common causes:`);
        logger.warn(`[GSC-GAP-FILLING] 1. Site has limited search visibility for date range`);
        logger.warn(`[GSC-GAP-FILLING] 2. Date range too recent (GSC has 2-3 day processing delay)`);
        logger.warn(`[GSC-GAP-FILLING] 3. Site is new or has very low search traffic`);
        logger.warn(`[GSC-GAP-FILLING] 4. Missing dates filled with zeros for complete visualization`);
      } else if (rawTimeSeriesData.length === 0) {
        logger.warn(`[GSC-GAP-FILLING] No time series data from API - all dates filled with zeros`);
        logger.warn(`[GSC-GAP-FILLING] This means site had no search visibility during ${startDate} to ${endDate}`);
      } else {
        logger.info(`[GSC-GAP-FILLING] Successfully processed ${timeSeriesData.length} complete time series entries`);
      }

      // Calculate totals from summary data
      const totalClicks = summaryData.reduce((sum, row) => sum + row.clicks, 0);
      const totalImpressions = summaryData.reduce((sum, row) => sum + row.impressions, 0);
      const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averagePosition = summaryData.length > 0 && totalImpressions > 0
        ? summaryData.reduce((sum, row) => sum + (row.position * row.impressions), 0) / totalImpressions 
        : 0;

      // Data validation and quality checks
      const dataValidation = {
        summaryRows: summaryData.length,
        topQueriesRows: topQueries.length,
        topPagesRows: topPages.length,
        deviceRows: deviceBreakdown.length,
        countryRows: countryBreakdown.length,
        timeSeriesRows: timeSeriesData.length,
        ctrValid: totalCtr >= 0 && totalCtr <= 100,
        positionValid: averagePosition >= 0,
        hasClicks: totalClicks > 0,
        hasImpressions: totalImpressions > 0
      };

      logger.info(`[GSC] Data validation summary:`, dataValidation);
      logger.info(`[GSC] Processed summary: ${totalClicks} clicks, ${totalImpressions} impressions, ${totalCtr.toFixed(2)}% CTR, ${averagePosition.toFixed(1)} avg position`);
      logger.info(`[GSC] Time series: ${timeSeriesData.length} data points`);

      // Warn about potential data completeness issues
      if (topQueries.length === 25000) {
        logger.warn(`[GSC] Top queries hit row limit - may be incomplete data`);
      }
      if (topPages.length === 25000) {
        logger.warn(`[GSC] Top pages hit row limit - may be incomplete data`);
      }
      if (timeSeriesData.length === 0) {
        logger.warn(`[GSC] No time series data returned - check date range and property access`);
      }

      return {
        totalClicks,
        totalImpressions,
        averageCtr: totalCtr,
        averagePosition,
        totalQueries: topQueries.length, // Total number of unique queries that generated impressions
        topQueries: topQueries.slice(0, 10).map(row => ({
          query: row.query || "Unknown",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr, // GSC API returns CTR as percentage already (0-100)
          position: row.position
        })),
        topPages: topPages.slice(0, 10).map(row => ({
          page: row.page || "Unknown",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr, // GSC API returns CTR as percentage already (0-100)
          position: row.position
        })),
        deviceBreakdown: deviceBreakdown.slice(0, 5).map(row => ({
          device: row.device || "Unknown",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr, // GSC API returns CTR as percentage already (0-100)
          position: row.position
        })),
        countryBreakdown: countryBreakdown.slice(0, 10).map(row => ({
          country: row.country || "Unknown",
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr, // GSC API returns CTR as percentage already (0-100)
          position: row.position
        })),
        timeSeriesData: timeSeriesData.map(row => ({
          date: row.date,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr, // GSC API returns CTR as percentage already (0-100)
          position: row.position
        }))
      };
    } catch (error) {
      logger.error("[GSC] Error fetching summary metrics:", error);
      
      // Return safe defaults but log that we're doing so
      logger.warn("[GSC] Returning empty metrics due to error - dashboard will show no data");
      return {
        totalClicks: 0,
        totalImpressions: 0,
        averageCtr: 0,
        averagePosition: 0,
        totalQueries: 0,
        topQueries: [],
        topPages: [],
        deviceBreakdown: [],
        countryBreakdown: [],
        timeSeriesData: []
      };
    }
  }

  /**
   * Validate Search Console access for a property
   */
  async validatePropertyAccess(
    accessToken: string,
    siteUrl: string
  ): Promise<boolean> {
    try {
      const properties = await this.getProperties(accessToken);
      return properties.some(
        (prop) =>
          prop.siteUrl === siteUrl &&
          ["siteOwner", "siteFullUser", "siteRestrictedUser"].includes(
            prop.permissionLevel
          )
      );
    } catch (error) {
      logger.error("Error validating property access:", error);
      return false;
    }
  }
}

export const googleSearchConsoleService = new GoogleSearchConsoleService();
export default googleSearchConsoleService;
