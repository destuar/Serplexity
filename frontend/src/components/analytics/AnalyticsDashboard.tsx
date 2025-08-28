/**
 * @file AnalyticsDashboard.tsx
 * @description Minimal analytics dashboard matching Serplexity's tech-forward design system
 */

import React, { useCallback, useEffect, useState } from "react";

interface AnalyticsData {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
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
}

interface Integration {
  id: string;
  integrationName: string;
  status: string;
  gscPropertyUrl?: string;
  createdAt: string;
}

const AnalyticsDashboard: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("7d");

  // Helper function to convert period to date range
  const convertPeriodToDateRange = (period: string): { startDate: string; endDate: string } => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "28d":
        startDate.setDate(startDate.getDate() - 28);
        break;
      case "90d":
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    };
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Determine which integration type is active
      const gscIntegration = integrations.find(
        (i) => i.integrationName === "google_search_console" && i.status === "active"
      );
      const ga4Integration = integrations.find(
        (i) => i.integrationName === "google_analytics_4" && i.status === "active"
      );

      let response: Response;
      
      if (gscIntegration) {
        // Use GSC-specific endpoint with date range conversion
        const { startDate, endDate } = convertPeriodToDateRange(selectedPeriod);
        response = await fetch(
          `/api/website-analytics/gsc/metrics?startDate=${startDate}&endDate=${endDate}`
        );
      } else if (ga4Integration) {
        // Use GA4-specific endpoint with date range conversion
        const { startDate, endDate } = convertPeriodToDateRange(selectedPeriod);
        response = await fetch(
          `/api/website-analytics/ga4/metrics?startDate=${startDate}&endDate=${endDate}`
        );
      } else {
        // Fallback to generic endpoint for other integration types
        response = await fetch(
          `/api/website-analytics/metrics?period=${selectedPeriod}`
        );
      }
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data.metrics || data);
      } else {
        throw new Error("Failed to fetch analytics data");
      }
    } catch (err) {
      console.error("Failed to fetch analytics data:", err);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, integrations]);

  useEffect(() => {
    if (integrations.length > 0) {
      void fetchAnalyticsData();
    }
  }, [integrations, selectedPeriod, fetchAnalyticsData]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/website-analytics/integrations");
      if (response.ok) {
        const data = await response.json();
        setIntegrations(data);
      }
    } catch (err) {
      console.error("Failed to fetch integrations:", err);
      setError("Failed to load integrations");
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return (num * 100).toFixed(1) + "%";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-4"
            >
              <div className="animate-pulse">
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-6 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-8 text-center">
        <p className="text-sm text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-8 text-center">
        <p className="text-sm text-gray-600">
          Analytics data will appear once your integration starts collecting
          data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {integrations.length} integration
          {integrations.length !== 1 ? "s" : ""} active
        </div>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="px-3 py-1 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-xs focus:outline-none focus:ring-2 focus:ring-black transition-colors"
        >
          <option value="7d">Last 7 days</option>
          <option value="28d">Last 28 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-4">
          <div className="text-xs text-gray-500 mb-1">Clicks</div>
          <div className="text-lg font-medium text-gray-900">
            {formatNumber(analyticsData.totalClicks)}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-4">
          <div className="text-xs text-gray-500 mb-1">Impressions</div>
          <div className="text-lg font-medium text-gray-900">
            {formatNumber(analyticsData.totalImpressions)}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-4">
          <div className="text-xs text-gray-500 mb-1">CTR</div>
          <div className="text-lg font-medium text-gray-900">
            {formatPercentage(analyticsData.averageCtr / 100)}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-4">
          <div className="text-xs text-gray-500 mb-1">Position</div>
          <div className="text-lg font-medium text-gray-900">
            {analyticsData.averagePosition.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Queries */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md">
          <div className="px-4 py-3 border-b border-white/20">
            <h3 className="text-sm font-medium text-gray-900">Top Queries</h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {analyticsData.topQueries.slice(0, 5).map((query, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-3 items-center text-xs"
                >
                  <div className="text-gray-900 truncate" title={query.query}>
                    {query.query}
                  </div>
                  <div className="text-gray-600 text-right">{query.clicks}</div>
                  <div className="text-gray-600 text-right">
                    {formatPercentage(query.ctr / 100)}
                  </div>
                  <div className="text-gray-600 text-right">
                    {query.position.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Pages */}
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md">
          <div className="px-4 py-3 border-b border-white/20">
            <h3 className="text-sm font-medium text-gray-900">Top Pages</h3>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {analyticsData.topPages.slice(0, 5).map((page, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_3rem_3rem_3rem] gap-3 items-center text-xs"
                >
                  <div className="text-gray-900 truncate" title={page.page}>
                    {page.page}
                  </div>
                  <div className="text-gray-600 text-right">{page.clicks}</div>
                  <div className="text-gray-600 text-right">
                    {formatPercentage(page.ctr / 100)}
                  </div>
                  <div className="text-gray-600 text-right">
                    {page.position.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
