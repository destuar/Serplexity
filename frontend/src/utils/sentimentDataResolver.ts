/**
 * @file sentimentDataResolver.ts
 * @description Centralized sentiment data resolution to establish single source of truth.
 * Eliminates the confusion between sentimentScore, sentimentDetails, and sentimentOverTime
 * that was causing inconsistent current values across components.
 * 
 * Data Source Hierarchy (in order of precedence):
 * 1. Most recent point from sentimentOverTime (time series data) - Most accurate
 * 2. Calculated from sentimentDetails (detailed metrics) - Comprehensive fallback  
 * 3. Direct sentimentScore field - Simple fallback
 * 4. Default/null - No data available
 * 
 * This resolver ensures all components show the same current sentiment value.
 * 
 * @author Dashboard Team
 * @version 2.0.0 - Unified from scattered component logic
 */

import { 
  ModelFilterConfig,
  createModelFilterConfig,
  filterHistoricalDataByModel,
  filterDetailedMetricsByModel,
  extractAvailableModels
} from './modelFiltering';
import { 
  SentimentHistoryItem,
  applyDateRangeFilter,
  deduplicateByDate,
  DateRangeFilter
} from './chartDataProcessing';

/**
 * Sentiment value with metadata about its source
 * Helps with debugging and understanding data provenance
 */
export interface SentimentValueResult {
  /** The resolved sentiment value (0-10 scale) */
  value: number | null;
  /** Source of the value for debugging */
  source: 'time-series' | 'detailed-metrics' | 'direct-field' | 'unavailable';
  /** When the value was last updated (if available) */
  lastUpdated?: string;
  /** Whether this is an aggregated value across models */
  isAggregated: boolean;
  /** Confidence level of the value (0-1 scale) */
  confidence: number;
  /** Any warnings about data quality */
  warnings: string[];
}

/**
 * Sentiment change information
 */
export interface SentimentChangeResult {
  /** The change value */
  change: number | null;
  /** Source of the change calculation */
  source: 'api-provided' | 'calculated' | 'unavailable';
  /** Confidence in the change calculation */
  confidence: number;
}

/**
 * Main sentiment data structure from dashboard context
 * Represents the consolidated data available to components
 */
export interface SentimentDataContext {
  /** Direct sentiment score field (legacy) */
  sentimentScore?: number | null;
  /** Direct sentiment change field (legacy) */
  sentimentChange?: number | null;
  /** Detailed sentiment metrics with per-model breakdown */
  sentimentDetails?: Array<{
    name: string;
    engine: string;
    value: {
      overallSentiment?: number;
      ratings?: Array<{
        quality?: number;
        priceValue?: number;
        brandReputation?: number;
        brandTrust?: number;
        customerService?: number;
      }>;
    };
  }>;
  /** Historical sentiment data for time series */
  sentimentOverTime?: SentimentHistoryItem[];
}

/**
 * Configuration for sentiment value resolution
 */
export interface SentimentResolutionOptions {
  /** Selected model for filtering */
  selectedModel: string;
  /** Date range for historical data filtering */
  dateRange: DateRangeFilter;
  /** Whether to prefer aggregated vs model-specific values */
  preferAggregated: boolean;
  /** Minimum confidence threshold for returning values */
  minConfidence: number;
}

/**
 * Default resolution options
 */
const DEFAULT_RESOLUTION_OPTIONS: SentimentResolutionOptions = {
  selectedModel: 'all',
  dateRange: '30d',
  preferAggregated: true,
  minConfidence: 0.5,
};

/**
 * Resolves current sentiment value using hierarchical data source precedence
 * 
 * @param data - Sentiment data from dashboard context
 * @param options - Resolution configuration options
 * @returns Resolved sentiment value with metadata
 * 
 * @example
 * ```typescript
 * const result = resolveCurrentSentimentValue(dashboardData, {
 *   selectedModel: 'gpt-4',
 *   dateRange: '30d',
 *   preferAggregated: false,
 *   minConfidence: 0.7
 * });
 * 
 * if (result.value !== null && result.confidence >= 0.7) {
 *   displaySentimentScore(result.value);
 * }
 * ```
 */
export function resolveCurrentSentimentValue(
  data: SentimentDataContext,
  options: Partial<SentimentResolutionOptions> = {}
): SentimentValueResult {
  const _opts = { ...DEFAULT_RESOLUTION_OPTIONS, ...options };
  const modelConfig = createModelFilterConfig(opts.selectedModel);
  const warnings: string[] = [];

  // Source 1: Most recent point from time series data (highest precedence)
  const timeSeriesResult = resolveFromTimeSeries(data, modelConfig, opts, warnings);
  if (timeSeriesResult.value !== null && timeSeriesResult.confidence >= opts.minConfidence) {
    return timeSeriesResult;
  }

  // Source 2: Calculated from detailed metrics (fallback)
  const detailedMetricsResult = resolveFromDetailedMetrics(data, modelConfig, warnings);
  if (detailedMetricsResult.value !== null && detailedMetricsResult.confidence >= opts.minConfidence) {
    return detailedMetricsResult;
  }

  // Source 3: Direct sentiment score field (legacy fallback)
  const directFieldResult = resolveFromDirectField(data, warnings);
  if (directFieldResult.value !== null && directFieldResult.confidence >= opts.minConfidence) {
    return directFieldResult;
  }

  // Source 4: No data available
  warnings.push('No sentiment data available from any source');
  return {
    value: null,
    source: 'unavailable',
    isAggregated: modelConfig.shouldShowAggregated,
    confidence: 0,
    warnings,
  };
}

/**
 * Resolves sentiment change value
 * 
 * @param data - Sentiment data from dashboard context
 * @param options - Resolution configuration options
 * @returns Resolved sentiment change with metadata
 */
export function resolveCurrentSentimentChange(
  data: SentimentDataContext,
  options: Partial<SentimentResolutionOptions> = {}
): SentimentChangeResult {
  const _opts = { ...DEFAULT_RESOLUTION_OPTIONS, ...options };

  // First try direct API-provided change
  if (typeof data.sentimentChange === 'number' && !isNaN(data.sentimentChange)) {
    return {
      change: data.sentimentChange,
      source: 'api-provided',
      confidence: 0.9,
    };
  }

  // TODO: Implement calculated change from time series data
  // This would compare the two most recent time series points
  // For now, return unavailable to prevent incorrect calculations
  
  return {
    change: null,
    source: 'unavailable',
    confidence: 0,
  };
}

/**
 * Validates sentiment data structure for debugging
 * Helps identify data quality issues
 * 
 * @param data - Sentiment data to validate
 * @returns Validation results with detailed diagnostics
 */
export function validateSentimentData(data: SentimentDataContext): {
  isValid: boolean;
  hasTimeSeries: boolean;
  hasDetailedMetrics: boolean;
  hasDirectFields: boolean;
  availableModels: string[];
  diagnostics: string[];
} {
  const diagnostics: string[] = [];
  
  // Check time series data
  const hasTimeSeries = Array.isArray(data.sentimentOverTime) && data.sentimentOverTime.length > 0;
  if (!hasTimeSeries) {
    diagnostics.push('No time series data (sentimentOverTime) available');
  } else {
    const availableModels = extractAvailableModels(data.sentimentOverTime);
    diagnostics.push(`Time series data available for ${availableModels.length} models: ${availableModels.join(', ')}`);
  }

  // Check detailed metrics
  const hasDetailedMetrics = Array.isArray(data.sentimentDetails) && data.sentimentDetails.length > 0;
  if (!hasDetailedMetrics) {
    diagnostics.push('No detailed metrics (sentimentDetails) available');
  } else {
    const engines = data.sentimentDetails!.map(m => m.engine);
    diagnostics.push(`Detailed metrics available for engines: ${engines.join(', ')}`);
  }

  // Check direct fields
  const hasDirectFields = typeof data.sentimentScore === 'number' || typeof data.sentimentChange === 'number';
  if (!hasDirectFields) {
    diagnostics.push('No direct sentiment fields available');
  } else {
    diagnostics.push(`Direct fields - score: ${data.sentimentScore}, change: ${data.sentimentChange}`);
  }

  const availableModels = hasTimeSeries ? extractAvailableModels(data.sentimentOverTime!) : [];
  
  return {
    isValid: hasTimeSeries || hasDetailedMetrics || hasDirectFields,
    hasTimeSeries,
    hasDetailedMetrics,
    hasDirectFields,
    availableModels,
    diagnostics,
  };
}

/**
 * Internal: Resolves sentiment from time series data (highest precedence)
 */
function resolveFromTimeSeries(
  data: SentimentDataContext,
  modelConfig: ModelFilterConfig,
  options: SentimentResolutionOptions,
  warnings: string[]
): SentimentValueResult {
  if (!data.sentimentOverTime || !Array.isArray(data.sentimentOverTime)) {
    warnings.push('No time series data available');
    return { 
      value: null, 
      source: 'time-series', 
      isAggregated: modelConfig.shouldShowAggregated,
      confidence: 0,
      warnings: []
    };
  }

  try {
    // Apply date filtering
    const dateFilteredData = applyDateRangeFilter(data.sentimentOverTime, options.dateRange);
    if (dateFilteredData.length === 0) {
      warnings.push(`No time series data within ${options.dateRange} date range`);
      return { 
        value: null, 
        source: 'time-series', 
        isAggregated: modelConfig.shouldShowAggregated,
        confidence: 0,
        warnings: []
      };
    }

    // Filter by model
    const modelFilteredData = filterHistoricalDataByModel(dateFilteredData, modelConfig);
    if (modelFilteredData.length === 0) {
      warnings.push(`No time series data for model "${modelConfig.queryParams.aiModelParam}"`);
      return { 
        value: null, 
        source: 'time-series', 
        isAggregated: modelConfig.shouldShowAggregated,
        confidence: 0,
        warnings: []
      };
    }

    // Remove duplicates and get most recent
    const uniqueData = deduplicateByDate(modelFilteredData);
    const mostRecent = uniqueData[uniqueData.length - 1];

    if (typeof mostRecent.sentimentScore === 'number' && !isNaN(mostRecent.sentimentScore)) {
      return {
        value: mostRecent.sentimentScore,
        source: 'time-series',
        lastUpdated: mostRecent.date,
        isAggregated: modelConfig.shouldShowAggregated,
        confidence: 0.95, // Highest confidence - this is real historical data
        warnings: [],
      };
    }

    warnings.push('Most recent time series point has invalid sentiment score');
    return { 
      value: null, 
      source: 'time-series', 
      isAggregated: modelConfig.shouldShowAggregated,
      confidence: 0,
      warnings: []
    };

  } catch (error) {
    warnings.push(`Error processing time series data: ${error}`);
    return { 
      value: null, 
      source: 'time-series', 
      isAggregated: modelConfig.shouldShowAggregated,
      confidence: 0,
      warnings: []
    };
  }
}

/**
 * Internal: Resolves sentiment from detailed metrics (fallback)
 */
function resolveFromDetailedMetrics(
  data: SentimentDataContext,
  modelConfig: ModelFilterConfig,
  warnings: string[]
): SentimentValueResult {
  if (!data.sentimentDetails || !Array.isArray(data.sentimentDetails)) {
    warnings.push('No detailed metrics data available');
    return { 
      value: null, 
      source: 'detailed-metrics', 
      isAggregated: modelConfig.shouldShowAggregated,
      confidence: 0,
      warnings: []
    };
  }

  try {
    // Filter metrics by model/engine
    const relevantMetrics = filterDetailedMetricsByModel(data.sentimentDetails, modelConfig);
    if (relevantMetrics.length === 0) {
      warnings.push(`No detailed metrics for engine "${modelConfig.queryParams.engineParam}"`);
      return { 
        value: null, 
        source: 'detailed-metrics', 
        isAggregated: modelConfig.shouldShowAggregated,
        confidence: 0,
        warnings: []
      };
    }

    // Look for metrics with overall sentiment or detailed ratings
    for (const metric of relevantMetrics) {
      // Try overall sentiment first
      if (typeof metric.value.overallSentiment === 'number' && !isNaN(metric.value.overallSentiment)) {
        return {
          value: metric.value.overallSentiment,
          source: 'detailed-metrics',
          isAggregated: modelConfig.shouldShowAggregated,
          confidence: 0.85, // High confidence - this is calculated by backend
          warnings: [],
        };
      }

      // Fallback to calculating from detailed ratings
      if (metric.value.ratings && Array.isArray(metric.value.ratings) && metric.value.ratings.length > 0) {
        const ratings = metric.value.ratings[0];
        const scores = [
          ratings.quality,
          ratings.priceValue,
          ratings.brandReputation,
          ratings.brandTrust,
          ratings.customerService,
        ].filter(score => typeof score === 'number' && !isNaN(score));

        if (scores.length > 0) {
          const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          warnings.push(`Calculated average from ${scores.length} detailed ratings`);
          return {
            value: average,
            source: 'detailed-metrics',
            isAggregated: modelConfig.shouldShowAggregated,
            confidence: 0.7, // Lower confidence - frontend calculation
            warnings: [],
          };
        }
      }
    }

    warnings.push('Detailed metrics found but no valid sentiment values');
    return { 
      value: null, 
      source: 'detailed-metrics', 
      isAggregated: modelConfig.shouldShowAggregated,
      confidence: 0,
      warnings: []
    };

  } catch (error) {
    warnings.push(`Error processing detailed metrics: ${error}`);
    return { 
      value: null, 
      source: 'detailed-metrics', 
      isAggregated: modelConfig.shouldShowAggregated,
      confidence: 0,
      warnings: []
    };
  }
}

/**
 * Internal: Resolves sentiment from direct field (legacy fallback)
 */
function resolveFromDirectField(
  data: SentimentDataContext,
  warnings: string[]
): SentimentValueResult {
  if (typeof data.sentimentScore === 'number' && !isNaN(data.sentimentScore)) {
    warnings.push('Using legacy direct sentiment score field');
    return {
      value: data.sentimentScore,
      source: 'direct-field',
      isAggregated: true, // Direct field is usually aggregated
      confidence: 0.6, // Lower confidence - unclear provenance
      warnings: [],
    };
  }

  return { 
    value: null, 
    source: 'direct-field', 
    isAggregated: true,
    confidence: 0,
    warnings: []
  };
}

/**
 * Debug utility to log sentiment data resolution process
 * Helps with troubleshooting data inconsistencies
 */
export function debugSentimentResolution(
  context: string,
  data: SentimentDataContext,
  options: Partial<SentimentResolutionOptions> = {}
): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[Sentiment Resolution Debug] ${context}`);
    
    const validation = validateSentimentData(data);
    console.log('Data Validation:', validation);
    
    const result = resolveCurrentSentimentValue(data, options);
    console.log('Resolution Result:', result);
    
    if (result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }
    
    console.groupEnd();
  }
}