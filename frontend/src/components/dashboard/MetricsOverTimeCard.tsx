/**
 * @file MetricsOverTimeCard.tsx
 * @description Combined metrics chart that displays either Share of Voice or Inclusion Rate over time.
 * Replaces the previous 4-card layout with a single large interactive chart.
 * Features a toggle button to switch between metrics and starts the line chart at zero.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - recharts: For line chart visualization.
 * - lucide-react: For icons.
 * - ../../hooks/useDashboard: For dashboard data access.
 *
 * @exports
 * - MetricsOverTimeCard: The main combined metrics chart component.
 */
/**
 * @file MetricsOverTimeCard.tsx
 * @description Combined metrics chart that displays either Share of Voice or Inclusion Rate over time.
 * Features toggle buttons to switch between metrics and model breakdown views.
 *
 * REFACTORED (v2.0.0): Now uses centralized utilities for:
 * - Chart data processing (eliminates duplicated logic)
 * - Model filtering (consistent behavior across components)
 * - Data transformation and validation
 * - Y-axis scaling and date formatting
 *
 * Key features:
 * - Dual metric support (Share of Voice + Inclusion Rate)
 * - Consistent model filtering logic
 * - Standardized chart data processing
 * - Proper error handling and data validation
 *
 * @author Dashboard Team
 * @version 2.0.0 - Refactored to use centralized utilities
 */
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCompany } from "../../hooks/useCompany";
import { useDashboard } from "../../hooks/useDashboard";
import { usePageCache } from "../../hooks/usePageCache";
import {
  getInclusionRateHistory,
  getShareOfVoiceHistory,
} from "../../services/companyService";
import { MODEL_CONFIGS, getModelDisplayName } from "../../types/dashboard";
import {
  DateRangeFilter,
  GranularityFilter,
  InclusionRateHistoryItem,
  MetricsChartDataPoint,
  ShareOfVoiceHistoryItem,
  calculateXAxisInterval,
  calculateYAxisScaling,
  extractCurrentValue,
  formatChartDate,
  getOptimalGranularity,
  parseApiDate,
  processTimeSeriesData,
} from "../../utils/chartDataProcessing";
import { chartColorArrays } from "../../utils/colorClasses";
import {
  DataPipelineMonitor,
  compareDataSources,
  validateDataPipeline,
} from "../../utils/dataConsistencyDebugger";
import LiquidGlassCard from "../ui/LiquidGlassCard";
import { LiquidGlassSpinner } from "../ui/LiquidGlassSpinner";
import UiTooltip from "../ui/Tooltip";

// Suppress Recharts dimension warnings during development
if (process.env.NODE_ENV === "development") {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes(
        "width(0) and height(0) of chart should be greater than 0"
      )
    ) {
      return; // Suppress this specific warning
    }
    originalWarn(...args);
  };
}
// Model filtering handled within processTimeSeriesData

interface MetricsOverTimeCardProps {
  selectedModel?: string;
}

// Using shared interfaces from chartDataProcessing utils
// Legacy interfaces removed - now using centralized types

type MetricType = "shareOfVoice" | "inclusionRate";

const MetricsOverTimeCard: React.FC<MetricsOverTimeCardProps> = ({
  selectedModel = "all",
}) => {
  const { data, error, filters } = useDashboard();
  const { selectedCompany } = useCompany();
  const [selectedMetric, setSelectedMetric] =
    useState<MetricType>("shareOfVoice");
  const [showModelBreakdown, setShowModelBreakdown] = useState<boolean>(false);

  // Smart granularity defaults based on date range
  const optimalGranularity = useMemo(
    () =>
      getOptimalGranularity((filters?.dateRange || "30d") as DateRangeFilter),
    [filters?.dateRange]
  );

  const [granularity, setGranularity] =
    useState<GranularityFilter>(optimalGranularity);
  const [granularityDropdownOpen, setGranularityDropdownOpen] =
    useState<boolean>(false);
  const [animationKey, setAnimationKey] = useState<number>(0);
  const granularityDropdownRef = useRef<HTMLDivElement>(null);

  // State for component-level granularity data
  const [granularityData, setGranularityData] = useState<{
    shareOfVoiceHistory: ShareOfVoiceHistoryItem[];
    inclusionRateHistory: InclusionRateHistoryItem[];
    loading: boolean;
  }>({
    shareOfVoiceHistory: [],
    inclusionRateHistory: [],
    loading: false,
  });

  // Update granularity when date range changes for optimal user experience
  useEffect(() => {
    const newOptimalGranularity = getOptimalGranularity(
      (filters?.dateRange || "30d") as DateRangeFilter
    );
    setGranularity(newOptimalGranularity);
  }, [filters?.dateRange]);

  // Stabilize filters object to prevent infinite re-renders
  const stableFilters = useMemo(() => ({
    dateRange: filters?.dateRange || "30d",
    aiModel:
      selectedModel !== "all" ? selectedModel : filters?.aiModel || "all",
    granularity,
  }), [filters?.dateRange, filters?.aiModel, selectedModel, granularity]);

  // Cache-aware history fetch (SWR + dedupe) keyed by company/dateRange/aiModel/granularity
  const historyCache = usePageCache<{
    sov: ShareOfVoiceHistoryItem[];
    inc: InclusionRateHistoryItem[];
  }>({
    fetcher: useCallback(async (): Promise<{
      sov: ShareOfVoiceHistoryItem[];
      inc: InclusionRateHistoryItem[];
    }> => {
      if (!selectedCompany?.id) {
        return { sov: [], inc: [] };
      }

      const currentFilters = {
        dateRange: filters?.dateRange,
        aiModel: selectedModel !== "all" ? selectedModel : filters?.aiModel,
        granularity,
      };

      const [sov, inc] = await Promise.all([
        getShareOfVoiceHistory(selectedCompany.id, currentFilters),
        getInclusionRateHistory(selectedCompany.id, currentFilters),
      ]);

      // Optional: light validation without blocking UI
      validateDataPipeline(sov, {
        component: "MetricsOverTimeCard",
        operation: "shareOfVoiceValidation",
        filters: currentFilters,
        companyId: selectedCompany.id,
      });
      validateDataPipeline(inc, {
        component: "MetricsOverTimeCard",
        operation: "inclusionRateValidation",
        filters: currentFilters,
        companyId: selectedCompany.id,
      });

      // Optional comparison with context data when compatible
      if (data?.shareOfVoiceHistory && data.shareOfVoiceHistory.length > 0) {
        const sovReport = DataPipelineMonitor.recordData(
          `${selectedCompany.id}-sov-${granularity}-${filters?.dateRange}`,
          sov,
          {
            component: "MetricsOverTimeCard",
            operation: "fetchShareOfVoiceHistory",
            filters: currentFilters,
            companyId: selectedCompany.id,
          }
        );
        const contextReport = DataPipelineMonitor.recordData(
          `${selectedCompany.id}-sov-context-${filters?.dateRange}`,
          data.shareOfVoiceHistory,
          {
            component: "DashboardContext",
            operation: "shareOfVoiceHistory_RAW",
            filters: {
              dateRange: filters?.dateRange,
              aiModel: filters?.aiModel,
              granularity: "RAW",
            },
            companyId: selectedCompany.id,
          }
        );
        const sameGranularity =
          (contextReport.granularity || "RAW") ===
          (sovReport.granularity || "RAW");
        const sameDateRange = contextReport.dateRange === sovReport.dateRange;
        if (sameGranularity && sameDateRange) {
          compareDataSources(sovReport, contextReport);
        }
      }

      return { sov, inc };
    }, [
      selectedCompany,
      filters?.dateRange,
      filters?.aiModel,
      selectedModel,
      granularity,
      data?.shareOfVoiceHistory,
    ]),
    pageType: "dashboard",
    companyId: selectedCompany?.id || "",
    filters: stableFilters,
    enabled: !!selectedCompany?.id,
    staleWhileRevalidate: true,
  });

  // Sync cache data into local state used by the chart
  useEffect(() => {
    setGranularityData({
      shareOfVoiceHistory: historyCache.data?.sov || [],
      inclusionRateHistory: historyCache.data?.inc || [],
      loading: historyCache.loading,
    });
  }, [historyCache.data, historyCache.loading]);

  const handleToggleBreakdown = () => {
    setShowModelBreakdown(!showModelBreakdown);
    setAnimationKey((prev) => prev + 1); // Force re-render with new animation
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        granularityDropdownRef.current &&
        !granularityDropdownRef.current.contains(event.target as Node)
      ) {
        setGranularityDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /**
   * Process chart data - supports both single line (aggregated) and multi-line (breakdown by model)
   */
  /**
   * Process chart data using centralized utilities
   * Handles both Share of Voice and Inclusion Rate with consistent logic
   */
  const chartDataResult = useMemo(() => {
    // Get the appropriate history data based on selected metric from granularity-aware data
    const historyData =
      selectedMetric === "inclusionRate"
        ? granularityData.inclusionRateHistory
        : granularityData.shareOfVoiceHistory;

    if (!historyData || !Array.isArray(historyData)) {
      return { chartData: [], modelIds: [] };
    }

    // Use centralized chart data processing
    const result = processTimeSeriesData<
      ShareOfVoiceHistoryItem | InclusionRateHistoryItem,
      MetricsChartDataPoint
    >(
      historyData,
      {
        dateRange: (filters?.dateRange || "30d") as DateRangeFilter,
        selectedModel,
        showModelBreakdown,
        includeZeroPoint: true,
        granularity,
      },
      // Data transformer function
      (item: ShareOfVoiceHistoryItem | InclusionRateHistoryItem) => {
        const parsedDate = parseApiDate(item.date);
        if (!parsedDate) return null;

        // Create chart data point with the selected metric value
        // For breakdown mode, we need to set the primary metric value that will be used for model keys
        const chartPoint: MetricsChartDataPoint = {
          date: formatChartDate(parsedDate, granularity),
          fullDate: item.date,
          shareOfVoice: 0,
          inclusionRate: 0,
          aggregationType: granularity,
          reportCount: (
            item as ShareOfVoiceHistoryItem & { reportCount?: number }
          ).reportCount, // Include report count for aggregated data
        };

        // Set the appropriate values based on data type and selected metric
        if ("shareOfVoice" in item) {
          chartPoint.shareOfVoice = item.shareOfVoice;
          chartPoint.inclusionRate = item.inclusionRate || 0;
          // For breakdown mode, set the primary metric that will be mapped to model keys
          (
            chartPoint as MetricsChartDataPoint & { primaryValue: number }
          ).primaryValue =
            selectedMetric === "shareOfVoice"
              ? item.shareOfVoice
              : item.inclusionRate || 0;
        } else if ("inclusionRate" in item) {
          chartPoint.inclusionRate = item.inclusionRate;
          // For inclusion rate data, we don't have shareOfVoice, so keep at 0
          (
            chartPoint as MetricsChartDataPoint & { primaryValue: number }
          ).primaryValue = item.inclusionRate;
        }

        return chartPoint;
      },
      // Value extractor for Y-axis scaling
      (chartData: MetricsChartDataPoint[], modelIds: string[]) => {
        const valueKey =
          selectedMetric === "shareOfVoice" ? "shareOfVoice" : "inclusionRate";

        if (modelIds.length > 0) {
          // Breakdown mode: extract values from all model keys
          return chartData.flatMap((d) =>
            modelIds
              .map((modelId) => d[modelId] as number)
              .filter((val) => typeof val === "number" && !isNaN(val))
          );
        } else {
          // Single line mode: extract values for selected metric
          return chartData
            .map((d) => d[valueKey])
            .filter(
              (val) => typeof val === "number" && !isNaN(val)
            ) as number[];
        }
      }
    );

    return {
      chartData: result.chartData,
      modelIds: result.modelIds,
    };
  }, [
    granularityData.shareOfVoiceHistory,
    granularityData.inclusionRateHistory,
    selectedModel,
    selectedMetric,
    showModelBreakdown,
    filters?.dateRange,
    granularity,
  ]);

  const chartData = useMemo(
    () => chartDataResult?.chartData || [],
    [chartDataResult?.chartData]
  );
  const modelIds = useMemo(
    () => chartDataResult?.modelIds || [],
    [chartDataResult?.modelIds]
  );

  /**
   * Calculate Y-axis and X-axis configuration using shared utilities
   */
  const { yAxisMax, ticks, xAxisInterval } = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        yAxisMax: 100,
        ticks: [0, 20, 40, 60, 80, 100],
        xAxisInterval: 0,
      };
    }

    // Extract values for Y-axis scaling using shared logic
    let values: number[] = [];
    if (showModelBreakdown && modelIds.length > 0) {
      values = chartData.flatMap(
        (d: MetricsChartDataPoint & Record<string, unknown>) =>
          modelIds
            .map((modelId: string) => d[modelId] as number)
            .filter((val: unknown) => typeof val === "number" && !isNaN(val))
      );
    } else {
      const metricKey =
        selectedMetric === "shareOfVoice" ? "shareOfVoice" : "inclusionRate";
      values = chartData
        .map(
          (d: MetricsChartDataPoint) =>
            d[metricKey as keyof MetricsChartDataPoint]
        )
        .filter(
          (val: unknown) => typeof val === "number" && !isNaN(val)
        ) as number[];
    }

    // Use centralized Y-axis scaling (metrics are percentages, 0-100 range)
    const { yAxisMax, ticks } = calculateYAxisScaling(values, true, 100);

    // Use centralized X-axis interval calculation
    const xAxisInterval = calculateXAxisInterval(chartData.length);

    return { yAxisMax, ticks, xAxisInterval };
  }, [chartData, selectedMetric, showModelBreakdown, modelIds]);

  /**
   * Gets current metric value using centralized approach
   * Ensures consistency with chart data source
   */
  const getCurrentMetricValue = () => {
    if (!data) return null;

    // Use extractCurrentValue utility for consistency with chart data
    const currentValueFromChart = extractCurrentValue(
      chartData,
      selectedMetric === "shareOfVoice" ? "shareOfVoice" : "inclusionRate",
      modelIds,
      showModelBreakdown
    );

    // If we have chart data, use it for consistency
    if (currentValueFromChart !== null) {
      return currentValueFromChart;
    }

    // Fallback to direct data fields
    if (selectedMetric === "shareOfVoice") {
      return data.shareOfVoice;
    } else {
      return data.averageInclusionRate;
    }
  };

  const getCurrentMetricChange = () => {
    if (!data) return null;

    if (selectedMetric === "shareOfVoice") {
      return data.shareOfVoiceChange;
    } else {
      return data.averageInclusionChange;
    }
  };

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case "shareOfVoice":
        return "Share of Voice";
      case "inclusionRate":
        return "Inclusion Rate";
      default:
        return "Share of Voice";
    }
  };

  const getDataKey = () => {
    switch (selectedMetric) {
      case "shareOfVoice":
        return "shareOfVoice";
      case "inclusionRate":
        return "inclusionRate";
      default:
        return "shareOfVoice";
    }
  };

  const getMetricTooltipContent = () => {
    if (selectedMetric === "shareOfVoice") {
      return (
        <span>
          <strong>Share of Voice</strong>: percent of AI answers that mention
          your brand across the selected models and date range. Higher is
          better. Use breakdown to see each model's contribution.
        </span>
      );
    }
    return (
      <span>
        <strong>Inclusion Rate</strong>: percent of evaluated queries where your
        brand is included in answers/citations across the selected models and
        date range. Indicates how often you appear. Higher is better.
      </span>
    );
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      );
    }

    // Show loading state when fetching granularity data
    if (granularityData.loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <LiquidGlassSpinner size="lg" />
        </div>
      );
    }

    if (!chartData || chartData.length === 0) {
      // Show blank state instead of "No data available" message
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-64"></div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 relative" style={{ minHeight: "240px" }}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minHeight={200}
          debounce={50}
        >
          <AreaChart
            data={chartData}
            margin={{
              top: 5,
              right: showModelBreakdown ? 35 : 20, // Extra space for last data point label
              bottom: 0,
              left: 20,
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
                textAnchor: chartData.length > 10 ? "end" : "middle",
              }}
              tickMargin={chartData.length > 10 ? 2 : 0}
              interval={xAxisInterval}
              angle={chartData.length > 10 ? -45 : 0}
              height={chartData.length > 10 ? 25 : 20}
            />
            <YAxis
              domain={[0, yAxisMax]}
              ticks={ticks}
              interval={0}
              allowDecimals={false}
              axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickFormatter={(value) => `${value}%`}
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
              content={(props) => {
                if (
                  !props.active ||
                  !props.payload ||
                  props.payload.length === 0
                )
                  return null;

                // Don't show tooltip for zero points
                if (props.payload[0]?.payload?.isZeroPoint) {
                  return null;
                }

                const label = props.label;

                if (showModelBreakdown) {
                  // For breakdown mode, show all models at this data point
                  const payload = props.payload.filter(
                    (entry) => entry.value !== null && entry.value !== undefined
                  );

                  if (payload.length === 0) return null;

                  // Sort payload by value in descending order
                  const sortedPayload = [...payload].sort((a, b) => {
                    const valueA = typeof a.value === "number" ? a.value : 0;
                    const valueB = typeof b.value === "number" ? b.value : 0;
                    return valueB - valueA;
                  });

                  return (
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        fontSize: "12px",
                        padding: "8px",
                      }}
                    >
                      <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>
                        {label && `Date: ${label}`}
                      </p>
                      {sortedPayload.map((entry, index) => (
                        <p
                          key={index}
                          style={{
                            margin:
                              index === sortedPayload.length - 1
                                ? 0
                                : "0 0 2px 0",
                            color: entry.color || entry.stroke || "#2563eb",
                          }}
                        >
                          {getModelDisplayName(entry.dataKey as string) ||
                            entry.dataKey}
                          :{" "}
                          {typeof entry.value === "number"
                            ? entry.value.toFixed(1)
                            : "0.0"}
                          %
                        </p>
                      ))}
                    </div>
                  );
                } else {
                  // For single line mode
                  const data = props.payload[0];
                  const value = data.value;
                  const color = data.color || data.stroke || "#2563eb";

                  return (
                    <div
                      style={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        fontSize: "12px",
                        padding: "8px",
                      }}
                    >
                      <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>
                        {label && `Date: ${label}`}
                      </p>
                      <p style={{ margin: 0, color: color }}>
                        {getMetricLabel()}:{" "}
                        {typeof value === "number" ? value.toFixed(1) : "0.0"}%
                      </p>
                    </div>
                  );
                }
              }}
              cursor={false}
              allowEscapeViewBox={{ x: false, y: false }}
              shared={showModelBreakdown}
              trigger="hover"
              isAnimationActive={false}
              wrapperStyle={{ outline: "none" }}
            />
            {showModelBreakdown ? (
              // Multi-line mode: render an area for each model with animation
              modelIds.map((modelId: string, idx: number) => {
                const color =
                  chartColorArrays.multiColor[
                    idx % chartColorArrays.multiColor.length
                  ];
                return (
                  <Area
                    key={`${modelId}-${animationKey}`}
                    type="monotone"
                    dataKey={modelId}
                    name={modelId}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.2}
                    strokeWidth={chartData.length > 1 ? 2 : 0}
                    dot={false}
                    activeDot={(props: {
                      cx?: number;
                      cy?: number;
                      payload?: { isZeroPoint?: boolean };
                    }) => {
                      if (props.payload?.isZeroPoint) return <g />;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={5}
                          fill={color}
                          strokeWidth={0}
                        />
                      );
                    }}
                    connectNulls={false}
                    isAnimationActive={true}
                    animationBegin={idx * 100}
                    animationDuration={800}
                  />
                );
              })
            ) : (
              // Single-line mode: render one aggregated area
              <Area
                key={`single-${animationKey}`}
                type="monotone"
                dataKey={getDataKey()}
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.1}
                strokeWidth={chartData.length > 1 ? 2 : 0}
                dot={false}
                activeDot={(props: {
                  cx?: number;
                  cy?: number;
                  payload?: { isZeroPoint?: boolean };
                }) => {
                  if (props.payload?.isZeroPoint) return <g />;
                  return (
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={6}
                      fill="#2563eb"
                      strokeWidth={1}
                      stroke="#ffffff"
                    />
                  );
                }}
                connectNulls={false}
                isAnimationActive={true}
                animationDuration={600}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        {/* Model icons positioned at the end of each line */}
        {showModelBreakdown && modelIds.length > 0 && chartData.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {(() => {
              const lastDataPoint = chartData[chartData.length - 1];

              // Group models by their score value for horizontal offsetting
              const modelsByScore: Record<number, string[]> = {};
              modelIds.forEach((modelId) => {
                const value = lastDataPoint[modelId] as number;
                if (value !== undefined && value !== null) {
                  const roundedValue = Math.round(value * 10) / 10; // Round to 1 decimal for grouping
                  if (!modelsByScore[roundedValue]) {
                    modelsByScore[roundedValue] = [];
                  }
                  modelsByScore[roundedValue].push(modelId);
                }
              });

              return modelIds.map((modelId: string) => {
                const value = lastDataPoint[modelId] as number;
                if (value === undefined || value === null) return null;

                // Calculate position based on chart dimensions and value
                const chartHeight = 100; // Approximate chart height percentage
                const yPercent = ((yAxisMax - value) / yAxisMax) * chartHeight;

                // Calculate horizontal offset for models with same score
                const roundedValue = Math.round(value * 10) / 10;
                const modelsAtSameScore = modelsByScore[roundedValue];
                const indexInGroup = modelsAtSameScore.indexOf(modelId);
                const totalInGroup = modelsAtSameScore.length;

                // Calculate horizontal offset (spread models horizontally when they have same score)
                let horizontalOffset = 5; // Default right position
                let zIndex = 1; // Default z-index
                if (totalInGroup > 1) {
                  const spacing = 8; // pixels between icons
                  const totalWidth = (totalInGroup - 1) * spacing;
                  const startOffset = 5 + totalWidth / 2; // Center the group
                  horizontalOffset = startOffset - indexInGroup * spacing;
                  // Leftmost icon (index 0) gets highest z-index
                  zIndex = totalInGroup - indexInGroup;
                }

                const modelConfig = MODEL_CONFIGS[modelId];

                return (
                  <div
                    key={`icon-${modelId}`}
                    className="absolute w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center"
                    style={{
                      top: `${Math.max(5, Math.min(85, yPercent - 4))}%`,
                      right: `${horizontalOffset}px`,
                      transform: "translateY(-50%)",
                      zIndex: zIndex,
                    }}
                  >
                    {modelConfig?.logoUrl ? (
                      <img
                        src={modelConfig.logoUrl}
                        alt={getModelDisplayName(modelId)}
                        className="w-4 h-4 rounded-full object-contain"
                      />
                    ) : (
                      <span className="text-xs font-bold text-gray-600">
                        {getModelDisplayName(modelId).charAt(0)}
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    );
  };

  const currentValue = getCurrentMetricValue();
  const currentChange = getCurrentMetricChange();

  return (
    <LiquidGlassCard className="h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-0.5">
              <h3 className="text-sm font-medium text-gray-900">
                {getMetricLabel()}
              </h3>
              <UiTooltip content={getMetricTooltipContent()}>
                <span
                  aria-label="What this metric means"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/40 bg-white/70 text-gray-700 align-super -translate-y-0.5 md:-translate-y-1"
                >
                  <Info className="h-3 w-3" />
                </span>
              </UiTooltip>
            </div>
            {currentValue !== null && typeof currentValue === "number" && (
              <div className="h-8 px-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-lg shadow-inner flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {currentValue.toFixed(1)}%
                </span>
              </div>
            )}
            {currentChange !== null &&
              typeof currentChange === "number" &&
              Math.abs(currentChange) >= 0.1 && (
                <span
                  className={`flex items-center text-xs font-medium ${
                    currentChange > 0
                      ? "text-green-500"
                      : currentChange < 0
                        ? "text-red-500"
                        : "text-gray-400"
                  }`}
                >
                  {currentChange > 0 ? (
                    <ChevronUp className="h-3 w-3 mr-0.5" />
                  ) : currentChange < 0 ? (
                    <ChevronDown className="h-3 w-3 mr-0.5" />
                  ) : (
                    "—"
                  )}
                  {Math.abs(currentChange).toFixed(1)}%
                </span>
              )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex space-x-1">
            <button
              onClick={() => setSelectedMetric("shareOfVoice")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation ${
                selectedMetric === "shareOfVoice"
                  ? "bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900"
                  : "bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85"
              }`}
              title="Share of Voice"
              style={{
                WebkitTapHighlightColor: "transparent",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            >
              <MessageSquare size={14} />
            </button>
            <button
              onClick={() => setSelectedMetric("inclusionRate")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation ${
                selectedMetric === "inclusionRate"
                  ? "bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900"
                  : "bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85"
              }`}
              title="Inclusion Rate"
              style={{
                WebkitTapHighlightColor: "transparent",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            >
              <Eye size={14} />
            </button>

            <button
              onClick={handleToggleBreakdown}
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation ${
                showModelBreakdown
                  ? "bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900"
                  : "bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-500 hover:text-gray-700 hover:bg-white/85"
              }`}
              title={
                showModelBreakdown
                  ? "Show aggregated view"
                  : "Break down by model"
              }
              style={{
                WebkitTapHighlightColor: "transparent",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            >
              <Sparkles size={14} />
            </button>

            {/* Granularity Selector */}
            <div className="relative ml-2" ref={granularityDropdownRef}>
              <button
                onClick={() =>
                  setGranularityDropdownOpen(!granularityDropdownOpen)
                }
                className="flex items-center justify-center w-16 h-8 px-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-xs transition-colors hover:bg-white/85 focus:outline-none select-none touch-manipulation"
                title="Time granularity"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  WebkitUserSelect: "none",
                  userSelect: "none",
                }}
              >
                <span className="text-xs">
                  {granularity === "day"
                    ? "Daily"
                    : granularity === "hour"
                      ? "Hourly"
                      : "Weekly"}
                </span>
              </button>

              {granularityDropdownOpen && (
                <div className="absolute top-full left-0 w-full min-w-20 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md z-50 py-1">
                  {[
                    { value: "hour", label: "Hourly" },
                    { value: "day", label: "Daily" },
                    { value: "week", label: "Weekly" },
                  ].map((option) => {
                    return (
                      <button
                        key={option.value}
                        onClick={() => {
                          setGranularity(option.value as GranularityFilter);
                          setGranularityDropdownOpen(false);
                        }}
                        disabled={granularityData.loading}
                        className="w-full px-2 py-2 text-left text-xs transition-colors flex items-center justify-between group focus:outline-none select-none touch-manipulation hover:bg-white/20 text-gray-800"
                        style={{
                          WebkitTapHighlightColor: "transparent",
                          WebkitUserSelect: "none",
                          userSelect: "none",
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span>{option.label}</span>
                        </div>
                        {granularity === option.value && (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {renderContent()}
    </LiquidGlassCard>
  );
};

export default MetricsOverTimeCard;
