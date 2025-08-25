/**
 * @file WebAnalyticsPage.tsx  
 * @description Web Analytics (GA4) page displaying real analytics data
 * Supports both GA4 OAuth integration and manual tracking snippet
 * Uses only real data from backend APIs - no mock data
 */

import React, { useEffect, useState, useCallback } from "react";
import { Calendar, RefreshCw, Settings, ArrowRight } from "lucide-react";
import IntegrationSetupWizard from "../components/analytics/IntegrationSetupWizard";
import FilterDropdown from "../components/dashboard/FilterDropdown";
import { InlineSpinner } from "../components/ui/InlineSpinner";
import { useNavigation } from "../hooks/useNavigation";
import { useCompany } from "../hooks/useCompany";
import apiClient from "../lib/apiClient";
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WebAnalyticsMetrics {
  sessions: number;
  totalUsers: number;
  screenPageViews: number;
  averageSessionDuration: number;
  bounceRate: number;
  // Revenue metrics - will be 0 if no e-commerce data available
  revenue: number;
  revenuePerVisitor: number;
  conversionRate: number;
  currentVisitors: number;
  timeSeriesData: Array<{
    date: string;
    visitors: number;
    revenue: number;
    sessions: number;
    bounceRate: number;
    conversionRate: number;
    avgSessionDuration: number;
    revenuePerVisitor: number;
    screenPageViews: number;
    avgVisitorsPerDay: number;
  }>;
  topPages: Array<{ pagePath: string; views: number; users: number }>;
  topReferrers: Array<{ source: string; medium: string; sessions: number; users: number }>;
}

interface MetricOption {
  key: string;
  label: string;
  color: string;
  type: 'line' | 'bar';
}


const METRIC_OPTIONS: MetricOption[] = [
  { key: 'visitors', label: 'Visitors', color: '#2563eb', type: 'line' }, // Blue-600
  { key: 'revenue', label: 'Revenue', color: '#60a5fa', type: 'bar' }, // Blue-400 (lighter)
  { key: 'sessions', label: 'Sessions', color: '#3b82f6', type: 'line' }, // Blue-500
  { key: 'bounceRate', label: 'Bounce Rate (%)', color: '#1e40af', type: 'line' }, // Blue-800
  { key: 'conversionRate', label: 'Conversion Rate (%)', color: '#1e3a8a', type: 'line' }, // Blue-900
  { key: 'avgSessionDuration', label: 'Avg Session Duration (s)', color: '#93c5fd', type: 'line' }, // Blue-300 (lighter)
  { key: 'revenuePerVisitor', label: 'Revenue/Visitor', color: '#bfdbfe', type: 'line' }, // Blue-200 (lightest)
  { key: 'screenPageViews', label: 'Page Views', color: '#0ea5e9', type: 'bar' }, // Sky-500
];


const WebAnalyticsPage: React.FC = () => {
  const { setBreadcrumbs } = useNavigation();
  const { selectedCompany } = useCompany();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [hasIntegrations, setHasIntegrations] = useState(false);
  const [metrics, setMetrics] = useState<WebAnalyticsMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    dateRange: '30d',
    refreshTrigger: 0
  });
  
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['visitors', 'revenue']);

  const dateRangeOptions = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "1y", label: "Last year" },
  ];

  useEffect(() => {
    setBreadcrumbs([{ label: "SEO Performance" }, { label: "Web Analytics" }]);
  }, [setBreadcrumbs]);

  const fetchMetrics = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      const now = new Date();
      const daysMap: { [key: string]: number } = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = daysMap[filters.dateRange] || 30;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      const params = new URLSearchParams({
        startDate: startDate.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
      });
      
      // Try to fetch GA4 metrics from real API
      const res = await apiClient.get(`/website-analytics/ga4/metrics?${params.toString()}`);
      const ga4Data = res.data.metrics;
      
      // Fetch real-time active users
      let currentActiveUsers = 0;
      try {
        const activeUsersRes = await apiClient.get('/website-analytics/ga4/active-users');
        currentActiveUsers = activeUsersRes.data.activeUsers || 0;
      } catch (activeUsersError) {
        console.warn('[WebAnalytics] Failed to fetch active users:', activeUsersError);
      }
      
      // Debug: Log the raw GA4 response
      console.log('[WebAnalytics] Raw GA4 response:', {
        hasData: !!ga4Data,
        timeSeriesLength: ga4Data?.timeSeriesData?.length || 0,
        summaryMetrics: {
          sessions: ga4Data?.sessions,
          totalUsers: ga4Data?.totalUsers,
          screenPageViews: ga4Data?.screenPageViews
        }
      });
      
      // Debug: Log first few time series entries
      if (ga4Data?.timeSeriesData?.length > 0) {
        console.log('[WebAnalytics] First 3 time series entries:', ga4Data.timeSeriesData.slice(0, 3));
      }
      
      // Convert real GA4 data to chart format - use real data only with date validation
      const timeSeriesData = (ga4Data?.timeSeriesData || [])
        .filter(dayData => {
          // Validate date format and that it's a valid date
          if (!dayData.date) {
            console.warn('[WebAnalytics] Filtering out entry with no date:', dayData);
            return false;
          }
          const testDate = new Date(dayData.date);
          const isValid = !isNaN(testDate.getTime());
          if (!isValid) {
            console.warn('[WebAnalytics] Filtering out entry with invalid date:', dayData.date);
          }
          return isValid;
        })
        .map(dayData => ({
          date: dayData.date,
          visitors: dayData.totalUsers,
          revenue: 0, // No revenue data without e-commerce tracking
          sessions: dayData.sessions,
          bounceRate: dayData.bounceRate,
          conversionRate: 0, // No conversion data without conversion goals
          avgSessionDuration: Math.round(dayData.averageSessionDuration),
          revenuePerVisitor: 0, // No revenue data without e-commerce tracking
          screenPageViews: dayData.screenPageViews,
          avgVisitorsPerDay: dayData.totalUsers, // Same as visitors for daily data
        }));

      // Debug: Log processed time series data
      console.log('[WebAnalytics] Processed timeSeriesData:', {
        length: timeSeriesData.length,
        firstEntry: timeSeriesData[0],
        lastEntry: timeSeriesData[timeSeriesData.length - 1]
      });

      const enhancedMetrics: WebAnalyticsMetrics = {
        sessions: ga4Data?.sessions || 0,
        totalUsers: ga4Data?.totalUsers || 0,
        screenPageViews: ga4Data?.screenPageViews || 0,
        averageSessionDuration: Math.round(ga4Data?.averageSessionDuration || 0),
        bounceRate: ga4Data?.bounceRate || 0,
        topPages: ga4Data?.topPages || [],
        topReferrers: ga4Data?.topReferrers || [],
        // Revenue metrics - would come from GA4 e-commerce events, show 0 if not available
        revenue: 0, // GA4 e-commerce revenue - not available without enhanced e-commerce setup
        revenuePerVisitor: 0, // Calculated from revenue/users - not available without e-commerce
        conversionRate: 0, // GA4 conversion goals - not available without conversion setup
        currentVisitors: currentActiveUsers, // Real-time active users from GA4 API
        timeSeriesData: timeSeriesData
      };
      
      setMetrics(enhancedMetrics);
    } catch (error) {
      console.error('Failed to fetch GA4 metrics:', error);
      setError('Unable to load analytics data. Please check your GA4 integration.');
    } finally {
      setRefreshing(false);
    }
  }, [filters.dateRange]);

  useEffect(() => {
    const checkIntegrations = async () => {
      if (!selectedCompany) return;
      
      try {
        setIsLoading(true);
        const res = await apiClient.get("/website-analytics/integrations");
        const data = res.data;
        const list = (data as { integrations?: unknown })?.integrations ?? data;
        const hasGa4 = Array.isArray(list)
          ? list.some((i: { integrationName?: string; status?: string }) =>
              i.integrationName === "google_analytics_4" && i.status === "active")
          : false;
        setHasIntegrations(hasGa4);
        if (hasGa4) await fetchMetrics();
      } catch (error) {
        console.error("Failed to check integrations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkIntegrations();
  }, [selectedCompany, filters.dateRange, filters.refreshTrigger, fetchMetrics]);


  const handleFilterChange = (filterUpdates: { [key: string]: string }) => {
    setFilters(prev => ({ ...prev, ...filterUpdates }));
  };

  const handleRefresh = () => {
    setFilters(prev => ({ ...prev, refreshTrigger: prev.refreshTrigger + 1 }));
  };

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    setHasIntegrations(true);
    fetchMetrics();
  };

  const handleMetricToggle = (metricKey: string) => {
    if (selectedMetrics.includes(metricKey)) {
      // Allow deselecting even if it's the only one selected (0 minimum)
      setSelectedMetrics(selectedMetrics.filter(m => m !== metricKey));
    } else {
      // Only allow selecting if we have less than 2 metrics selected (max 2)
      if (selectedMetrics.length < 2) {
        setSelectedMetrics([...selectedMetrics, metricKey]);
      }
    }
  };

  const formatValue = (value: number, metricKey: string) => {
    if (metricKey === 'bounceRate') return `${value.toFixed(2)}%`;
    if (metricKey === 'conversionRate') return `${value.toFixed(2)}%`;
    if (metricKey === 'avgSessionDuration') {
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }
    if (metricKey === 'revenue') return `$${value.toLocaleString()}`;
    if (metricKey === 'revenuePerVisitor') return `$${value.toFixed(2)}`;
    return value.toLocaleString();
  };

  const formatMetricDisplay = (value: number, metricKey: string) => {
    // Show '-' for metrics that have no data
    if ((metricKey === 'revenue' || metricKey === 'revenuePerVisitor' || metricKey === 'conversionRate' || metricKey === 'currentVisitors') && value === 0) {
      return '-';
    }
    
    if (metricKey === 'revenue') return `$${value.toLocaleString()}`;
    if (metricKey === 'revenuePerVisitor') return `$${value.toFixed(2)}`;
    if (metricKey === 'conversionRate') return `${value}%`;
    if (metricKey === 'bounceRate') return `${value.toFixed(2)}%`;
    if (metricKey === 'avgSessionDuration') {
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }
    return value.toLocaleString();
  };

  if (isLoading || !selectedCompany) {
    return (
      <div className="h-full flex items-center justify-center">
        <InlineSpinner size={20} />
      </div>
    );
  }

  if (showSetupWizard || !hasIntegrations) {
    return (
      <div className="h-full flex flex-col">
        <IntegrationSetupWizard
          mode="ga4"
          onComplete={handleSetupComplete}
          onCancel={() => setShowSetupWizard(false)}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Header with filters - following OverviewPage pattern */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
        <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto">
          <FilterDropdown
            label="Date Range"
            value={filters.dateRange}
            options={dateRangeOptions}
            onChange={(value) => handleFilterChange({ dateRange: value as string })}
            icon={Calendar}
            disabled={isLoading || refreshing}
          />

          <button
            onClick={handleRefresh}
            disabled={isLoading || refreshing}
            className="flex items-center justify-center w-full lg:w-auto gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black"
          >
            {refreshing ? (
              <InlineSpinner size={16} />
            ) : (
              <>
                <RefreshCw size={16} />
                <span className="whitespace-nowrap">Refresh Data</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowSetupWizard(true)}
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
            onClick={() => setFilters(prev => ({ ...prev, refreshTrigger: prev.refreshTrigger + 1 }))}
            className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm font-medium hover:bg-white/85"
          >
            Retry
          </button>
        </div>
      ) : !metrics ? (
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-8 text-center">
          <p className="text-sm text-gray-600">
            Data will appear once your GA4 integration is active.
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-4">
          {/* Integrated Chart Container with Key Metrics */}
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md flex-1 flex flex-col">
            {/* Title */}
            <div className="px-4 py-2 border-b border-white/20">
              <h3 className="text-sm font-medium text-gray-900">Analytics Over Time</h3>
            </div>
            
            {/* Key Metrics Grid - showing all metrics with blank states for unavailable data */}
            <div className="px-4 py-2 border-b border-white/20">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <MetricCard 
                  label="Visitors" 
                  value={formatMetricDisplay(metrics.totalUsers, 'visitors')} 
                  isSelected={selectedMetrics.includes('visitors')}
                  onClick={() => handleMetricToggle('visitors')}
                  metricKey="visitors"
                />
                <MetricCard 
                  label="Revenue" 
                  value={formatMetricDisplay(metrics.revenue, 'revenue')} 
                  isSelected={selectedMetrics.includes('revenue')}
                  onClick={() => handleMetricToggle('revenue')}
                  metricKey="revenue"
                />
                <MetricCard 
                  label="Revenue/Visitor" 
                  value={formatMetricDisplay(metrics.revenuePerVisitor, 'revenuePerVisitor')} 
                  isSelected={selectedMetrics.includes('revenuePerVisitor')}
                  onClick={() => handleMetricToggle('revenuePerVisitor')}
                  metricKey="revenuePerVisitor"
                />
                <MetricCard 
                  label="Conversion Rate" 
                  value={formatMetricDisplay(metrics.conversionRate, 'conversionRate')} 
                  isSelected={selectedMetrics.includes('conversionRate')}
                  onClick={() => handleMetricToggle('conversionRate')}
                  metricKey="conversionRate"
                />
                <MetricCard 
                  label="Bounce Rate" 
                  value={formatMetricDisplay(metrics.bounceRate, 'bounceRate')} 
                  isSelected={selectedMetrics.includes('bounceRate')}
                  onClick={() => handleMetricToggle('bounceRate')}
                  metricKey="bounceRate"
                />
                <MetricCard 
                  label="Session Time" 
                  value={formatMetricDisplay(metrics.averageSessionDuration, 'avgSessionDuration')} 
                  isSelected={selectedMetrics.includes('avgSessionDuration')}
                  onClick={() => handleMetricToggle('avgSessionDuration')}
                  metricKey="avgSessionDuration"
                />
                <MetricCard 
                  label="Visitors Now" 
                  value={formatMetricDisplay(metrics.currentVisitors, 'currentVisitors')}
                  showPulsingDot={true}
                  showArrow={true}
                />
              </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 min-h-0 relative" style={{ minHeight: "300px" }}>
              {selectedMetrics.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm" style={{ marginTop: "120px" }}>
                  Select metrics above to display chart
                </div>
              ) : metrics.timeSeriesData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                  No time series data available - check browser console for debugging info
                </div>
              ) : (
                <ResponsiveContainer 
                  width="100%" 
                  height="100%" 
                  minHeight={300}
                  debounce={50}
                >
                <ComposedChart 
                  data={metrics.timeSeriesData}
                  margin={{
                    top: 5,
                    right: 35,
                    bottom: 15,
                    left: 20,
                  }}
                  onMouseEnter={() => {
                    // Debug: Log chart data on hover
                    console.log('[WebAnalytics] Chart data:', {
                      dataLength: metrics.timeSeriesData.length,
                      selectedMetrics,
                      sampleData: metrics.timeSeriesData.slice(0, 2)
                    });
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    strokeWidth={1}
                    horizontalPoints={[0]}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "#64748b",
                      textAnchor: "middle",
                    }}
                    tickMargin={0}
                    angle={0}
                    height={20}
                    interval={metrics.timeSeriesData.length > 15 ? Math.floor(metrics.timeSeriesData.length / 8) : 0}
                    tickFormatter={(date) => {
                      const d = new Date(date);
                      if (isNaN(d.getTime())) {
                        return ''; // Return empty string for invalid dates
                      }
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={20}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={20}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      formatValue(value, name), 
                      METRIC_OPTIONS.find(opt => opt.key === name)?.label || name
                    ]}
                    labelFormatter={(date) => {
                      const d = new Date(date);
                      return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString();
                    }}
                    cursor={false}
                    allowEscapeViewBox={{ x: false, y: false }}
                    isAnimationActive={false}
                    wrapperStyle={{ outline: "none" }}
                  />
                  
                  {/* Render bars first (underneath) */}
                  {selectedMetrics.map((metricKey, index) => {
                    const option = METRIC_OPTIONS.find(opt => opt.key === metricKey);
                    if (!option) return null;
                    
                    const yAxisId = index === 0 ? "left" : "right";
                    
                    // Second metric is always bar
                    if (index === 1) {
                      return (
                        <Bar
                          key={metricKey}
                          dataKey={metricKey}
                          fill="#93c5fd"
                          fillOpacity={0.8}
                          yAxisId={yAxisId}
                          name={option.label}
                          radius={[2, 2, 0, 0]}
                        />
                      );
                    }
                    return null;
                  })}
                  
                  {/* Render lines second (on top) */}
                  {selectedMetrics.map((metricKey, index) => {
                    const option = METRIC_OPTIONS.find(opt => opt.key === metricKey);
                    if (!option) return null;
                    
                    const yAxisId = index === 0 ? "left" : "right";
                    
                    // First metric is always line
                    if (index === 0) {
                      return (
                        <Line
                          key={metricKey}
                          type="monotone"
                          dataKey={metricKey}
                          stroke="#1e40af"
                          strokeWidth={metrics.timeSeriesData.length > 1 ? 2 : 0}
                          dot={false}
                          activeDot={(props: { cx?: number; cy?: number }) => {
                            return (
                              <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={5}
                                fill="#1e40af"
                                strokeWidth={1}
                                stroke="#ffffff"
                              />
                            );
                          }}
                          yAxisId={yAxisId}
                          name={option.label}
                          connectNulls={false}
                          isAnimationActive={true}
                          animationDuration={600}
                        />
                      );
                    }
                    return null;
                  })}
                </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Bottom Section - Top Referrers and Top Pages */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Referrers */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md flex flex-col h-full max-h-56">
              <div className="px-4 py-2 border-b border-white/20 flex-shrink-0">
                <div className="grid grid-cols-[1fr_5rem_5rem] gap-3 items-center">
                  <h3 className="text-sm font-medium text-gray-900">Top Referrers</h3>
                  <div className="text-right text-xs font-medium text-gray-500">Sessions</div>
                  <div className="text-right text-xs font-medium text-gray-500">Visitors</div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-3">
                {metrics.topReferrers && metrics.topReferrers.length > 0 ? (
                  <div className="space-y-2">
                    
                    {/* Data Rows */}
                    {metrics.topReferrers.slice(0, 10).map((referrer, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_5rem_5rem] gap-3 items-center text-xs"
                      >
                        <div className="text-gray-900 truncate" title={`${referrer.source} / ${referrer.medium}`}>
                          {referrer.source} / {referrer.medium}
                        </div>
                        <div className="text-gray-600 text-right">{referrer.sessions.toLocaleString()}</div>
                        <div className="text-gray-600 text-right">{referrer.users.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-sm text-gray-500 py-8">
                    No referrer data available
                  </div>
                )}
              </div>
              <div className="px-4 py-1 border-t border-white/20 flex-shrink-0 bg-white/40 backdrop-blur-sm"></div>
            </div>

            {/* Top Pages */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md flex flex-col h-full max-h-56">
              <div className="px-4 py-2 border-b border-white/20 flex-shrink-0">
                <div className="grid grid-cols-[1fr_5rem_5rem] gap-3 items-center">
                  <h3 className="text-sm font-medium text-gray-900">Top Pages</h3>
                  <div className="text-right text-xs font-medium text-gray-500">Views</div>
                  <div className="text-right text-xs font-medium text-gray-500">Visitors</div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-3">
                {metrics.topPages && metrics.topPages.length > 0 ? (
                  <div className="space-y-2">
                    
                    {/* Data Rows */}
                    {metrics.topPages.slice(0, 10).map((p, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[1fr_5rem_5rem] gap-3 items-center text-xs"
                      >
                        <div className="text-gray-900 truncate" title={p.pagePath}>
                          {p.pagePath}
                        </div>
                        <div className="text-gray-600 text-right">{p.views.toLocaleString()}</div>
                        <div className="text-gray-600 text-right">{p.users.toLocaleString()}</div>
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
  showPulsingDot?: boolean;
  showArrow?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, subtitle, isSelected = false, onClick, metricKey, showPulsingDot = false, showArrow = false }) => {
  const isClickable = !!onClick && !!metricKey;
  
  return (
    <div 
      className={`
        rounded-lg p-2.5 relative transition-colors 
        ${isClickable ? 'cursor-pointer' : ''}
        ${isSelected 
          ? 'bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900' 
          : 'bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500'
        }
        ${isClickable && !isSelected ? 'hover:text-gray-700 hover:bg-white/85' : ''}
      `}
      onClick={isClickable ? onClick : undefined}
    >
      {/* Pulsing blue dot in top right */}
      {showPulsingDot && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        </div>
      )}
      
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

export default WebAnalyticsPage;