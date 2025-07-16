/**
 * @file pydanticProviders.ts
 * @description Provider configuration for PydanticAI integration
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
 * 
 * @dependencies
 * - env: Environment configuration with API keys
 * - logger: Centralized logging system
 * 
 * @exports
 * - PydanticProviderConfig: Type-safe provider configuration interface
 * - PYDANTIC_PROVIDERS: Validated provider configurations
 * - PydanticProviderManager: Provider management class
 * - validateProviderAvailability: Provider health check function
 */

import env from './env';
import logger from '../utils/logger';
import { trackLLMUsage, trackPerformance, trackError } from './logfire';

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
  readonly rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
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
    capabilities: ['chat', 'completion', 'structured_output', 'function_calling'],
    rateLimits: {
      requestsPerMinute: 3000,
      tokensPerMinute: 250000
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
    capabilities: ['chat', 'completion', 'structured_output', 'function_calling'],
    rateLimits: {
      requestsPerMinute: 1000,
      tokensPerMinute: 100000
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
    capabilities: ['chat', 'completion', 'structured_output'],
    rateLimits: {
      requestsPerMinute: 1500,
      tokensPerMinute: 150000
    }
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    apiKey: env.PERPLEXITY_API_KEY || '',
    timeout: 30000,
    maxRetries: 3,
    enabled: Boolean(env.PERPLEXITY_API_KEY),
    priority: 4,
    capabilities: ['chat', 'completion'],
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 50000
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
        avgResponseTime: 0
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
    error?: string
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
      statusMessage: error
    });

    logger.info(`Provider health updated: ${id}`, {
      available,
      errorCount,
      avgResponseTime,
      statusMessage: error
    });

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
          healthCheck: true
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
            avgResponseTime
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
 * Default model mappings for each provider
 */
export const DEFAULT_MODELS = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-sonnet-20240229',
  gemini: 'gemini-1.5-pro',
  perplexity: 'llama-3.1-sonar-small-128k-online'
} as const;

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

// Initialize provider manager singleton
export const providerManager = PydanticProviderManager.getInstance();