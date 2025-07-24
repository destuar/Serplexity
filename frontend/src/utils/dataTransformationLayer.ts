/**
 * @file dataTransformationLayer.ts
 * @description Centralized data transformation layer for consistent API response handling.
 * Provides standardized transformation, validation, and normalization of data from
 * various backend endpoints before it reaches dashboard components.
 * 
 * Key responsibilities:
 * - API response validation and sanitization
 * - Data format normalization across different endpoints
 * - Type-safe data transformation with error handling
 * - Consistent handling of missing or malformed data
 * - Centralized business logic for data calculations
 * 
 * @author Dashboard Team
 * @version 2.0.0 - Extracted from scattered component logic
 */

import { 
  SentimentHistoryItem, 
  ShareOfVoiceHistoryItem,
  parseApiDate 
} from './chartDataProcessing';

/**
 * Raw API response types - what we actually receive from backend
 */
export interface RawDashboardApiResponse {
  shareOfVoice?: number | string | null;
  shareOfVoiceChange?: number | string | null;
  averageInclusionRate?: number | string | null;
  averageInclusionChange?: number | string | null;
  averagePosition?: number | string | null;
  sentimentScore?: number | string | null;
  sentimentChange?: number | string | null;
  shareOfVoiceHistory?: Array<Record<string, unknown>>;
  sentimentOverTime?: Array<Record<string, unknown>>;
  sentimentDetails?: Array<Record<string, unknown>>;
  topQuestions?: Array<Record<string, unknown>>;
  competitorRankings?: Array<Record<string, unknown>>;
  [key: string]: unknown; // Allow for additional fields
}

/**
 * Normalized dashboard data - what components should expect
 */
export interface NormalizedDashboardData {
  // Core metrics (guaranteed to be numbers or null)
  shareOfVoice: number | null;
  shareOfVoiceChange: number | null;
  averageInclusionRate: number | null;
  averageInclusionChange: number | null;
  averagePosition: number | null;
  sentimentScore: number | null;
  sentimentChange: number | null;
  
  // Historical data (guaranteed to be valid arrays)
  shareOfVoiceHistory: ShareOfVoiceHistoryItem[];
  sentimentOverTime: SentimentHistoryItem[];
  
  // Complex data structures
  sentimentDetails: NormalizedSentimentDetail[];
  topQuestions: NormalizedQuestion[];
  competitorRankings: NormalizedCompetitorRanking[];
  
  // Metadata
  lastUpdated: string;
  dataQuality: DataQualityMetrics;
}

/**
 * Normalized sentiment detail structure
 */
export interface NormalizedSentimentDetail {
  id: string;
  name: string;
  engine: string;
  confidence: number;
  value: {
    overallSentiment?: number;
    ratings: Array<{
      quality: number;
      priceValue: number;
      brandReputation: number;
      brandTrust: number;
      customerService: number;
    }>;
  };
  metadata: {
    lastUpdated?: string;
    sampleSize?: number;
  };
}

/**
 * Normalized question structure
 */
export interface NormalizedQuestion {
  id: string;
  question: string;
  type: string;
  position?: number;
  confidence?: number;
  metadata: {
    source?: string;
    lastSeen?: string;
  };
}

/**
 * Normalized competitor ranking structure
 */
export interface NormalizedCompetitorRanking {
  id: string;
  name: string;
  position: number;
  shareOfVoice: number;
  change?: number;
  metadata: {
    logo?: string;
    category?: string;
  };
}

/**
 * Data quality metrics for debugging and monitoring
 */
export interface DataQualityMetrics {
  totalFields: number;
  validFields: number;
  missingFields: string[];
  invalidFields: string[];
  warnings: string[];
  confidence: number; // 0-1 scale
}

/**
 * Transformation options for customizing behavior
 */
export interface TransformationOptions {
  /** Strict mode throws errors on invalid data, loose mode logs warnings */
  strictMode: boolean;
  /** Whether to include debug information in output */
  includeDebugInfo: boolean;
  /** Minimum confidence threshold for including data */
  minConfidence: number;
  /** Default values for missing numeric fields */
  defaultValues: Partial<Record<string, number>>;
}

/**
 * Default transformation options
 */
const DEFAULT_TRANSFORMATION_OPTIONS: TransformationOptions = {
  strictMode: false,
  includeDebugInfo: process.env.NODE_ENV === 'development',
  minConfidence: 0.1, // Very permissive by default
  defaultValues: {
    shareOfVoice: null,
    averageInclusionRate: null,
    averagePosition: null,
    sentimentScore: null,
  },
};

/**
 * Main transformation function - converts raw API response to normalized data
 * 
 * @param rawData - Raw API response data
 * @param options - Transformation configuration options
 * @returns Normalized dashboard data with quality metrics
 * 
 * @example
 * ```typescript
 * const apiResponse = await fetchDashboardData();
 * const normalizedData = transformDashboardData(apiResponse, {
 *   strictMode: true,
 *   minConfidence: 0.7
 * });
 * 
 * if (normalizedData.dataQuality.confidence >= 0.8) {
 *   displayDashboard(normalizedData);
 * } else {
 *   showDataQualityWarning(normalizedData.dataQuality.warnings);
 * }
 * ```
 */
export function transformDashboardData(
  rawData: RawDashboardApiResponse,
  options: Partial<TransformationOptions> = {}
): NormalizedDashboardData {
  const opts = { ...DEFAULT_TRANSFORMATION_OPTIONS, ...options };
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  try {
    // Transform core numeric metrics
    const coreMetrics = transformCoreMetrics(rawData, opts, warnings, missingFields, invalidFields);
    
    // Transform historical data arrays
    const historicalData = transformHistoricalData(rawData, opts, warnings, invalidFields);
    
    // Transform complex structures
    const complexData = transformComplexStructures(rawData, opts, warnings, invalidFields);
    
    // Calculate data quality metrics
    const dataQuality = calculateDataQuality(rawData, warnings, missingFields, invalidFields);
    
    const result: NormalizedDashboardData = {
      ...coreMetrics,
      ...historicalData,
      ...complexData,
      lastUpdated: new Date().toISOString(),
      dataQuality,
    };

    if (opts.includeDebugInfo) {
      console.log('[DataTransformation] Normalized dashboard data:', result);
    }

    return result;

  } catch (error) {
    if (opts.strictMode) {
      throw new Error(`Data transformation failed: ${error}`);
    }
    
    console.error('[DataTransformation] Failed to transform data:', error);
    
    // Return minimal valid structure
    return createEmptyDashboardData([`Transformation failed: ${error}`]);
  }
}

/**
 * Transforms core numeric metrics with validation and type coercion
 */
function transformCoreMetrics(
  rawData: RawDashboardApiResponse,
  options: TransformationOptions,
  warnings: string[],
  missingFields: string[],
  invalidFields: string[]
): Pick<NormalizedDashboardData, 'shareOfVoice' | 'shareOfVoiceChange' | 'averageInclusionRate' | 'averageInclusionChange' | 'averagePosition' | 'sentimentScore' | 'sentimentChange'> {
  
  const coreFields = [
    'shareOfVoice',
    'shareOfVoiceChange', 
    'averageInclusionRate',
    'averageInclusionChange',
    'averagePosition',
    'sentimentScore',
    'sentimentChange'
  ] as const;

  const result: Record<string, number | null> = {};

  for (const field of coreFields) {
    const rawValue = rawData[field];
    const normalizedValue = normalizeNumericValue(rawValue, field, warnings, missingFields, invalidFields);
    
    // Apply default values if configured
    result[field] = normalizedValue ?? options.defaultValues[field] ?? null;
  }

  return result;
}

/**
 * Transforms historical data arrays with validation and sanitization
 */
function transformHistoricalData(
  rawData: RawDashboardApiResponse,
  options: TransformationOptions,
  warnings: string[],
  invalidFields: string[]
): Pick<NormalizedDashboardData, 'shareOfVoiceHistory' | 'sentimentOverTime'> {
  
  // Transform share of voice history
  const shareOfVoiceHistory = normalizeHistoricalArray(
    rawData.shareOfVoiceHistory,
    'shareOfVoiceHistory',
    transformShareOfVoiceHistoryItem,
    warnings,
    invalidFields
  );

  // Transform sentiment over time
  const sentimentOverTime = normalizeHistoricalArray(
    rawData.sentimentOverTime,
    'sentimentOverTime', 
    transformSentimentHistoryItem,
    warnings,
    invalidFields
  );

  return {
    shareOfVoiceHistory,
    sentimentOverTime,
  };
}

/**
 * Transforms complex data structures (sentimentDetails, questions, rankings)
 */
function transformComplexStructures(
  rawData: RawDashboardApiResponse,
  options: TransformationOptions,
  warnings: string[],
  invalidFields: string[]
): Pick<NormalizedDashboardData, 'sentimentDetails' | 'topQuestions' | 'competitorRankings'> {
  
  // Transform sentiment details
  const sentimentDetails = normalizeComplexArray(
    rawData.sentimentDetails,
    'sentimentDetails',
    transformSentimentDetail,
    warnings,
    invalidFields
  );

  // Transform top questions
  const topQuestions = normalizeComplexArray(
    rawData.topQuestions,
    'topQuestions',
    transformQuestion,
    warnings,
    invalidFields
  );

  // Transform competitor rankings
  const competitorRankings = normalizeComplexArray(
    rawData.competitorRankings,
    'competitorRankings',
    transformCompetitorRanking,
    warnings,
    invalidFields
  );

  return {
    sentimentDetails,
    topQuestions,
    competitorRankings,
  };
}

/**
 * Normalizes a numeric value with comprehensive validation
 */
function normalizeNumericValue(
  rawValue: unknown,
  fieldName: string,
  warnings: string[],
  missingFields: string[],
  invalidFields: string[]
): number | null {
  // Handle null/undefined
  if (rawValue === null || rawValue === undefined) {
    missingFields.push(fieldName);
    return null;
  }

  // Handle numeric values
  if (typeof rawValue === 'number') {
    if (isNaN(rawValue) || !isFinite(rawValue)) {
      invalidFields.push(`${fieldName} (NaN or Infinite)`);
      warnings.push(`Field ${fieldName} contains invalid number: ${rawValue}`);
      return null;
    }
    return rawValue;
  }

  // Handle string values (attempt conversion)
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    
    // Handle empty strings
    if (trimmed === '') {
      missingFields.push(`${fieldName} (empty string)`);
      return null;
    }
    
    // Attempt numeric conversion
    const parsed = Number(trimmed);
    if (isNaN(parsed) || !isFinite(parsed)) {
      invalidFields.push(`${fieldName} (unparseable string: "${trimmed}")`);
      warnings.push(`Could not parse ${fieldName} as number: "${trimmed}"`);
      return null;
    }
    
    warnings.push(`Converted string to number for ${fieldName}: "${trimmed}" -> ${parsed}`);
    return parsed;
  }

  // Handle other types
  invalidFields.push(`${fieldName} (unexpected type: ${typeof rawValue})`);
  warnings.push(`Unexpected type for ${fieldName}: ${typeof rawValue}`);
  return null;
}

/**
 * Normalizes historical data arrays with item-level validation
 */
function normalizeHistoricalArray<T>(
  rawArray: unknown,
  fieldName: string,
  transformer: (item: Record<string, unknown>, index: number) => T | null,
  warnings: string[],
  invalidFields: string[]
): T[] {
  if (!Array.isArray(rawArray)) {
    if (rawArray !== null && rawArray !== undefined) {
      invalidFields.push(`${fieldName} (not an array)`);
      warnings.push(`Expected array for ${fieldName}, got ${typeof rawArray}`);
    }
    return [];
  }

  const validItems: T[] = [];
  let invalidCount = 0;

  rawArray.forEach((item, index) => {
    try {
      const transformed = transformer(item, index);
      if (transformed !== null) {
        validItems.push(transformed);
      } else {
        invalidCount++;
      }
    } catch (error) {
      invalidCount++;
      warnings.push(`Failed to transform ${fieldName}[${index}]: ${error}`);
    }
  });

  if (invalidCount > 0) {
    warnings.push(`${fieldName}: ${invalidCount} invalid items out of ${rawArray.length} total`);
  }

  return validItems;
}

/**
 * Normalizes complex structure arrays with item-level validation
 */
function normalizeComplexArray<T>(
  rawArray: unknown,
  fieldName: string,
  transformer: (item: Record<string, unknown>, index: number) => T | null,
  warnings: string[],
  invalidFields: string[]
): T[] {
  return normalizeHistoricalArray(rawArray, fieldName, transformer, warnings, invalidFields);
}

/**
 * Transforms a single share of voice history item
 */
function transformShareOfVoiceHistoryItem(item: Record<string, unknown>, index: number): ShareOfVoiceHistoryItem | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const date = parseApiDate(item.date);
  if (!date) {
    return null;
  }

  const shareOfVoice = normalizeNumericValue(item.shareOfVoice, `shareOfVoice[${index}]`, [], [], []);
  const inclusionRate = normalizeNumericValue(item.inclusionRate, `inclusionRate[${index}]`, [], [], []);
  const aiModel = typeof item.aiModel === 'string' ? item.aiModel : 'unknown';

  if (shareOfVoice === null) {
    return null; // shareOfVoice is required
  }

  return {
    date: item.date,
    aiModel,
    shareOfVoice,
    inclusionRate: inclusionRate ?? undefined,
  };
}

/**
 * Transforms a single sentiment history item
 */
function transformSentimentHistoryItem(item: Record<string, unknown>, index: number): SentimentHistoryItem | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const date = parseApiDate(item.date);
  if (!date) {
    return null;
  }

  const sentimentScore = normalizeNumericValue(item.sentimentScore, `sentimentScore[${index}]`, [], [], []);
  const aiModel = typeof item.aiModel === 'string' ? item.aiModel : 'unknown';

  if (sentimentScore === null) {
    return null; // sentimentScore is required
  }

  return {
    date: item.date,
    aiModel,
    sentimentScore,
  };
}

/**
 * Transforms a single sentiment detail item
 */
function transformSentimentDetail(item: Record<string, unknown>, index: number): NormalizedSentimentDetail | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = item.id || `sentiment-detail-${index}`;
  const name = typeof item.name === 'string' ? item.name : 'Unknown';
  const engine = typeof item.engine === 'string' ? item.engine : 'unknown';
  const confidence = normalizeNumericValue(item.confidence, `confidence[${index}]`, [], [], []) ?? 0.5;

  // Transform value object
  const value = item.value || {};
  const overallSentiment = normalizeNumericValue(value.overallSentiment, `overallSentiment[${index}]`, [], [], []);
  
  // Transform ratings array
  const ratings = Array.isArray(value.ratings) ? value.ratings : [{}];
  const normalizedRatings = ratings.map((rating: Record<string, unknown>) => ({
    quality: normalizeNumericValue(rating?.quality, `rating.quality[${index}]`, [], [], []) ?? 0,
    priceValue: normalizeNumericValue(rating?.priceValue, `rating.priceValue[${index}]`, [], [], []) ?? 0,
    brandReputation: normalizeNumericValue(rating?.brandReputation, `rating.brandReputation[${index}]`, [], [], []) ?? 0,
    brandTrust: normalizeNumericValue(rating?.brandTrust, `rating.brandTrust[${index}]`, [], [], []) ?? 0,
    customerService: normalizeNumericValue(rating?.customerService, `rating.customerService[${index}]`, [], [], []) ?? 0,
  }));

  return {
    id,
    name,
    engine,
    confidence,
    value: {
      overallSentiment,
      ratings: normalizedRatings,
    },
    metadata: {
      lastUpdated: item.lastUpdated,
      sampleSize: normalizeNumericValue(item.sampleSize, `sampleSize[${index}]`, [], [], []),
    },
  };
}

/**
 * Transforms a single question item
 */
function transformQuestion(item: Record<string, unknown>, index: number): NormalizedQuestion | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = item.id || item.questionId || `question-${index}`;
  const question = typeof item.question === 'string' ? item.question : '';
  const type = typeof item.type === 'string' ? item.type : 'unknown';

  if (!question.trim()) {
    return null; // question text is required
  }

  return {
    id,
    question,
    type,
    position: normalizeNumericValue(item.position, `position[${index}]`, [], [], []),
    confidence: normalizeNumericValue(item.confidence, `confidence[${index}]`, [], [], []),
    metadata: {
      source: item.source,
      lastSeen: item.lastSeen,
    },
  };
}

/**
 * Transforms a single competitor ranking item
 */
function transformCompetitorRanking(item: Record<string, unknown>, index: number): NormalizedCompetitorRanking | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = item.id || item.competitorId || `competitor-${index}`;
  const name = typeof item.name === 'string' ? item.name : 'Unknown';
  const position = normalizeNumericValue(item.position, `position[${index}]`, [], [], []);
  const shareOfVoice = normalizeNumericValue(item.shareOfVoice, `shareOfVoice[${index}]`, [], [], []);

  if (position === null || shareOfVoice === null) {
    return null; // Both position and shareOfVoice are required
  }

  return {
    id,
    name,
    position,
    shareOfVoice,
    change: normalizeNumericValue(item.change, `change[${index}]`, [], [], []),
    metadata: {
      logo: item.logo,
      category: item.category,
    },
  };
}

/**
 * Calculates overall data quality metrics
 */
function calculateDataQuality(
  rawData: RawDashboardApiResponse,
  warnings: string[],
  missingFields: string[],
  invalidFields: string[]
): DataQualityMetrics {
  const totalFields = Object.keys(rawData).length;
  const validFields = totalFields - missingFields.length - invalidFields.length;
  const confidence = totalFields > 0 ? validFields / totalFields : 0;

  return {
    totalFields,
    validFields,
    missingFields,
    invalidFields,
    warnings,
    confidence,
  };
}

/**
 * Creates an empty dashboard data structure for error cases
 */
function createEmptyDashboardData(warnings: string[] = []): NormalizedDashboardData {
  return {
    shareOfVoice: null,
    shareOfVoiceChange: null,
    averageInclusionRate: null,
    averageInclusionChange: null,
    averagePosition: null,
    sentimentScore: null,
    sentimentChange: null,
    shareOfVoiceHistory: [],
    sentimentOverTime: [],
    sentimentDetails: [],
    topQuestions: [],
    competitorRankings: [],
    lastUpdated: new Date().toISOString(),
    dataQuality: {
      totalFields: 0,
      validFields: 0,
      missingFields: [],
      invalidFields: [],
      warnings,
      confidence: 0,
    },
  };
}

/**
 * Validates transformed data structure
 * Useful for testing and debugging
 */
export function validateNormalizedData(data: NormalizedDashboardData): {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
} {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Check required structure
  if (!data.dataQuality) {
    errors.push('Missing dataQuality field');
  }

  if (!Array.isArray(data.shareOfVoiceHistory)) {
    errors.push('shareOfVoiceHistory must be an array');
  }

  if (!Array.isArray(data.sentimentOverTime)) {
    errors.push('sentimentOverTime must be an array');
  }

  // Check data quality
  if (data.dataQuality?.confidence < 0.5) {
    suggestions.push('Data quality is low - consider refreshing from source');
  }

  if (data.dataQuality?.warnings.length > 0) {
    suggestions.push(`${data.dataQuality.warnings.length} data quality warnings present`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions,
  };
}