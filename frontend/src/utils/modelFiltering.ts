/**
 * @file modelFiltering.ts
 * @description Centralized model filtering utilities to ensure consistent handling
 * of model selection across all dashboard components.
 * 
 * Eliminates the confusion between 'all', 'serplexity-summary', and specific model IDs
 * that was causing data inconsistencies throughout the application.
 * 
 * Key responsibilities:
 * - Standardized model selection mapping
 * - Consistent API parameter generation
 * - Model display name resolution
 * - Engine field vs aiModel field handling
 * 
 * @author Dashboard Team
 * @version 2.0.0 - Unified from scattered component logic
 */

import { getModelDisplayName as getDashboardModelDisplayName } from '../types/dashboard';

/**
 * Model query parameters for different API endpoints
 * Handles the inconsistency between APIs that expect different field names
 */
export interface ModelQueryParams {
  /** For historical data APIs (sentimentOverTime, shareOfVoiceHistory) */
  aiModelParam: string;
  /** For detailed metrics APIs (sentimentDetails) */
  engineParam: string;
  /** Whether this represents the 'all models' selection */
  isAllModels: boolean;
  /** Human-readable display name */
  displayName: string;
}

/**
 * Model filter configuration for component logic
 */
export interface ModelFilterConfig {
  /** The raw selected model value from UI */
  selectedModel: string;
  /** Resolved query parameters for API calls */
  queryParams: ModelQueryParams;
  /** Whether component should show aggregated view */
  shouldShowAggregated: boolean;
  /** Whether component supports model breakdown */
  supportsBreakdown: boolean;
}

/**
 * Reserved model identifiers used throughout the system
 */
export const MODEL_IDENTIFIERS = {
  /** UI selection for "all models" */
  ALL_MODELS_UI: 'all',
  /** API parameter for aggregated historical data */
  ALL_MODELS_API: 'all',
  /** Engine identifier for aggregated detailed metrics */
  SUMMARY_ENGINE: 'serplexity-summary',
} as const;

/**
 * Maps UI model selection to appropriate API parameters
 * Centralizes the logic that was inconsistently implemented across components
 * 
 * @param selectedModel - Model selection from UI ('all' or specific model ID)
 * @returns Standardized query parameters for all API endpoints
 * 
 * @example
 * ```typescript
 * // For "all models" selection
 * const params = getModelQueryParams('all');
 * // Returns: {
 * //   aiModelParam: 'all',
 * //   engineParam: 'serplexity-summary', 
 * //   isAllModels: true,
 * //   displayName: 'All Models'
 * // }
 * 
 * // For specific model selection
 * const params = getModelQueryParams('gpt-4');
 * // Returns: {
 * //   aiModelParam: 'gpt-4',
 * //   engineParam: 'gpt-4',
 * //   isAllModels: false, 
 * //   displayName: 'GPT-4'
 * // }
 * ```
 */
export function getModelQueryParams(selectedModel: string): ModelQueryParams {
  const isAllModels = selectedModel === MODEL_IDENTIFIERS.ALL_MODELS_UI;
  
  return {
    aiModelParam: isAllModels ? MODEL_IDENTIFIERS.ALL_MODELS_API : selectedModel,
    engineParam: isAllModels ? MODEL_IDENTIFIERS.SUMMARY_ENGINE : selectedModel,
    isAllModels,
    displayName: isAllModels ? 'All Models' : getModelDisplayName(selectedModel),
  };
}

/**
 * Creates complete filter configuration for dashboard components
 * Provides all necessary information for consistent model filtering
 * 
 * @param selectedModel - Model selection from UI
 * @param supportsBreakdown - Whether the component supports model breakdown mode
 * @returns Complete filter configuration
 */
export function createModelFilterConfig(
  selectedModel: string,
  supportsBreakdown: boolean = false
): ModelFilterConfig {
  const queryParams = getModelQueryParams(selectedModel);
  
  return {
    selectedModel,
    queryParams,
    shouldShowAggregated: queryParams.isAllModels,
    supportsBreakdown,
  };
}

/**
 * Filters historical data array by model selection
 * Handles both single model and "all models" filtering consistently
 * 
 * @param data - Array of historical data items with aiModel field
 * @param modelConfig - Model filter configuration
 * @returns Filtered data array
 * 
 * @example
 * ```typescript
 * const config = createModelFilterConfig('gpt-4');
 * const filtered = filterHistoricalDataByModel(sentimentHistory, config);
 * ```
 */
export function filterHistoricalDataByModel<T extends { aiModel: string }>(
  data: T[],
  modelConfig: ModelFilterConfig
): T[] {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  const targetModel = modelConfig.queryParams.aiModelParam;
  let filteredData = data.filter(item => item.aiModel === targetModel);
  
  // Fallback mechanism: if no data for target model, use first available
  // This prevents empty charts when model data is sparse
  if (filteredData.length === 0 && data.length > 0) {
    console.warn(
      `[modelFiltering] No data found for model "${targetModel}", falling back to "${data[0].aiModel}"`
    );
    const fallbackModel = data[0].aiModel;
    filteredData = data.filter(item => item.aiModel === fallbackModel);
  }
  
  return filteredData;
}

/**
 * Filters detailed metrics by model selection
 * Handles the engine field used in sentimentDetails and similar structures
 * 
 * @param metrics - Array of metric objects with engine field
 * @param modelConfig - Model filter configuration
 * @returns Filtered metrics array
 */
export function filterDetailedMetricsByModel<T extends { engine: string }>(
  metrics: T[],
  modelConfig: ModelFilterConfig
): T[] {
  if (!metrics || !Array.isArray(metrics)) {
    return [];
  }
  
  const targetEngine = modelConfig.queryParams.engineParam;
  return metrics.filter(metric => metric.engine === targetEngine);
}

/**
 * Extracts available model IDs from historical data
 * Used for model breakdown mode to determine which models to display
 * 
 * @param data - Array of historical data items
 * @param excludeAggregated - Whether to exclude the 'all' aggregated model
 * @returns Array of unique model IDs
 */
export function extractAvailableModels<T extends { aiModel: string }>(
  data: T[],
  excludeAggregated: boolean = true
): string[] {
  if (!data || !Array.isArray(data)) {
    return [];
  }
  
  const modelIds = new Set(
    data
      .map(item => item.aiModel)
      .filter(modelId => !excludeAggregated || modelId !== MODEL_IDENTIFIERS.ALL_MODELS_API)
  );
  
  return Array.from(modelIds).sort();
}

/**
 * Validates model selection against available data
 * Prevents runtime errors when selected model has no data
 * 
 * @param selectedModel - Model ID to validate
 * @param availableModels - Array of available model IDs
 * @returns Validation result with fallback suggestions
 */
export function validateModelSelection(
  selectedModel: string,
  availableModels: string[]
): {
  isValid: boolean;
  fallbackModel?: string;
  warning?: string;
} {
  // 'all' is always valid
  if (selectedModel === MODEL_IDENTIFIERS.ALL_MODELS_UI) {
    return { isValid: true };
  }
  
  // Check if selected model exists in available data
  if (availableModels.includes(selectedModel)) {
    return { isValid: true };
  }
  
  // Suggest fallback
  const fallbackModel = availableModels.length > 0 
    ? availableModels[0]
    : MODEL_IDENTIFIERS.ALL_MODELS_UI;
    
  return {
    isValid: false,
    fallbackModel,
    warning: `Model "${selectedModel}" not found in data. Available models: ${availableModels.join(', ')}`,
  };
}

/**
 * Model display name resolver
 * TODO: This should eventually be moved to a centralized model configuration
 * Currently using the existing getModelDisplayName function for compatibility
 */
export function getModelDisplayName(modelId: string): string {
  // Use the imported function to maintain compatibility
  try {
    return getDashboardModelDisplayName(modelId);
  } catch {
    // Fallback display name mapping if the import fails
    const displayNames: Record<string, string> = {
      'gpt-4': 'GPT-4',
      'gpt-3.5': 'GPT-3.5',
      'claude': 'Claude',
      'perplexity': 'Perplexity',
      'all': 'All Models',
    };
    
    return displayNames[modelId] || modelId.charAt(0).toUpperCase() + modelId.slice(1);
  }
}

/**
 * Debug utility to log model filtering decisions
 * Helps with troubleshooting data inconsistencies
 * 
 * @param context - Description of where this is being called from
 * @param selectedModel - Original model selection
 * @param config - Generated filter configuration
 * @param dataLength - Length of data being filtered (optional)
 */
export function debugModelFiltering(
  context: string,
  selectedModel: string,
  config: ModelFilterConfig,
  dataLength?: number
): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`[Model Filtering Debug] ${context}`);
    console.log('Selected Model:', selectedModel);
    console.log('Query Params:', config.queryParams);
    console.log('Should Show Aggregated:', config.shouldShowAggregated);
    if (dataLength !== undefined) {
      console.log('Data Length:', dataLength);
    }
    console.groupEnd();
  }
}

/**
 * Type guard to check if data item has aiModel field
 * Useful for generic filtering functions
 */
export function hasAiModelField(item: unknown): item is { aiModel: string } {
  return item !== null && typeof item === 'object' && 'aiModel' in item && typeof (item as { aiModel: unknown }).aiModel === 'string';
}

/**
 * Type guard to check if metric has engine field
 * Useful for generic filtering functions
 */
export function hasEngineField(item: unknown): item is { engine: string } {
  return item !== null && typeof item === 'object' && 'engine' in item && typeof (item as { engine: unknown }).engine === 'string';
}