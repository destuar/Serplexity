/**
 * @file pydanticProviders.ts
 * @description Provider configuration for PydanticAI integration with web search capabilities
 * 
 * This file establishes the bridge between our existing environment configuration
 * and PydanticAI's provider system. It ensures type safety, proper error handling,
 * and maintains backward compatibility with our current API key management.
 * 
 * @architecture
 * - Validates API keys at startup to fail fast
 * - Provides fallback configurations for resilient operation
 * - Supports dynamic provider switching based on availability
 * - Maintains audit trail of provider usage
 * - Tracks web search usage and costs across providers
 * - Manages provider-specific web search capabilities
 * 
 * @web_search_capabilities
 * - OpenAI: Responses API web_search tool ($10/1K searches)
 * - Anthropic: Native web_search tool ($10/1K searches)
 * - Gemini: Google Search grounding tool ($35/1K searches)
 * - Perplexity: Built-in web search (included in pricing)
 * 
 * @dependencies
 * - env: Environment configuration with API keys
 * - logger: Centralized logging system
 * - logfire: Performance and cost tracking
 * 
 * @exports
 * - PydanticProviderConfig: Type-safe provider configuration interface
 * - WebSearchConfig: Web search configuration interface
 * - PYDANTIC_PROVIDERS: Validated provider configurations
 * - PydanticProviderManager: Provider management class
 * - validateProviderAvailability: Provider health check function
 * - getWebSearchEnabledProviders: Get providers with web search support
 * - getMostCostEffectiveWebSearchProvider: Get cheapest web search provider
 * - calculateWebSearchCost: Calculate estimated web search costs
 * - supportsWebSearch: Check if provider supports web search
 */

import env from './env';
import logger from '../utils/logger';
import { trackLLMUsage, trackPerformance, trackError } from './logfire';
import { LLM_PRICING, CostCalculator, CostReporter } from './llmPricing';
import { MODELS, ModelTask } from './models';

/**
 * Web search configuration for a provider
 */
export interface WebSearchConfig {
  readonly enabled: boolean;
  readonly toolName: string;
  readonly costPer1000Searches: number; // USD per 1000 searches
  readonly maxResultsPerSearch: number;
  readonly timeoutMs: number;
  readonly supportsStreaming: boolean;
  readonly requiresTools: boolean; // False for built-in search like Perplexity
}

/**
 * Provider configuration interface with comprehensive settings
 */
export interface PydanticProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly enabled: boolean;
  readonly priority: number; // Lower number = higher priority
  readonly capabilities: readonly string[];
  readonly webSearch?: WebSearchConfig;
  readonly rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    searchesPerMinute?: number;
  };
}

/**
 * Provider health status for monitoring
 */
export interface ProviderHealthStatus {
  readonly id: string;
  readonly available: boolean;
  readonly lastChecked: Date;
  readonly errorCount: number;
  readonly avgResponseTime: number;
  readonly statusMessage?: string;
  readonly webSearchAvailable: boolean;
  readonly totalSearches: number;
  readonly searchErrorCount: number;
}

/**
 * Validated provider configurations with fallback priorities
 * These configurations are validated at startup to ensure reliability
 */
export const PYDANTIC_PROVIDERS: ReadonlyArray<PydanticProviderConfig> = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiKey: env.OPENAI_API_KEY,
    baseUrl: 'https://api.openai.com/v1',
    timeout: 30000,
    maxRetries: 3,
    enabled: true,
    priority: 1,
    capabilities: ['chat', 'completion', 'structured_output', 'function_calling', 'web_search'],
    webSearch: {
      enabled: true,
      toolName: 'web_search',
      costPer1000Searches: 25.0, // Updated to accurate $25/1K from OpenAI pricing
      maxResultsPerSearch: 10,
      timeoutMs: 30000,
      supportsStreaming: false,
      requiresTools: true
    },
    rateLimits: {
      requestsPerMinute: 3000,
      tokensPerMinute: 250000,
      searchesPerMinute: 100
    }
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    apiKey: env.ANTHROPIC_API_KEY || '',
    timeout: 30000,
    maxRetries: 3,
    enabled: Boolean(env.ANTHROPIC_API_KEY),
    priority: 2,
    capabilities: ['chat', 'completion', 'structured_output', 'function_calling', 'web_search'],
    webSearch: {
      enabled: true,
      toolName: 'web_search',
      costPer1000Searches: 10.0, // Accurate $10/1K from Anthropic pricing
      maxResultsPerSearch: 10,
      timeoutMs: 30000,
      supportsStreaming: false,
      requiresTools: true
    },
    rateLimits: {
      requestsPerMinute: 1000,
      tokensPerMinute: 100000,
      searchesPerMinute: 50
    }
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    apiKey: env.GEMINI_API_KEY || '',
    timeout: 30000,
    maxRetries: 3,
    enabled: Boolean(env.GEMINI_API_KEY),
    priority: 3,
    capabilities: ['chat', 'completion', 'structured_output', 'google_search'],
    webSearch: {
      enabled: true,
      toolName: 'google_search',
      costPer1000Searches: 35.0,
      maxResultsPerSearch: 10,
      timeoutMs: 30000,
      supportsStreaming: false,
      requiresTools: true
    },
    rateLimits: {
      requestsPerMinute: 1500,
      tokensPerMinute: 150000,
      searchesPerMinute: 60
    }
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    apiKey: env.PERPLEXITY_API_KEY || '',
    timeout: 45000, // Increased from 30s to 45s for web search
    maxRetries: 3,
    enabled: Boolean(env.PERPLEXITY_API_KEY),
    priority: 2, // Increased from 4 to 2 - higher priority for better utilization
    capabilities: ['chat', 'completion', 'built_in_web_search'],
    webSearch: {
      enabled: true,
      toolName: 'built_in_search',
      costPer1000Searches: 0.0, // Included in model pricing
      maxResultsPerSearch: 10,
      timeoutMs: 45000, // Increased from 30s to 45s to match provider timeout
      supportsStreaming: true,
      requiresTools: false // Built-in search capability
    },
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 50000,
      searchesPerMinute: 100 // Higher since it's included in pricing
    }
  }
].filter(provider => provider.enabled);

/**
 * Provider manager for dynamic provider selection and health monitoring
 */
export class PydanticProviderManager {
  private static instance: PydanticProviderManager;
  private healthStatus: Map<string, ProviderHealthStatus> = new Map();
  private lastHealthCheck: Date = new Date();

  private constructor() {
    this.initializeHealthStatus();
  }

  static getInstance(): PydanticProviderManager {
    if (!PydanticProviderManager.instance) {
      PydanticProviderManager.instance = new PydanticProviderManager();
    }
    return PydanticProviderManager.instance;
  }

  /**
   * Initialize health status for all providers
   */
  private initializeHealthStatus(): void {
    PYDANTIC_PROVIDERS.forEach(provider => {
      this.healthStatus.set(provider.id, {
        id: provider.id,
        available: true,
        lastChecked: new Date(),
        errorCount: 0,
        avgResponseTime: 0,
        webSearchAvailable: provider.webSearch?.enabled ?? false,
        totalSearches: 0,
        searchErrorCount: 0
      });
    });
  }

  /**
   * Get available providers sorted by priority
   */
  getAvailableProviders(): ReadonlyArray<PydanticProviderConfig> {
    return PYDANTIC_PROVIDERS
      .filter(provider => {
        const health = this.healthStatus.get(provider.id);
        return health?.available !== false;
      })
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get provider by ID with validation
   */
  getProvider(id: string): PydanticProviderConfig | null {
    const provider = PYDANTIC_PROVIDERS.find(p => p.id === id);
    if (!provider) {
      logger.warn(`Provider not found: ${id}`);
      return null;
    }

    const health = this.healthStatus.get(id);
    if (health?.available === false) {
      logger.warn(`Provider unavailable: ${id}`);
      return null;
    }

    return provider;
  }

  /**
   * Update provider health status
   */
  updateProviderHealth(
    id: string, 
    available: boolean, 
    responseTime?: number, 
    error?: string,
    webSearchAvailable?: boolean
  ): void {
    const current = this.healthStatus.get(id);
    if (!current) return;

    const errorCount = available ? 0 : current.errorCount + 1;
    const avgResponseTime = responseTime 
      ? (current.avgResponseTime + responseTime) / 2 
      : current.avgResponseTime;

    this.healthStatus.set(id, {
      ...current,
      available,
      lastChecked: new Date(),
      errorCount,
      avgResponseTime,
      statusMessage: error,
      webSearchAvailable: webSearchAvailable ?? current.webSearchAvailable
    });

    // Only log when availability status changes to reduce noise
    if (current.available !== available) {
      logger.info(`Provider health changed: ${id}`, {
        previousStatus: current.available ? 'available' : 'unavailable',
        newStatus: available ? 'available' : 'unavailable',
        errorCount,
        avgResponseTime,
        statusMessage: error,
        webSearchAvailable: webSearchAvailable ?? current.webSearchAvailable
      });
    }

    // Track provider health metrics with Logfire
    try {
      trackPerformance(
        `provider.health.${id}`,
        avgResponseTime,
        available,
        {
          providerId: id,
          errorCount,
          available,
          statusMessage: error,
          healthCheck: true,
          webSearchAvailable: webSearchAvailable ?? current.webSearchAvailable
        }
      );

      if (!available && error) {
        trackError(
          new Error(error),
          `Provider health check failed: ${id}`,
          undefined,
          undefined,
          {
            providerId: id,
            errorCount,
            avgResponseTime,
            webSearchAvailable: webSearchAvailable ?? current.webSearchAvailable
          }
        );
      }
    } catch (logfireError) {
      // Don't let Logfire errors affect provider functionality
      logger.debug('Failed to track provider health with Logfire', { 
        error: logfireError instanceof Error ? logfireError.message : String(logfireError) 
      });
    }
  }

  /**
   * Get comprehensive health report
   */
  getHealthReport(): ReadonlyArray<ProviderHealthStatus> {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Track provider usage for monitoring
   */
  trackProviderUsage(
    providerId: string,
    modelId: string,
    operation: string,
    tokensUsed: number,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    try {
      const provider = this.getProvider(providerId);
      if (!provider) return;

      trackLLMUsage(
        providerId,
        modelId,
        operation,
        tokensUsed,
        undefined, // cost estimate can be calculated elsewhere
        duration,
        success,
        {
          providerName: provider.name,
          providerPriority: provider.priority,
          capabilities: provider.capabilities,
          webSearchEnabled: provider.webSearch?.enabled ?? false,
          ...metadata
        }
      );

      trackPerformance(
        `provider.usage.${providerId}`,
        duration,
        success,
        {
          modelId,
          operation,
          tokensUsed,
          providerName: provider.name,
          webSearchEnabled: provider.webSearch?.enabled ?? false,
          ...metadata
        }
      );

      // Update provider health based on usage
      this.updateProviderHealth(providerId, success, duration);

    } catch (error) {
      logger.debug('Failed to track provider usage with Logfire', { 
        error: error instanceof Error ? error.message : String(error),
        providerId,
        modelId
      });
    }
  }

  /**
   * Track web search usage for monitoring and cost tracking
   */
  trackWebSearchUsage(
    providerId: string,
    searchCount: number,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    try {
      const provider = this.getProvider(providerId);
      if (!provider || !provider.webSearch) return;

      const current = this.healthStatus.get(providerId);
      if (current) {
        this.healthStatus.set(providerId, {
          ...current,
          totalSearches: current.totalSearches + searchCount,
          searchErrorCount: success ? current.searchErrorCount : current.searchErrorCount + 1
        });
      }

      // Calculate cost
      const estimatedCost = (searchCount / 1000) * provider.webSearch.costPer1000Searches;

      trackPerformance(
        `provider.web_search.${providerId}`,
        duration,
        success,
        {
          searchCount,
          estimatedCost,
          toolName: provider.webSearch.toolName,
          providerName: provider.name,
          requiresTools: provider.webSearch.requiresTools,
          ...metadata
        }
      );

      logger.info(`Web search usage tracked: ${providerId}`, {
        searchCount,
        estimatedCost,
        duration,
        success
      });

    } catch (error) {
      logger.debug('Failed to track web search usage with Logfire', { 
        error: error instanceof Error ? error.message : String(error),
        providerId
      });
    }
  }

  /**
   * Track provider selection for analytics
   */
  trackProviderSelection(selectedProviderId: string, availableProviders: string[], reason: string): void {
    try {
      trackPerformance(
        'provider.selection',
        0, // Duration not applicable for selection
        true,
        {
          selectedProviderId,
          availableProviders,
          reason,
          totalAvailable: availableProviders.length,
          selectionTimestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      logger.debug('Failed to track provider selection with Logfire', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Reset all provider health status
   */
  resetHealthStatus(): void {
    this.initializeHealthStatus();
    logger.info('Provider health status reset');
  }
}

/**
 * Validate provider availability at startup
 * This ensures we fail fast if critical providers are misconfigured
 */
export async function validateProviderAvailability(): Promise<void> {
  const enabledProviders = PYDANTIC_PROVIDERS.filter(p => p.enabled);
  
  if (enabledProviders.length === 0) {
    throw new Error('No LLM providers are enabled. Check your API key configuration.');
  }

  logger.info('Validating PydanticAI provider configuration', {
    enabledProviders: enabledProviders.map(p => p.id),
    totalProviders: enabledProviders.length
  });

  // Validate OpenAI is available (required)
  const openaiProvider = enabledProviders.find(p => p.id === 'openai');
  if (!openaiProvider) {
    throw new Error('OpenAI provider is required but not configured');
  }

  // Log fallback providers
  const fallbackProviders = enabledProviders.filter(p => p.id !== 'openai');
  if (fallbackProviders.length > 0) {
    logger.info('Fallback providers configured', {
      providers: fallbackProviders.map(p => p.id),
      count: fallbackProviders.length
    });
  } else {
    logger.warn('No fallback providers configured. Consider adding additional providers for resilience.');
  }
}

/**
 * Get provider configuration string for PydanticAI
 * Format: "provider:model" (e.g., "openai:gpt-4o")
 */
export function getProviderModelString(providerId: string, modelName: string): string {
  const provider = PYDANTIC_PROVIDERS.find(p => p.id === providerId);
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }
  return `${providerId}:${modelName}`;
}

/**
 * Default model mappings for each provider (aligned with models.ts and pricing)
 */
export const DEFAULT_MODELS = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  gemini: 'gemini-2.5-flash',
  perplexity: 'sonar'
} as const;

/**
 * Get cost estimate for sentiment analysis operation
 */
export function estimateSentimentAnalysisCost(
  providerId: string,
  companyName: string,
  enableWebSearch: boolean = false
): {
  estimatedTokenCost: number;
  estimatedSearchCost: number;
  estimatedTotalCost: number;
} {
  const modelId = DEFAULT_MODELS[providerId as keyof typeof DEFAULT_MODELS];
  if (!modelId) {
    return {
      estimatedTokenCost: 0,
      estimatedSearchCost: 0,
      estimatedTotalCost: 0
    };
  }
  
  return CostCalculator.estimateSentimentAnalysisCost(modelId, companyName, enableWebSearch);
}

/**
 * Get cost report for models configured for a specific task in models.ts
 */
export function getCostReportForTaskModels(
  task: ModelTask,
  companyName: string,
  enableWebSearch: boolean = false
): Array<{
  modelId: string;
  provider: string;
  displayName: string;
  estimatedCost: number;
  tokenCost: number;
  searchCost: number;
  available: boolean;
}> {
  // Get models configured for this task
  const taskModels = Object.values(MODELS)
    .filter(model => model.task.includes(task))
    .map(model => model.id);
  
  return CostReporter.getCostReportForConfiguredModels(taskModels, companyName, enableWebSearch);
}

/**
 * Get cost report for sentiment analysis models configured in models.ts
 */
export function getSentimentAnalysisCostReportForConfiguredModels(
  companyName: string
): Array<{
  modelId: string;
  provider: string;
  displayName: string;
  estimatedCost: number;
  tokenCost: number;
  searchCost: number;
  available: boolean;
}> {
  return getCostReportForTaskModels(ModelTask.SENTIMENT, companyName, true);
}

/**
 * Get default model string for a provider
 */
export function getDefaultModelString(providerId: string): string {
  const modelName = DEFAULT_MODELS[providerId as keyof typeof DEFAULT_MODELS];
  if (!modelName) {
    throw new Error(`No default model configured for provider: ${providerId}`);
  }
  return getProviderModelString(providerId, modelName);
}

/**
 * Get providers that support web search
 */
export function getWebSearchEnabledProviders(): ReadonlyArray<PydanticProviderConfig> {
  return PYDANTIC_PROVIDERS.filter(p => p.webSearch?.enabled ?? false);
}

/**
 * Get the most cost-effective provider for web search
 */
export function getMostCostEffectiveWebSearchProvider(): PydanticProviderConfig | null {
  const webSearchProviders = getWebSearchEnabledProviders();
  if (webSearchProviders.length === 0) return null;
  
  return webSearchProviders.reduce((cheapest, current) => {
    const cheapestCost = cheapest.webSearch?.costPer1000Searches ?? Infinity;
    const currentCost = current.webSearch?.costPer1000Searches ?? Infinity;
    return currentCost < cheapestCost ? current : cheapest;
  });
}

/**
 * Calculate estimated cost for web searches
 */
export function calculateWebSearchCost(providerId: string, searchCount: number): number {
  const provider = PYDANTIC_PROVIDERS.find(p => p.id === providerId);
  if (!provider?.webSearch) return 0;
  
  return (searchCount / 1000) * provider.webSearch.costPer1000Searches;
}

/**
 * Calculate total cost for a model run including tokens and searches
 */
export function calculateTotalRunCost(
  providerId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  searchCount: number = 0
): {
  tokenCost: number;
  searchCost: number;
  totalCost: number;
} {
  // Get token cost from pricing configuration
  const tokenCost = LLM_PRICING[modelId] 
    ? CostCalculator.calculateTokenCost(modelId, inputTokens, outputTokens)
    : 0;
  
  // Get search cost from provider configuration
  const searchCost = calculateWebSearchCost(providerId, searchCount);
  
  return {
    tokenCost,
    searchCost,
    totalCost: tokenCost + searchCost
  };
}

/**
 * Get web search configuration for a provider
 */
export function getWebSearchConfig(providerId: string): WebSearchConfig | null {
  const provider = PYDANTIC_PROVIDERS.find(p => p.id === providerId);
  return provider?.webSearch ?? null;
}

/**
 * Check if a provider supports web search
 */
export function supportsWebSearch(providerId: string): boolean {
  const provider = PYDANTIC_PROVIDERS.find(p => p.id === providerId);
  return provider?.webSearch?.enabled ?? false;
}

/**
 * Get providers by web search capability
 */
export function getProvidersByWebSearchCapability(requiresTools: boolean): ReadonlyArray<PydanticProviderConfig> {
  return PYDANTIC_PROVIDERS.filter(p => {
    if (!p.webSearch?.enabled) return false;
    return p.webSearch.requiresTools === requiresTools;
  });
}

// Initialize provider manager singleton
export const providerManager = PydanticProviderManager.getInstance();