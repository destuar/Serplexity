/**
 * @file dashboardData.ts
 * @description Comprehensive TypeScript interfaces for all dashboard data structures.
 * Provides type safety and clear contracts between components and data sources.
 * 
 * ARCHITECTURE NOTES:
 * - All numeric metrics can be null (representing unavailable data)
 * - Historical data arrays are guaranteed to be valid (empty if no data)
 * - Complex structures include metadata for debugging and validation
 * - Interfaces follow a hierarchical structure: Raw API -> Normalized -> Component-specific
 * 
 * @author Dashboard Team
 * @version 2.0.0 - Comprehensive type definitions for refactored architecture
 */

/**
 * Base interface for all dashboard data items with common metadata
 */
export interface BaseDashboardItem {
  /** Unique identifier for the item */
  id: string;
  /** When this item was last updated */
  lastUpdated?: string;
  /** Confidence level in the data (0-1 scale) */
  confidence?: number;
}

/**
 * Base interface for historical time series data
 */
export interface BaseHistoryItem {
  /** ISO date string */
  date: string;
  /** AI model identifier */
  aiModel: string;
}

/**
 * Date range filter options
 */
export type DateRangeFilter = '7d' | '30d' | '90d' | '1y';

/**
 * AI model identifiers used throughout the system
 */
export type AIModelId = 'all' | 'gpt-4' | 'gpt-3.5' | 'claude' | 'perplexity' | string;

/**
 * Engine identifiers for detailed metrics
 */
export type EngineId = 'serplexity-summary' | 'gpt-4' | 'gpt-3.5' | 'claude' | 'perplexity' | string;

// =============================================================================
// RAW API RESPONSE INTERFACES
// =============================================================================

/**
 * Raw dashboard data as received from the API (before transformation)
 * Fields can be strings, numbers, or null and need validation
 */
export interface RawDashboardData {
  // Core metrics - may need type coercion
  shareOfVoice?: number | string | null;
  shareOfVoiceChange?: number | string | null;
  averageInclusionRate?: number | string | null;
  averageInclusionChange?: number | string | null;
  averagePosition?: number | string | null;
  sentimentScore?: number | string | null;
  sentimentChange?: number | string | null;

  // Historical arrays - may contain invalid items
  shareOfVoiceHistory?: RawShareOfVoiceHistoryItem[];
  inclusionRateHistory?: RawInclusionRateHistoryItem[];
  sentimentOverTime?: RawSentimentHistoryItem[];

  // Complex structures - may be malformed
  sentimentDetails?: RawSentimentDetail[];
  topQuestions?: RawQuestion[];
  competitorRankings?: RawCompetitorRanking[];

  // Allow additional fields for extensibility
  [key: string]: any;
}

/**
 * Raw share of voice history item from API
 */
export interface RawShareOfVoiceHistoryItem {
  date: string;
  aiModel: string;
  shareOfVoice: number | string | null;
  inclusionRate?: number | string | null;
  [key: string]: any;
}

/**
 * Raw inclusion rate history item from API
 */
export interface RawInclusionRateHistoryItem {
  date: string;
  aiModel: string;
  inclusionRate: number | string | null;
  [key: string]: any;
}

/**
 * Raw sentiment history item from API
 */
export interface RawSentimentHistoryItem {
  date: string;
  aiModel: string;
  sentimentScore: number | string | null;
  [key: string]: any;
}

/**
 * Raw sentiment detail from API
 */
export interface RawSentimentDetail {
  id?: string;
  name?: string;
  engine?: string;
  confidence?: number | string | null;
  value?: {
    overallSentiment?: number | string | null;
    ratings?: Array<{
      quality?: number | string | null;
      priceValue?: number | string | null;
      brandReputation?: number | string | null;
      brandTrust?: number | string | null;
      customerService?: number | string | null;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Raw question from API
 */
export interface RawQuestion {
  id?: string;
  questionId?: string;
  question?: string;
  type?: string;
  position?: number | string | null;
  confidence?: number | string | null;
  source?: string;
  lastSeen?: string;
  [key: string]: any;
}

/**
 * Raw competitor ranking from API
 */
export interface RawCompetitorRanking {
  id?: string;
  competitorId?: string;
  name?: string;
  position?: number | string | null;
  shareOfVoice?: number | string | null;
  change?: number | string | null;
  logo?: string;
  category?: string;
  [key: string]: any;
}

// =============================================================================
// NORMALIZED DATA INTERFACES (Post-transformation)
// =============================================================================

/**
 * Normalized dashboard data with guaranteed types and validation
 * This is what components should expect to receive
 */
export interface NormalizedDashboardData {
  // Core metrics - guaranteed to be numbers or null
  shareOfVoice: number | null;
  shareOfVoiceChange: number | null;
  averageInclusionRate: number | null;
  averageInclusionChange: number | null;
  averagePosition: number | null;
  sentimentScore: number | null;
  sentimentChange: number | null;

  // Historical data - guaranteed to be valid arrays
  shareOfVoiceHistory: ShareOfVoiceHistoryItem[];
  inclusionRateHistory: InclusionRateHistoryItem[];
  sentimentOverTime: SentimentHistoryItem[];

  // Complex structures - validated and normalized
  sentimentDetails: SentimentDetail[];
  topQuestions: Question[];
  competitorRankings: CompetitorRanking[];

  // Metadata
  lastUpdated: string;
  dataQuality: DataQualityMetrics;
}

/**
 * Share of voice history item (normalized)
 */
export interface ShareOfVoiceHistoryItem extends BaseHistoryItem {
  shareOfVoice: number;
  inclusionRate?: number;
}

/**
 * Inclusion rate history item (normalized)
 */
export interface InclusionRateHistoryItem extends BaseHistoryItem {
  inclusionRate: number;
}

/**
 * Sentiment history item (normalized)
 */
export interface SentimentHistoryItem extends BaseHistoryItem {
  sentimentScore: number;
}

/**
 * Detailed sentiment metric (normalized)
 */
export interface SentimentDetail extends BaseDashboardItem {
  name: string;
  engine: EngineId;
  value: {
    overallSentiment?: number;
    ratings: SentimentRating[];
  };
  metadata: {
    sampleSize?: number;
    dataSource?: string;
  };
}

/**
 * Individual sentiment rating across categories
 */
export interface SentimentRating {
  quality: number;
  priceValue: number;
  brandReputation: number;
  brandTrust: number;
  customerService: number;
}

/**
 * Question item (normalized)
 */
export interface Question extends BaseDashboardItem {
  question: string;
  type: string;
  position?: number;
  metadata: {
    source?: string;
    lastSeen?: string;
  };
}

/**
 * Competitor ranking item (normalized)
 */
export interface CompetitorRanking extends BaseDashboardItem {
  name: string;
  position: number;
  shareOfVoice: number;
  change?: number;
  metadata: {
    logo?: string;
    category?: string;
  };
}

// =============================================================================
// CHART DATA INTERFACES
// =============================================================================

/**
 * Base interface for chart data points
 */
export interface BaseChartDataPoint {
  date: string;
  fullDate?: string;
  isZeroPoint?: boolean;
}

/**
 * Sentiment chart data point
 */
export interface SentimentChartDataPoint extends BaseChartDataPoint {
  score: number;
  // Dynamic model keys for breakdown mode
  [modelId: string]: any;
}

/**
 * Metrics chart data point (Share of Voice, Inclusion Rate)
 */
export interface MetricsChartDataPoint extends BaseChartDataPoint {
  shareOfVoice: number;
  inclusionRate?: number;
  // Dynamic model keys for breakdown mode
  [modelId: string]: any;
}

/**
 * Chart processing configuration
 */
export interface ChartProcessingOptions {
  dateRange: DateRangeFilter;
  selectedModel: AIModelId;
  showModelBreakdown: boolean;
  includeZeroPoint: boolean;
}

/**
 * Chart processing result
 */
export interface ChartProcessingResult<T extends BaseChartDataPoint> {
  chartData: T[];
  modelIds: string[];
  yAxisMax: number;
  ticks: number[];
  xAxisInterval: number;
}

// =============================================================================
// MODEL FILTERING INTERFACES
// =============================================================================

/**
 * Model query parameters for API calls
 */
export interface ModelQueryParams {
  aiModelParam: string;
  engineParam: string;
  isAllModels: boolean;
  displayName: string;
}

/**
 * Model filter configuration
 */
export interface ModelFilterConfig {
  selectedModel: AIModelId;
  queryParams: ModelQueryParams;
  shouldShowAggregated: boolean;
  supportsBreakdown: boolean;
}

// =============================================================================
// SENTIMENT RESOLUTION INTERFACES
// =============================================================================

/**
 * Sentiment data context for resolution
 */
export interface SentimentDataContext {
  sentimentScore?: number | null;
  sentimentChange?: number | null;
  sentimentDetails?: SentimentDetail[];
  sentimentOverTime?: SentimentHistoryItem[];
}

/**
 * Sentiment resolution options
 */
export interface SentimentResolutionOptions {
  selectedModel: AIModelId;
  dateRange: DateRangeFilter;
  preferAggregated: boolean;
  minConfidence: number;
}

/**
 * Sentiment value result with metadata
 */
export interface SentimentValueResult {
  value: number | null;
  source: 'time-series' | 'detailed-metrics' | 'direct-field' | 'unavailable';
  lastUpdated?: string;
  isAggregated: boolean;
  confidence: number;
  warnings: string[];
}

/**
 * Sentiment change result
 */
export interface SentimentChangeResult {
  change: number | null;
  source: 'api-provided' | 'calculated' | 'unavailable';
  confidence: number;
}

// =============================================================================
// DATA QUALITY & VALIDATION INTERFACES
// =============================================================================

/**
 * Data quality metrics for monitoring and debugging
 */
export interface DataQualityMetrics {
  totalFields: number;
  validFields: number;
  missingFields: string[];
  invalidFields: string[];
  warnings: string[];
  confidence: number;
}

/**
 * Data transformation options
 */
export interface TransformationOptions {
  strictMode: boolean;
  includeDebugInfo: boolean;
  minConfidence: number;
  defaultValues: Partial<Record<string, number>>;
}

/**
 * Data validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// =============================================================================
// COMPONENT PROP INTERFACES
// =============================================================================

/**
 * Base props for dashboard cards
 */
export interface BaseDashboardCardProps {
  selectedModel?: AIModelId;
  className?: string;
}

/**
 * Props for chart components
 */
export interface ChartComponentProps extends BaseDashboardCardProps {
  showModelBreakdown?: boolean;
  onToggleBreakdown?: () => void;
}

/**
 * Props for metric display components
 */
export interface MetricDisplayProps extends BaseDashboardCardProps {
  onSeeMore?: () => void;
  compact?: boolean;
}

// =============================================================================
// DASHBOARD CONTEXT INTERFACES
// =============================================================================

/**
 * Dashboard filter state
 */
export interface DashboardFilters {
  dateRange: DateRangeFilter;
  aiModel: AIModelId;
  [key: string]: any;
}

/**
 * Dashboard context state
 */
export interface DashboardContextState {
  data: NormalizedDashboardData | null;
  filters: DashboardFilters;
  loading: boolean;
  refreshing: boolean;
  filterLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  hasReport: boolean | null;
}

/**
 * Dashboard context actions
 */
export interface DashboardContextActions {
  updateFilters: (updates: Partial<DashboardFilters>) => void;
  refreshData: () => Promise<void>;
  clearError: () => void;
}

// =============================================================================
// UTILITY TYPE HELPERS
// =============================================================================

/**
 * Extract the value type from a metric
 */
export type MetricValue<T> = T extends { value: infer V } ? V : never;

/**
 * Make all fields optional for partial updates
 */
export type PartialDashboardData = Partial<NormalizedDashboardData>;

/**
 * Extract array element type
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Ensure a type is not null or undefined
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Create a type with required fields
 */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

// Legacy interfaces removed - migration complete

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if an item has an aiModel field
 */
export function hasAiModelField(item: any): item is { aiModel: string } {
  return item && typeof item.aiModel === 'string';
}

/**
 * Type guard to check if an item has an engine field
 */
export function hasEngineField(item: any): item is { engine: string } {
  return item && typeof item.engine === 'string';
}

/**
 * Type guard to check if data is normalized
 */
export function isNormalizedDashboardData(data: any): data is NormalizedDashboardData {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.shareOfVoiceHistory) &&
    Array.isArray(data.sentimentOverTime) &&
    data.dataQuality &&
    typeof data.dataQuality.confidence === 'number'
  );
}

/**
 * Type guard to check if a value is a valid date range
 */
export function isValidDateRange(value: any): value is DateRangeFilter {
  return typeof value === 'string' && ['7d', '30d', '90d', '1y'].includes(value);
}

/**
 * Type guard to check if a value is a valid numeric metric
 */
export function isValidNumericMetric(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}