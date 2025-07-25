/**
 * @file chartDataProcessing.ts
 * @description Centralized utilities for processing chart data across dashboard components.
 * Eliminates code duplication and ensures consistent data transformation logic.
 * 
 * Key responsibilities:
 * - Standardized date filtering and parsing
 * - Synthetic zero-point insertion for chart continuity
 * - Model breakdown data aggregation
 * - Y-axis scaling and tick calculation
 * - Current value extraction from time series data
 * 
 * @author Dashboard Team
 * @version 2.0.0 - Refactored from duplicated component logic
 */

/**
 * Supported date range filters for chart data
 */
export type DateRangeFilter = '24h' | '7d' | '30d' | '90d' | '1y';

/**
 * Supported granularity options for time-based aggregation
 */
export type GranularityFilter = 'hour' | 'day' | 'week';

/**
 * Base interface for chart data points with synthetic zero-point support
 */
export interface BaseChartDataPoint {
  date: string;
  fullDate?: string;
  isZeroPoint?: boolean;
  aggregationType?: GranularityFilter | 'raw';
  reportCount?: number; // Number of reports aggregated (for granular data)
}

/**
 * Sentiment-specific chart data point
 */
export interface SentimentChartDataPoint extends BaseChartDataPoint {
  score: number;
  [modelId: string]: unknown; // Dynamic model keys for breakdown mode
}

/**
 * Metrics-specific chart data point (Share of Voice, Inclusion Rate)
 */
export interface MetricsChartDataPoint extends BaseChartDataPoint {
  shareOfVoice: number;
  inclusionRate?: number;
  [modelId: string]: unknown; // Dynamic model keys for breakdown mode
}

/**
 * Historical data item from API (base interface)
 */
export interface BaseHistoryItem {
  date: string;
  aiModel: string;
}

/**
 * Sentiment history item from API
 */
export interface SentimentHistoryItem extends BaseHistoryItem {
  sentimentScore: number;
}

/**
 * Share of Voice history item from API
 */
export interface ShareOfVoiceHistoryItem extends BaseHistoryItem {
  shareOfVoice: number;
  inclusionRate?: number;
}

/**
 * Inclusion Rate history item from API  
 */
export interface InclusionRateHistoryItem extends BaseHistoryItem {
  inclusionRate: number;
}

/**
 * Chart processing configuration options
 */
export interface ChartProcessingOptions {
  dateRange: DateRangeFilter;
  selectedModel: string;
  showModelBreakdown: boolean;
  includeZeroPoint: boolean;
  granularity?: GranularityFilter;
}

/**
 * Result of chart data processing
 */
export interface ChartProcessingResult<T extends BaseChartDataPoint> {
  chartData: T[];
  modelIds: string[];
  yAxisMax: number;
  ticks: number[];
  xAxisInterval: number;
}

/**
 * Applies date range filtering to historical data
 * Centralizes the date cutoff logic used across all chart components
 * 
 * @param data - Array of historical data items
 * @param dateRange - Date range filter to apply
 * @returns Filtered data array
 */
export function applyDateRangeFilter<T extends BaseHistoryItem>(
  data: T[],
  dateRange: DateRangeFilter
): T[] {
  const now = new Date();
  const cutoffDate = new Date(now);
  
  switch (dateRange) {
    case '24h':
      cutoffDate.setDate(now.getDate() - 1);
      break;
    case '7d':
      cutoffDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      cutoffDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      cutoffDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      cutoffDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      console.warn(`[chartDataProcessing] Unknown date range: ${dateRange}, defaulting to 30d`);
      cutoffDate.setDate(now.getDate() - 30);
  }

  return data.filter(item => new Date(item.date) >= cutoffDate);
}

/**
 * Calculates synthetic zero date for chart continuity
 * Ensures charts start from zero baseline based on date range
 * 
 * @param firstDataDate - Date of the first real data point
 * @param dateRange - Current date range filter
 * @returns Date for synthetic zero point
 */
export function calculateZeroPointDate(firstDataDate: Date, dateRange: DateRangeFilter): Date {
  const zeroDate = new Date(firstDataDate);
  
  switch (dateRange) {
    case '24h':
      zeroDate.setHours(firstDataDate.getHours() - 1);
      break;
    case '7d':
      zeroDate.setDate(firstDataDate.getDate() - 1);
      break;
    case '30d':
      zeroDate.setDate(firstDataDate.getDate() - 3);
      break;
    case '90d':
      zeroDate.setDate(firstDataDate.getDate() - 7);
      break;
    case '1y':
      zeroDate.setDate(firstDataDate.getDate() - 30);
      break;
    default:
      zeroDate.setDate(firstDataDate.getDate() - 1);
  }
  
  return zeroDate;
}

/**
 * Formats date for consistent chart display with granularity awareness
 * Centralizes date formatting logic to ensure consistency
 * 
 * @param date - Date to format
 * @param granularity - Time granularity for appropriate formatting
 * @returns Formatted date string for chart display
 */
export function formatChartDate(date: Date, granularity?: GranularityFilter | 'raw'): string {
  switch (granularity) {
    case 'hour':
      // Show precise time including minutes for actual report execution times
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    case 'week':
      // For weekly data, show "Week of Jan 15"
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      return `Week of ${weekStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })}`;
    case 'day':
    case 'raw':
    default:
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
  }
}

/**
 * Parses and validates date strings from API
 * Handles both ISO strings and date-only formats
 * 
 * @param dateString - Date string from API
 * @returns Parsed Date object or null if invalid
 */
export function parseApiDate(dateString: string): Date | null {
  const date = new Date(dateString + (dateString.includes('T') ? '' : 'T00:00:00Z'));
  
  if (isNaN(date.getTime())) {
    console.warn(`[chartDataProcessing] Invalid date: ${dateString}`);
    return null;
  }
  
  return date;
}

/**
 * Removes duplicate data points by date
 * Keeps the most recent entry for each date
 * 
 * @param data - Array of historical data items
 * @returns Deduplicated array
 */
export function deduplicateByDate<T extends BaseHistoryItem>(data: T[]): T[] {
  const dateMap = new Map<string, T>();
  
  data.forEach(item => {
    const dateKey = new Date(item.date).toISOString().split('T')[0];
    if (!dateMap.has(dateKey) || new Date(item.date) > new Date(dateMap.get(dateKey)!.date)) {
      dateMap.set(dateKey, item);
    }
  });
  
  return Array.from(dateMap.values());
}

/**
 * Calculates Y-axis scaling for chart display
 * Provides optimal tick marks and maximum values
 * 
 * @param values - Array of numeric values to scale
 * @param isPercentage - Whether values represent percentages (0-100 range)
 * @param maxValue - Optional maximum value override
 * @returns Y-axis configuration
 */
export function calculateYAxisScaling(
  values: number[],
  isPercentage: boolean = true,
  maxValue?: number
): { yAxisMax: number; ticks: number[]; } {
  if (values.length === 0) {
    const defaultMax = isPercentage ? 100 : 10;
    const defaultIncrement = isPercentage ? 20 : 2;
    return {
      yAxisMax: defaultMax,
      ticks: Array.from({ length: Math.floor(defaultMax / defaultIncrement) + 1 }, (_, i) => i * defaultIncrement)
    };
  }

  const maxVal = Math.max(...values);
  const upperLimit = maxValue || (isPercentage ? 100 : 10);
  
  if (maxVal === 0) {
    const fallbackMax = isPercentage ? 10 : 2;
    const fallbackIncrement = isPercentage ? 5 : 1;
    return {
      yAxisMax: fallbackMax,
      ticks: Array.from({ length: Math.floor(fallbackMax / fallbackIncrement) + 1 }, (_, i) => i * fallbackIncrement)
    };
  }

  const dynamicMax = Math.min(upperLimit, maxVal * 1.4);
  
  let increment: number;
  if (isPercentage) {
    if (dynamicMax <= 20) increment = 5;
    else if (dynamicMax <= 50) increment = 10;
    else increment = 20;
  } else {
    increment = dynamicMax <= 5 ? 1 : 2;
  }

  const finalMax = Math.ceil(dynamicMax / increment) * increment;
  const ticks = Array.from({ length: Math.floor(finalMax / increment) + 1 }, (_, i) => i * increment);
  
  return { yAxisMax: finalMax, ticks };
}

/**
 * Calculates X-axis interval to prevent label clipping
 * Dynamically adjusts based on data point count
 * 
 * @param dataLength - Number of data points
 * @returns Interval for X-axis labels
 */
export function calculateXAxisInterval(dataLength: number): number {
  if (dataLength > 15) return Math.ceil(dataLength / 8);
  if (dataLength > 10) return Math.ceil(dataLength / 6);
  return 0;
}

/**
 * Extracts current value from processed chart data
 * Gets the most recent non-zero data point value
 * 
 * @param chartData - Processed chart data
 * @param valueKey - Key to extract value from (e.g., 'score', 'shareOfVoice')
 * @param modelIds - Array of model IDs for breakdown mode
 * @param isBreakdownMode - Whether in model breakdown mode
 * @returns Current value or null
 */
export function extractCurrentValue<T extends BaseChartDataPoint>(
  chartData: T[],
  valueKey: keyof T,
  modelIds: string[] = [],
  isBreakdownMode: boolean = false
): number | null {
  if (!chartData || chartData.length === 0) return null;
  
  // Get the most recent data point (excluding synthetic zero points)
  const realDataPoints = chartData.filter(point => !point.isZeroPoint);
  if (realDataPoints.length === 0) return null;
  
  const mostRecentPoint = realDataPoints[realDataPoints.length - 1];
  
  if (isBreakdownMode && modelIds.length > 0) {
    // For breakdown mode, calculate average of all model scores at the most recent point
    const modelScores = modelIds
      .map(modelId => mostRecentPoint[modelId] as number)
      .filter(score => typeof score === 'number' && !isNaN(score));
    
    if (modelScores.length > 0) {
      return modelScores.reduce((sum, score) => sum + score, 0) / modelScores.length;
    }
  } else {
    // For single line mode, use the specified value key
    const value = mostRecentPoint[valueKey];
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Generic chart data processor for time series data
 * Handles both single-line and multi-line (breakdown) modes
 * 
 * @param rawData - Raw historical data from API
 * @param options - Processing configuration options
 * @param dataTransformer - Function to transform single data item to chart point
 * @param valueExtractor - Function to extract numeric values for Y-axis scaling
 * @returns Processed chart data with configuration
 */
export function processTimeSeriesData<THistoryItem extends BaseHistoryItem, TChartPoint extends BaseChartDataPoint>(
  rawData: THistoryItem[],
  options: ChartProcessingOptions,
  dataTransformer: (item: THistoryItem) => TChartPoint | null,
  valueExtractor: (chartData: TChartPoint[], modelIds: string[]) => number[]
): ChartProcessingResult<TChartPoint> {
  if (!rawData || !Array.isArray(rawData)) {
    return {
      chartData: [],
      modelIds: [],
      yAxisMax: 100,
      ticks: [0, 20, 40, 60, 80, 100],
      xAxisInterval: 0
    };
  }

  // Apply date filtering
  const dateFilteredData = applyDateRangeFilter(rawData, options.dateRange);
  
  if (options.showModelBreakdown) {
    // Multi-line mode: break down by individual models
    return processBreakdownMode(dateFilteredData, options, dataTransformer, valueExtractor);
  } else {
    // Single-line mode: use aggregated or selected model data
    return processSingleLineMode(dateFilteredData, options, dataTransformer, valueExtractor);
  }
}

/**
 * Processes data for model breakdown mode (multi-line charts)
 * Internal helper function - not exported
 */
function processBreakdownMode<THistoryItem extends BaseHistoryItem, TChartPoint extends BaseChartDataPoint>(
  dateFilteredData: THistoryItem[],
  options: ChartProcessingOptions,
  dataTransformer: (item: THistoryItem) => TChartPoint | null,
  valueExtractor: (chartData: TChartPoint[], modelIds: string[]) => number[]
): ChartProcessingResult<TChartPoint> {
  const historyAccumulator: Record<string, Record<string, TChartPoint>> = {};
  const models = new Set<string>();

  // Group data by date and model
  dateFilteredData.forEach(item => {
    if (item.aiModel !== 'all') { // Exclude aggregated 'all' data
      // For breakdown mode, group models by report run time (models from same report should align vertically)
      const isSameDayData = dateFilteredData.length > 1 && 
                           dateFilteredData.every(d => new Date(d.date).toDateString() === new Date(dateFilteredData[0].date).toDateString());
      
      let dateKey: string;
      if (options.granularity === 'hour' || isSameDayData) {
        // For individual reports, use reportRunId if available, otherwise round to nearest 5 minutes
        // This groups models from the same report run together vertically
        const itemWithReportId = item as typeof item & { reportRunId?: string };
        if (itemWithReportId.reportRunId) {
          // Use reportRunId + approximate time for perfect grouping
          const date = new Date(item.date);
          const timeSlot = Math.floor(date.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000); // 5-minute slots
          dateKey = `${itemWithReportId.reportRunId}-${timeSlot}`;
        } else {
          // Fallback: round to nearest 5 minutes to group models from same report
          const date = new Date(item.date);
          const timeSlot = Math.floor(date.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
          dateKey = new Date(timeSlot).toISOString();
        }
      } else {
        dateKey = formatChartDate(new Date(item.date), options.granularity);
      }
      
      if (!historyAccumulator[dateKey]) {
        historyAccumulator[dateKey] = {};
      }
      
      // Set the display date for this group
      if (!historyAccumulator[dateKey].date) {
        const displayFormat = (options.granularity === 'hour' || isSameDayData) ? 'hour' : options.granularity;
        historyAccumulator[dateKey].date = formatChartDate(new Date(item.date), displayFormat);
      }
      
      // Transform the item and extract the relevant value
      const transformedItem = dataTransformer(item);
      if (transformedItem) {
        // For breakdown mode, use the primaryValue if available, otherwise use the first numeric value
        const itemData = transformedItem as TChartPoint & Record<string, unknown>;
        let valueToUse: number | undefined;
        
        if (itemData.primaryValue !== undefined) {
          // Use the explicitly set primary value (preferred approach)
          valueToUse = itemData.primaryValue;
        } else {
          // Fallback: find the first numeric property that's not metadata
          const numericKeys = Object.keys(itemData).filter(key => 
            key !== 'date' && key !== 'fullDate' && key !== 'isZeroPoint' && 
            typeof itemData[key] === 'number' && !isNaN(itemData[key])
          );
          if (numericKeys.length > 0) {
            valueToUse = itemData[numericKeys[0]];
          }
        }
        
        if (valueToUse !== undefined) {
          historyAccumulator[dateKey][item.aiModel] = valueToUse;
        }
      }
      
      models.add(item.aiModel);
    }
  });

  const processedData = Object.values(historyAccumulator)
    .sort((a: TChartPoint, b: TChartPoint) => new Date(a.date).getTime() - new Date(b.date).getTime()) as TChartPoint[];

  // Add synthetic zero point if configured and we have data
  let finalData = processedData;
  if (options.includeZeroPoint && processedData.length > 0 && models.size > 0) {
    const firstDate = new Date(dateFilteredData[0].date);
    const _zeroDate = calculateZeroPointDate(firstDate, options.dateRange);
    
    const zeroPoint: Partial<TChartPoint> = {
      date: '', // Empty string so no X-axis label appears
      isZeroPoint: true
    };
    
    // Add zero values for all models
    Array.from(models).forEach(modelId => {
      zeroPoint[modelId] = 0;
    });
    
    finalData = [zeroPoint as TChartPoint, ...processedData];
  }

  // Calculate Y-axis scaling
  const values = valueExtractor(finalData, Array.from(models));
  const { yAxisMax, ticks } = calculateYAxisScaling(values, true);
  const xAxisInterval = calculateXAxisInterval(finalData.length);

  return {
    chartData: finalData,
    modelIds: Array.from(models),
    yAxisMax,
    ticks,
    xAxisInterval
  };
}

/**
 * Processes data for single-line mode (aggregated charts)
 * Internal helper function - not exported
 */
function processSingleLineMode<THistoryItem extends BaseHistoryItem, TChartPoint extends BaseChartDataPoint>(
  dateFilteredData: THistoryItem[],
  options: ChartProcessingOptions,
  dataTransformer: (item: THistoryItem) => TChartPoint | null,
  valueExtractor: (chartData: TChartPoint[], modelIds: string[]) => number[]
): ChartProcessingResult<TChartPoint> {
  const targetModel = options.selectedModel === 'all' ? 'all' : options.selectedModel;
  
  let filteredData = dateFilteredData.filter(item => item.aiModel === targetModel);

  // If no data for target model, fall back to first available model
  if (filteredData.length === 0 && dateFilteredData.length > 0) {
    const firstModel = dateFilteredData[0].aiModel;
    filteredData = dateFilteredData.filter(item => item.aiModel === firstModel);
  }

  // For individual reports (same day), don't deduplicate. For aggregated data, deduplicate by date.
  const isIndividualReportMode = options.granularity === 'hour' || 
                                (options.granularity === 'day' && filteredData.length > 1 && 
                                 filteredData.every(d => new Date(d.date).toDateString() === new Date(filteredData[0].date).toDateString()));
                                 
  const uniqueFilteredData = isIndividualReportMode ? filteredData : deduplicateByDate(filteredData);

  // Transform and sort the data
  const processedData = uniqueFilteredData
    .map(dataTransformer)
    .filter((item): item is TChartPoint => item !== null)
    .sort((a, b) => {
      const dateA = a.fullDate ? new Date(a.fullDate) : new Date(a.date);
      const dateB = b.fullDate ? new Date(b.fullDate) : new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    })
    .map(({ fullDate: _fullDate, ...rest }) => rest as TChartPoint);

  // Add synthetic zero point if configured and we have data
  let finalData = processedData;
  if (options.includeZeroPoint && processedData.length > 0) {
    const _firstDate = new Date(uniqueFilteredData[0].date);
    const zeroPoint: Partial<TChartPoint> = {
      date: '', // Empty string so no X-axis label appears
      isZeroPoint: true
    };
    
    // Copy structure from first data point and set values to 0
    const firstPoint = processedData[0];
    Object.keys(firstPoint).forEach(key => {
      if (key !== 'date' && key !== 'fullDate' && key !== 'isZeroPoint') {
        zeroPoint[key] = 0;
      }
    });
    
    finalData = [zeroPoint as TChartPoint, ...processedData];
  }

  // Calculate Y-axis scaling
  const values = valueExtractor(finalData, []);
  const { yAxisMax, ticks } = calculateYAxisScaling(values, true);
  const xAxisInterval = calculateXAxisInterval(finalData.length);

  return {
    chartData: finalData,
    modelIds: [],
    yAxisMax,
    ticks,
    xAxisInterval
  };
}

/**
 * Determines optimal granularity based on date range for best user experience
 * Provides intelligent defaults to prevent analysis paralysis
 * 
 * @param dateRange - Selected date range filter
 * @returns Optimal granularity for the date range
 */
export function getOptimalGranularity(dateRange: DateRangeFilter): GranularityFilter {
  switch (dateRange) {
    case '24h': 
      return 'hour';   // Hourly granularity for 24 hour view
    case '7d': 
      return 'day';    // Daily granularity for week view
    case '30d': 
      return 'day';    // Daily granularity for month view  
    case '90d': 
      return 'week';   // Weekly granularity for quarter view
    case '1y': 
      return 'week';   // Weekly granularity for year view
    default: 
      return 'day';    // Default to daily granularity
  }
}

/**
 * Checks if granularity makes sense for the given date range
 * Prevents inappropriate granularity selections (e.g., hourly for yearly data)
 * 
 * @param granularity - Selected granularity
 * @param dateRange - Selected date range
 * @returns Whether the combination is recommended
 */
export function isGranularityRecommended(
  granularity: GranularityFilter, 
  dateRange: DateRangeFilter
): boolean {
  const recommendations = {
    '24h': ['hour'],
    '7d': ['hour', 'day'],
    '30d': ['hour', 'day'], // Allow hourly for multiple daily reports
    '90d': ['day', 'week'],
    '1y': ['week']
  };
  
  return recommendations[dateRange]?.includes(granularity) ?? false;
}