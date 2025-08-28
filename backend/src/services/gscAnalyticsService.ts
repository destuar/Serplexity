/**
 * @file gscAnalyticsService.ts
 * @description Google Search Console analytics data aggregation service
 *
 * This service handles:
 * - Aggregating GSC data from GscDailyMetrics table
 * - Formatting data for dashboard consumption
 * - Time series data for charts
 * - Summary metrics calculation
 */

import { dbCache } from "../config/dbCache";
import logger from "../utils/logger";

export interface GscSummaryMetrics {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  totalQueries: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  deviceBreakdown: Array<{
    device: string;
    clicks: number;
    impressions: number;
    ctr: number;
  }>;
  countryBreakdown: Array<{
    country: string;
    clicks: number;
    impressions: number;
    ctr: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

class GscAnalyticsService {
  /**
   * Get GSC summary metrics for a company within a date range
   */
  async getGscSummaryMetrics(
    companyId: string,
    startDate: string,
    endDate: string
  ): Promise<GscSummaryMetrics> {
    try {
      logger.info(`[GSC Analytics] Getting summary metrics for company ${companyId}, dateRange=${startDate} to ${endDate}`);
      
      const prisma = await dbCache.getPrimaryClient();

      // Fetch all GSC data for the date range
      const gscData = await prisma.gscDailyMetrics.findMany({
        where: {
          companyId,
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        orderBy: { date: "desc" },
      });

      if (gscData.length === 0) {
        logger.warn(`[GSC Analytics] No data found for company ${companyId} in date range ${startDate} to ${endDate}`);
        return this.getEmptyMetrics();
      }

      // Calculate summary metrics
      const totalClicks = gscData.reduce((sum, row) => sum + (row.clicks || 0), 0);
      const totalImpressions = gscData.reduce((sum, row) => sum + (row.impressions || 0), 0);
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      // Calculate weighted average position
      const weightedPositionSum = gscData.reduce(
        (sum, row) => sum + (row.position || 0) * (row.impressions || 0),
        0
      );
      const averagePosition = totalImpressions > 0 ? weightedPositionSum / totalImpressions : 0;

      // Get unique queries count
      const uniqueQueries = new Set(gscData.map((row) => row.query).filter(Boolean));
      const totalQueries = uniqueQueries.size;

      // Aggregate top queries
      const queryStats = new Map<string, {
        query: string;
        clicks: number;
        impressions: number;
        totalPosition: number;
        impressionCount: number;
      }>();

      gscData.forEach((row) => {
        if (row.query) {
          const existing = queryStats.get(row.query) || {
            query: row.query,
            clicks: 0,
            impressions: 0,
            totalPosition: 0,
            impressionCount: 0,
          };
          existing.clicks += row.clicks || 0;
          existing.impressions += row.impressions || 0;
          existing.totalPosition += (row.position || 0) * (row.impressions || 0);
          existing.impressionCount += row.impressions || 0;
          queryStats.set(row.query, existing);
        }
      });

      const topQueries = Array.from(queryStats.values())
        .map((stat) => ({
          query: stat.query,
          clicks: stat.clicks,
          impressions: stat.impressions,
          ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
          position: stat.impressionCount > 0 ? stat.totalPosition / stat.impressionCount : 0,
        }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 10);

      // Aggregate top pages
      const pageStats = new Map<string, {
        page: string;
        clicks: number;
        impressions: number;
        totalPosition: number;
        impressionCount: number;
      }>();

      gscData.forEach((row) => {
        if (row.page) {
          const existing = pageStats.get(row.page) || {
            page: row.page,
            clicks: 0,
            impressions: 0,
            totalPosition: 0,
            impressionCount: 0,
          };
          existing.clicks += row.clicks || 0;
          existing.impressions += row.impressions || 0;
          existing.totalPosition += (row.position || 0) * (row.impressions || 0);
          existing.impressionCount += row.impressions || 0;
          pageStats.set(row.page, existing);
        }
      });

      const topPages = Array.from(pageStats.values())
        .map((stat) => ({
          page: stat.page,
          clicks: stat.clicks,
          impressions: stat.impressions,
          ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
          position: stat.impressionCount > 0 ? stat.totalPosition / stat.impressionCount : 0,
        }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 10);

      // Device breakdown
      const deviceStats = new Map<string, {
        device: string;
        clicks: number;
        impressions: number;
      }>();

      gscData.forEach((row) => {
        if (row.device) {
          const existing = deviceStats.get(row.device) || {
            device: row.device,
            clicks: 0,
            impressions: 0,
          };
          existing.clicks += row.clicks || 0;
          existing.impressions += row.impressions || 0;
          deviceStats.set(row.device, existing);
        }
      });

      const deviceBreakdown = Array.from(deviceStats.values()).map((stat) => ({
        device: stat.device,
        clicks: stat.clicks,
        impressions: stat.impressions,
        ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
      }));

      // Country breakdown
      const countryStats = new Map<string, {
        country: string;
        clicks: number;
        impressions: number;
      }>();

      gscData.forEach((row) => {
        if (row.country) {
          const existing = countryStats.get(row.country) || {
            country: row.country,
            clicks: 0,
            impressions: 0,
          };
          existing.clicks += row.clicks || 0;
          existing.impressions += row.impressions || 0;
          countryStats.set(row.country, existing);
        }
      });

      const countryBreakdown = Array.from(countryStats.values())
        .map((stat) => ({
          country: stat.country,
          clicks: stat.clicks,
          impressions: stat.impressions,
          ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
        }))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 10);

      // Time series data (performance over time)
      const dateStats = new Map<string, {
        date: string;
        clicks: number;
        impressions: number;
        totalPosition: number;
        impressionCount: number;
      }>();

      gscData.forEach((row) => {
        const dateKey = row.date.toISOString().split("T")[0];
        const existing = dateStats.get(dateKey) || {
          date: dateKey,
          clicks: 0,
          impressions: 0,
          totalPosition: 0,
          impressionCount: 0,
        };
        existing.clicks += row.clicks || 0;
        existing.impressions += row.impressions || 0;
        existing.totalPosition += (row.position || 0) * (row.impressions || 0);
        existing.impressionCount += row.impressions || 0;
        dateStats.set(dateKey, existing);
      });

      const timeSeriesData = Array.from(dateStats.values())
        .map((stat) => ({
          date: stat.date,
          clicks: stat.clicks,
          impressions: stat.impressions,
          ctr: stat.impressions > 0 ? (stat.clicks / stat.impressions) * 100 : 0,
          position: stat.impressionCount > 0 ? stat.totalPosition / stat.impressionCount : 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      logger.info(`[GSC Analytics] Processed ${gscData.length} rows into summary metrics`);

      return {
        totalClicks,
        totalImpressions,
        averageCtr,
        averagePosition,
        totalQueries,
        topQueries,
        topPages,
        deviceBreakdown,
        countryBreakdown,
        timeSeriesData,
      };
    } catch (error) {
      logger.error("[GSC Analytics] Error getting summary metrics:", error);
      
      // Return empty metrics on error
      logger.warn("[GSC Analytics] Returning empty metrics due to error");
      return this.getEmptyMetrics();
    }
  }

  /**
   * Get empty metrics structure for error cases or no data
   */
  private getEmptyMetrics(): GscSummaryMetrics {
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
      timeSeriesData: [],
    };
  }

  /**
   * Validate GSC integration exists and is active for a company
   */
  async validateGscIntegration(companyId: string): Promise<{
    isValid: boolean;
    integration?: any;
    error?: string;
  }> {
    try {
      const prisma = await dbCache.getPrimaryClient();
      
      const gscIntegration = await prisma.analyticsIntegration.findFirst({
        where: {
          companyId,
          integrationName: "google_search_console",
          status: "active",
        },
      });

      if (!gscIntegration) {
        return {
          isValid: false,
          error: "No active GSC integration found. Please connect Google Search Console.",
        };
      }

      return {
        isValid: true,
        integration: gscIntegration,
      };
    } catch (error) {
      logger.error("[GSC Analytics] Error validating GSC integration:", error);
      return {
        isValid: false,
        error: "Failed to validate GSC integration",
      };
    }
  }
}

export const gscAnalyticsService = new GscAnalyticsService();
export default gscAnalyticsService;