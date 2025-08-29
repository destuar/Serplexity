/**
 * @file SeoRankingsAnalytics.tsx
 * @description SEO Rankings Analytics page displaying comprehensive Google Search Console data
 * Mirrors the GA4 Web Analytics page structure with GSC-specific metrics and visualizations
 * Uses real GSC data from backend APIs - no mock data
 */

import { ArrowRight, Calendar, Settings } from "lucide-react";
import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useCompany } from "../../hooks/useCompany";
import apiClient from "../../lib/apiClient";
import FilterDropdown from "../dashboard/FilterDropdown";
import { InlineSpinner } from "../ui/InlineSpinner";

interface SeoAnalyticsMetrics {
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

// Chart is lazy-loaded to reduce initial bundle size
const SeoRankingsChart = React.lazy(
  () => import("../charts/SeoRankingsChartImpl")
);

interface SeoRankingsAnalyticsProps {
  onManageIntegrations: () => void;
}

const SeoRankingsAnalytics: React.FC<SeoRankingsAnalyticsProps> = ({
  onManageIntegrations,
}) => {
  const { selectedCompany } = useCompany();
  const [metrics, setMetrics] = useState<SeoAnalyticsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    dateRange: "30d",
    refreshTrigger: 0,
  });

  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "clicks",
    "impressions",
  ]);

  const dateRangeOptions = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "1y", label: "Last year" },
  ];

  const fetchMetrics = useCallback(async () => {
    try {
      setRefreshing(true);
      setIsLoading(true);
      setError(null);

      // GSC data has 2-3 day delay, so use yesterday as end date to ensure data availability
      const now = new Date();
      const endDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago to account for GSC delay

      const daysMap: { [key: string]: number } = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
      };
      const days = daysMap[filters.dateRange] || 30;
      const startDate = new Date(
        endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000
      ); // Adjust start date accordingly

      const params = new URLSearchParams({
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      });

      // Fetch GSC metrics from real API
      console.log(
        "[SeoAnalytics] Fetching GSC data with params:",
        params.toString()
      );
      const res = await apiClient.get(
        `/website-analytics/gsc/metrics?${params.toString()}`
      );
      console.log("[SeoAnalytics] Raw API response:", res.data);
      const gscData = res.data.metrics;

      // Debug: Log the raw GSC response
      console.log("[SeoAnalytics] Raw GSC response:", {
        hasData: !!gscData,
        timeSeriesLength: gscData?.timeSeriesData?.length || 0,
        summaryMetrics: {
          totalClicks: gscData?.totalClicks,
          totalImpressions: gscData?.totalImpressions,
          averageCtr: gscData?.averageCtr,
          averagePosition: gscData?.averagePosition,
        },
      });

      // Debug: Log first few time series entries
      if (gscData?.timeSeriesData?.length > 0) {
        console.log(
          "[SeoAnalytics] First 3 time series entries:",
          gscData.timeSeriesData.slice(0, 3)
        );
      }

      // Convert real GSC data to chart format - use real data only with date validation
      const timeSeriesData = (gscData?.timeSeriesData || [])
        .filter((dayData) => {
          // Validate date format and that it's a valid date
          if (!dayData.date) {
            console.warn(
              "[SeoAnalytics] Filtering out entry with no date:",
              dayData
            );
            return false;
          }
          const testDate = new Date(dayData.date);
          const isValid = !isNaN(testDate.getTime());
          if (!isValid) {
            console.warn(
              "[SeoAnalytics] Filtering out entry with invalid date:",
              dayData.date
            );
          }
          return isValid;
        })
        .map((dayData) => ({
          date: dayData.date,
          clicks: dayData.clicks || 0,
          impressions: dayData.impressions || 0,
          ctr: dayData.ctr || 0,
          position: dayData.position || 0,
        }));

      // Debug: Log processed time series data
      console.log("[SeoAnalytics] Processed timeSeriesData:", {
        length: timeSeriesData.length,
        firstEntry: timeSeriesData[0],
        lastEntry: timeSeriesData[timeSeriesData.length - 1],
      });

      const enhancedMetrics: SeoAnalyticsMetrics = {
        totalClicks: gscData?.totalClicks || 0,
        totalImpressions: gscData?.totalImpressions || 0,
        averageCtr: gscData?.averageCtr || 0,
        averagePosition: gscData?.averagePosition || 0,
        totalQueries: gscData?.totalQueries || 0,
        topQueries: gscData?.topQueries || [],
        topPages: gscData?.topPages || [],
        deviceBreakdown: gscData?.deviceBreakdown || [],
        countryBreakdown: gscData?.countryBreakdown || [],
        timeSeriesData: timeSeriesData,
      };

      // Check if we got empty data
      if (
        enhancedMetrics.totalClicks === 0 &&
        enhancedMetrics.totalImpressions === 0 &&
        enhancedMetrics.timeSeriesData.length === 0
      ) {
        console.log(
          "[SeoAnalytics] Got empty GSC data - no clicks, impressions, or time series data"
        );
        setMetrics(null); // Treat empty data as no data to show proper empty state
      } else {
        setMetrics(enhancedMetrics);
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { error?: string; message?: string } };
        message?: string;
      };
      console.error("Failed to fetch GSC metrics:", err);
      console.error("Error response:", err.response?.data);

      // Show more specific error message
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Unable to load SEO analytics data. Please check your Google Search Console integration.";
      setError(errorMessage);
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  }, [filters.dateRange]);

  useEffect(() => {
    if (selectedCompany) {
      fetchMetrics();
    }
  }, [selectedCompany, fetchMetrics, filters.refreshTrigger]);

  const handleFilterChange = (filterUpdates: { [key: string]: string }) => {
    setFilters((prev) => ({ ...prev, ...filterUpdates }));
  };

  // Refresh button removed per design; data reload can be triggered by changing filters

  const handleMetricToggle = (metricKey: string) => {
    if (selectedMetrics.includes(metricKey)) {
      // Allow deselecting even if it's the only one selected (0 minimum)
      setSelectedMetrics(selectedMetrics.filter((m) => m !== metricKey));
    } else {
      // Only allow selecting if we have less than 2 metrics selected (max 2)
      if (selectedMetrics.length < 2) {
        setSelectedMetrics([...selectedMetrics, metricKey]);
      }
    }
  };

  // value formatting moved into chart impl

  const formatMetricDisplay = (value: number, metricKey: string) => {
    if (metricKey === "ctr") return `${value.toFixed(2)}%`;
    if (metricKey === "position") return value.toFixed(2);
    if (metricKey === "totalQueries" && value === 0) return "-";
    return value.toLocaleString();
  };

  if (isLoading || !selectedCompany) {
    return (
      <div className="h-full flex items-center justify-center">
        <InlineSpinner size={20} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Header with filters - following WebAnalyticsPage pattern */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
        <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto">
          <FilterDropdown
            label="Date Range"
            value={filters.dateRange}
            options={dateRangeOptions}
            onChange={(value) =>
              handleFilterChange({ dateRange: value as string })
            }
            icon={Calendar}
            disabled={isLoading || refreshing}
          />

          {/* Refresh button removed from header per requirement */}

          <button
            onClick={onManageIntegrations}
            className="flex items-center justify-center w-full lg:w-auto gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md transition-colors text-sm font-medium hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black"
          >
            <Settings size={16} />
            <span className="whitespace-nowrap">Manage</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-8 text-center">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                refreshTrigger: prev.refreshTrigger + 1,
              }))
            }
            className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm font-medium hover:bg-white/85"
          >
            Retry
          </button>
        </div>
      ) : !metrics ? (
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-8 text-center">
          <p className="text-sm text-gray-600 mb-4">
            SEO data will appear once your Google Search Console integration is
            active and has collected data.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Google Search Console data may take 24-48 hours to appear after
            connecting your property. Data collection starts from the connection
            date forward.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm font-medium hover:bg-white/85"
          >
            Check Again
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-4">
          {/* Integrated Chart Container with Key Metrics */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md flex-1 flex flex-col">
            {/* Title */}
            <div className="px-4 py-2 border-b border-white/20">
              <h3 className="text-sm font-medium text-gray-900">
                SEO Performance Over Time
              </h3>
            </div>

            {/* Key Metrics Grid - showing all GSC metrics with click-to-select functionality */}
            <div className="px-4 py-2 border-b border-white/20">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard
                  label="Total Clicks"
                  value={formatMetricDisplay(metrics.totalClicks, "clicks")}
                  isSelected={selectedMetrics.includes("clicks")}
                  onClick={() => handleMetricToggle("clicks")}
                  metricKey="clicks"
                />
                <MetricCard
                  label="Total Impressions"
                  value={formatMetricDisplay(
                    metrics.totalImpressions,
                    "impressions"
                  )}
                  isSelected={selectedMetrics.includes("impressions")}
                  onClick={() => handleMetricToggle("impressions")}
                  metricKey="impressions"
                />
                <MetricCard
                  label="Avg CTR"
                  value={formatMetricDisplay(metrics.averageCtr, "ctr")}
                  isSelected={selectedMetrics.includes("ctr")}
                  onClick={() => handleMetricToggle("ctr")}
                  metricKey="ctr"
                />
                <MetricCard
                  label="Avg Position"
                  value={formatMetricDisplay(
                    metrics.averagePosition,
                    "position"
                  )}
                  isSelected={selectedMetrics.includes("position")}
                  onClick={() => handleMetricToggle("position")}
                  metricKey="position"
                />
                <MetricCard
                  label="Total Queries"
                  value={formatMetricDisplay(
                    metrics.totalQueries,
                    "totalQueries"
                  )}
                  showArrow={true}
                />
                <MetricCard
                  label="Top Country"
                  value={
                    metrics.countryBreakdown[0]?.country?.toUpperCase() || "-"
                  }
                  showArrow={true}
                />
              </div>
            </div>

            {/* Chart Area */}
            <div
              className="flex-1 min-h-0 relative"
              style={{ minHeight: "300px" }}
            >
              {selectedMetrics.length === 0 ? (
                <div
                  className="h-full flex items-center justify-center text-gray-500 text-sm"
                  style={{ marginTop: "120px" }}
                >
                  Select metrics above to display chart
                </div>
              ) : metrics.timeSeriesData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  No time series data available - check integration status
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                      Loading chart…
                    </div>
                  }
                >
                  <SeoRankingsChart
                    timeSeriesData={metrics.timeSeriesData}
                    selectedMetrics={selectedMetrics}
                  />
                </Suspense>
              )}
            </div>
          </div>

          {/* Bottom Section - Top Queries and Top Pages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Queries */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md flex flex-col h-full max-h-56">
              <div className="px-4 py-2 border-b border-white/20 flex-shrink-0">
                <div className="grid grid-cols-[1fr_4rem_3rem_4rem] gap-3 items-center">
                  <h3 className="text-sm font-medium text-gray-900">
                    Top Queries
                  </h3>
                  <div className="text-right text-xs font-medium text-gray-500">
                    Clicks
                  </div>
                  <div className="text-right text-xs font-medium text-gray-500">
                    CTR
                  </div>
                  <div className="text-right text-xs font-medium text-gray-500">
                    Position
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-3">
                {metrics.topQueries && metrics.topQueries.length > 0 ? (
                  <div className="space-y-2">
                    {metrics.topQueries.slice(0, 10).map((query, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_4rem_3rem_4rem] gap-3 items-center text-xs"
                      >
                        <div
                          className="text-gray-900 truncate"
                          title={query.query}
                        >
                          {query.query}
                        </div>
                        <div className="text-gray-600 text-right">
                          {query.clicks.toLocaleString()}
                        </div>
                        <div className="text-gray-600 text-right">
                          {query.ctr.toFixed(1)}%
                        </div>
                        <div className="text-gray-600 text-right">
                          {query.position.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-500 py-8">
                    No query data available
                  </div>
                )}
              </div>
              <div className="px-4 py-1 border-t border-white/20 flex-shrink-0 bg-white/40 backdrop-blur-sm"></div>
            </div>

            {/* Top Pages */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md flex flex-col h-full max-h-56">
              <div className="px-4 py-2 border-b border-white/20 flex-shrink-0">
                <div className="grid grid-cols-[1fr_4rem_3rem_4rem] gap-3 items-center">
                  <h3 className="text-sm font-medium text-gray-900">
                    Top Pages
                  </h3>
                  <div className="text-right text-xs font-medium text-gray-500">
                    Clicks
                  </div>
                  <div className="text-right text-xs font-medium text-gray-500">
                    CTR
                  </div>
                  <div className="text-right text-xs font-medium text-gray-500">
                    Position
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-3">
                {metrics.topPages && metrics.topPages.length > 0 ? (
                  <div className="space-y-2">
                    {metrics.topPages.slice(0, 10).map((page, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_4rem_3rem_4rem] gap-3 items-center text-xs"
                      >
                        <div
                          className="text-gray-900 truncate"
                          title={page.page}
                        >
                          {page.page}
                        </div>
                        <div className="text-gray-600 text-right">
                          {page.clicks.toLocaleString()}
                        </div>
                        <div className="text-gray-600 text-right">
                          {page.ctr.toFixed(1)}%
                        </div>
                        <div className="text-gray-600 text-right">
                          {page.position.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-500 py-8">
                    No page data available
                  </div>
                )}
              </div>
              <div className="px-4 py-1 border-t border-white/20 flex-shrink-0 bg-white/40 backdrop-blur-sm"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  isSelected?: boolean;
  onClick?: () => void;
  metricKey?: string;
  showArrow?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  isSelected = false,
  onClick,
  metricKey,
  showArrow = false,
}) => {
  const isClickable = !!onClick && !!metricKey;

  return (
    <div
      className={`
        rounded-lg p-2.5 relative transition-colors
        ${isClickable ? "cursor-pointer" : ""}
        ${
          isSelected
            ? "bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900"
            : "bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500"
        }
        ${isClickable && !isSelected ? "hover:text-gray-700 hover:bg-white/85" : ""}
      `}
      onClick={isClickable ? onClick : undefined}
    >
      <div className="text-xs mb-1">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
      {subtitle && <div className="text-xs">{subtitle}</div>}

      {/* Arrow in bottom right */}
      {showArrow && (
        <div className="absolute bottom-2 right-2">
          <ArrowRight size={14} className="text-gray-400" />
        </div>
      )}
    </div>
  );
};

export default SeoRankingsAnalytics;
