/**
 * @file llmPricing.ts
 * @description Comprehensive pricing configuration for all LLM providers
 *
 * This file contains accurate, up-to-date pricing information for all supported
 * LLM providers including token costs, web search costs, and other tool-specific
 * pricing. Used for cost calculation and optimization across the platform.
 *
 * @updated 2025-01-17
 * @sources
 * - https://platform.openai.com/docs/pricing
 * - https://www.anthropic.com/pricing#api
 * - https://ai.google.dev/gemini-api/docs/pricing
 * - https://docs.perplexity.ai/guides/pricing
 */

export interface TokenPricing {
  readonly inputTokensPerMillion: number; // USD per 1M input tokens
  readonly outputTokensPerMillion: number; // USD per 1M output tokens
  readonly outputThinkingTokensPerMillion?: number; // USD per 1M thinking output tokens (Gemini 2.5+)
  readonly contextCachingPerMillion?: number; // USD per 1M cached tokens
  readonly contextCachingStoragePerHour?: number; // USD per 1M tokens per hour
}

export interface WebSearchPricing {
  readonly enabled: boolean;
  readonly costPer1000Searches: number; // USD per 1K searches
  readonly includesTokens: boolean; // Whether search content tokens are included
  readonly freeSearchesPerDay?: number; // Free searches per day
}

export interface ModelPricing {
  readonly modelId: string;
  readonly provider: string;
  readonly displayName: string;
  readonly tokens: TokenPricing;
  readonly webSearch?: WebSearchPricing;
  readonly otherTools?: Record<string, number>; // Other tool costs
  readonly rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    searchesPerMinute?: number;
  };
}

/**
 * Comprehensive pricing configuration for all supported models
 * Updated with latest pricing from official documentation
 */
export const LLM_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  "gpt-4.1-mini": {
    modelId: "gpt-4.1-mini",
    provider: "openai",
    displayName: "GPT-4.1 Mini",
    tokens: {
      inputTokensPerMillion: 0.15, // $0.15 per 1M input tokens
      outputTokensPerMillion: 0.6, // $0.60 per 1M output tokens
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 25, // $25 per 1K searches
      includesTokens: true, // Search content tokens included
    },
    rateLimits: {
      requestsPerMinute: 10000,
      tokensPerMinute: 2000000,
      searchesPerMinute: 100,
    },
  },

  "gpt-4o": {
    modelId: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    tokens: {
      inputTokensPerMillion: 2.5, // $2.50 per 1M input tokens
      outputTokensPerMillion: 10.0, // $10.00 per 1M output tokens
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 25, // $25 per 1K searches
      includesTokens: true, // Search content tokens included
    },
    rateLimits: {
      requestsPerMinute: 10000,
      tokensPerMinute: 2000000,
      searchesPerMinute: 100,
    },
  },

  // Anthropic Models
  "claude-3-5-haiku-20241022": {
    modelId: "claude-3-5-haiku-20241022",
    provider: "anthropic",
    displayName: "Claude 3.5 Haiku",
    tokens: {
      inputTokensPerMillion: 0.8, // $0.80 per 1M input tokens
      outputTokensPerMillion: 4.0, // $4.00 per 1M output tokens
      contextCachingPerMillion: 1.0, // $1.00 per 1M cached tokens (write)
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 10, // $10 per 1K searches
      includesTokens: false, // Tokens charged separately
    },
    otherTools: {
      code_execution: 0.05, // $0.05 per hour per container
    },
    rateLimits: {
      requestsPerMinute: 4000,
      tokensPerMinute: 400000,
      searchesPerMinute: 50,
    },
  },

  "claude-3-sonnet-20240229": {
    modelId: "claude-3-sonnet-20240229",
    provider: "anthropic",
    displayName: "Claude 3 Sonnet",
    tokens: {
      inputTokensPerMillion: 3.0, // $3.00 per 1M input tokens
      outputTokensPerMillion: 15.0, // $15.00 per 1M output tokens
      contextCachingPerMillion: 3.75, // $3.75 per 1M cached tokens (write)
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 10, // $10 per 1K searches
      includesTokens: false, // Tokens charged separately
    },
    otherTools: {
      code_execution: 0.05, // $0.05 per hour per container
    },
    rateLimits: {
      requestsPerMinute: 4000,
      tokensPerMinute: 400000,
      searchesPerMinute: 50,
    },
  },

  // Google Gemini Models
  "gemini-2.5-flash": {
    modelId: "gemini-2.5-flash",
    provider: "gemini",
    displayName: "Gemini 2.5 Flash",
    tokens: {
      inputTokensPerMillion: 0.1, // $0.10 per 1M input tokens (CORRECTED from $0.30 - was 300% overcharge)
      outputTokensPerMillion: 0.6, // $0.60 per 1M output tokens (CORRECTED from $2.50 - was 417% overcharge)
      outputThinkingTokensPerMillion: 3.5, // $3.50 per 1M thinking output tokens (NEW - critical for 2.5 models)
      contextCachingPerMillion: 0.075, // $0.075 per 1M cached tokens
      contextCachingStoragePerHour: 1.0, // $1.00 per 1M tokens per hour
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 35, // $35 per 1K searches
      includesTokens: false, // Tokens charged separately
      freeSearchesPerDay: 1500, // Free searches per day
    },
    rateLimits: {
      requestsPerMinute: 300,
      tokensPerMinute: 4000000,
      searchesPerMinute: 60,
    },
  },

  "gemini-1.5-pro": {
    modelId: "gemini-1.5-pro",
    provider: "gemini",
    displayName: "Gemini 1.5 Pro",
    tokens: {
      inputTokensPerMillion: 1.25, // $1.25 per 1M input tokens
      outputTokensPerMillion: 5.0, // $5.00 per 1M output tokens
      contextCachingPerMillion: 0.3125, // $0.3125 per 1M cached tokens
      contextCachingStoragePerHour: 1.0, // $1.00 per 1M tokens per hour
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 35, // $35 per 1K searches
      includesTokens: false, // Tokens charged separately
      freeSearchesPerDay: 1500, // Free searches per day
    },
    rateLimits: {
      requestsPerMinute: 300,
      tokensPerMinute: 4000000,
      searchesPerMinute: 60,
    },
  },

  // Perplexity Models (legacy alias for backward compatibility)
  perplexity: {
    modelId: "perplexity",
    provider: "perplexity",
    displayName: "Perplexity Sonar (Legacy)",
    tokens: {
      inputTokensPerMillion: 1.0, // $1.00 per 1M input tokens
      outputTokensPerMillion: 1.0, // $1.00 per 1M output tokens
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 0, // Included in model pricing
      includesTokens: true, // Search included in model
    },
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 200000,
      searchesPerMinute: 100,
    },
  },

  sonar: {
    modelId: "sonar",
    provider: "perplexity",
    displayName: "Perplexity Sonar",
    tokens: {
      inputTokensPerMillion: 1.0, // $1.00 per 1M input tokens
      outputTokensPerMillion: 1.0, // $1.00 per 1M output tokens
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 0, // Included in model pricing
      includesTokens: true, // Search included in model
    },
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 200000,
      searchesPerMinute: 100,
    },
  },

  "sonar-pro": {
    modelId: "sonar-pro",
    provider: "perplexity",
    displayName: "Perplexity Sonar Pro",
    tokens: {
      inputTokensPerMillion: 3.0, // $3.00 per 1M input tokens
      outputTokensPerMillion: 15.0, // $15.00 per 1M output tokens
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 0, // Included in model pricing
      includesTokens: true, // Search included in model
    },
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 200000,
      searchesPerMinute: 100,
    },
  },

  "sonar-reasoning": {
    modelId: "sonar-reasoning",
    provider: "perplexity",
    displayName: "Perplexity Sonar Reasoning",
    tokens: {
      inputTokensPerMillion: 1.0, // $1.00 per 1M input tokens
      outputTokensPerMillion: 5.0, // $5.00 per 1M output tokens
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 0, // Included in model pricing
      includesTokens: true, // Search included in model
    },
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 200000,
      searchesPerMinute: 100,
    },
  },

  // Google AI Overviews (SERP scrape) pseudo-model
  "ai-overview": {
    modelId: "ai-overview",
    provider: "google",
    displayName: "AI Overviews",
    tokens: {
      inputTokensPerMillion: 0,
      outputTokensPerMillion: 0,
    },
    webSearch: {
      enabled: true,
      costPer1000Searches: 0, // Treated as $0 in our internal accounting; infra costs handled separately
      includesTokens: true,
    },
    rateLimits: {
      requestsPerMinute: 8,
      tokensPerMinute: 0,
      searchesPerMinute: 8,
    },
  },
};

/**
 * Cost calculation utilities
 */
export class CostCalculator {
  /**
   * Calculate token cost for a model with proper token type handling
   */
  static calculateTokenCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens?: number,
    thinkingTokens?: number
  ): number {
    const pricing = LLM_PRICING[modelId];
    if (!pricing) {
      throw new Error(`Pricing not found for model: ${modelId}`);
    }

    let totalCost = 0;

    // Input tokens
    totalCost += (inputTokens / 1000000) * pricing.tokens.inputTokensPerMillion;

    // Output tokens (regular)
    totalCost +=
      (outputTokens / 1000000) * pricing.tokens.outputTokensPerMillion;

    // Thinking tokens (Gemini 2.5+ only) - CRITICAL for accurate Gemini pricing
    if (thinkingTokens && pricing.tokens.outputThinkingTokensPerMillion) {
      totalCost +=
        (thinkingTokens / 1000000) *
        pricing.tokens.outputThinkingTokensPerMillion;
    }

    // Cached tokens (if applicable)
    if (cachedTokens && pricing.tokens.contextCachingPerMillion) {
      totalCost +=
        (cachedTokens / 1000000) * pricing.tokens.contextCachingPerMillion;
    }

    return totalCost;
  }

  /**
   * Calculate web search cost for a model
   */
  static calculateWebSearchCost(modelId: string, searchCount: number): number {
    const pricing = LLM_PRICING[modelId];
    if (!pricing?.webSearch?.enabled) {
      return 0;
    }

    return (searchCount / 1000) * pricing.webSearch.costPer1000Searches;
  }

  /**
   * Calculate total cost for a model run with comprehensive token tracking
   */
  static calculateTotalCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    searchCount: number = 0,
    cachedTokens?: number,
    thinkingTokens?: number,
    otherToolCounts?: Record<string, number>
  ): {
    tokenCost: number;
    searchCost: number;
    totalCost: number;
    breakdown: {
      inputCost: number;
      outputCost: number;
      thinkingCost: number;
      cachingCost: number;
    };
  } {
    const pricing = LLM_PRICING[modelId];
    if (!pricing) {
      throw new Error(`Pricing not found for model: ${modelId}`);
    }

    // Calculate individual cost components for transparency
    const inputCost =
      (inputTokens / 1000000) * pricing.tokens.inputTokensPerMillion;
    const outputCost =
      (outputTokens / 1000000) * pricing.tokens.outputTokensPerMillion;
    const thinkingCost =
      thinkingTokens && pricing.tokens.outputThinkingTokensPerMillion
        ? (thinkingTokens / 1000000) *
          pricing.tokens.outputThinkingTokensPerMillion
        : 0;
    const cachingCost =
      cachedTokens && pricing.tokens.contextCachingPerMillion
        ? (cachedTokens / 1000000) * pricing.tokens.contextCachingPerMillion
        : 0;

    const tokenCost = inputCost + outputCost + thinkingCost + cachingCost;
    let searchCost = this.calculateWebSearchCost(modelId, searchCount);

    // Include other tool costs if specified (priced per-use)
    if (otherToolCounts && pricing.otherTools) {
      for (const [toolName, count] of Object.entries(otherToolCounts)) {
        const perUse = pricing.otherTools[toolName];
        if (typeof perUse === "number" && count && count > 0) {
          searchCost += perUse * count;
        }
      }
    }

    return {
      tokenCost,
      searchCost,
      totalCost: tokenCost + searchCost,
      breakdown: {
        inputCost,
        outputCost,
        thinkingCost,
        cachingCost,
      },
    };
  }

  /**
   * Get cost information for models (informational only)
   * Note: Model selection is controlled via models.ts configuration
   */
  static getCostInformationForModels(
    inputTokens: number,
    outputTokens: number,
    searchCount: number = 0,
    modelIds?: string[]
  ): Array<{
    modelId: string;
    cost: number;
    provider: string;
    displayName: string;
  }> {
    const modelsToCheck = modelIds
      ? Object.values(LLM_PRICING).filter((p) => modelIds.includes(p.modelId))
      : Object.values(LLM_PRICING);

    return modelsToCheck
      .map((model) => {
        const { totalCost } = this.calculateTotalCost(
          model.modelId,
          inputTokens,
          outputTokens,
          searchCount
        );

        return {
          modelId: model.modelId,
          cost: totalCost,
          provider: model.provider,
          displayName: model.displayName,
        };
      })
      .sort((a, b) => a.cost - b.cost);
  }

  /**
   * Get pricing information for a model
   */
  static getPricingInfo(modelId: string): ModelPricing | null {
    return LLM_PRICING[modelId] || null;
  }

  /**
   * Get all models that support web search
   */
  static getWebSearchEnabledModels(): ModelPricing[] {
    return Object.values(LLM_PRICING).filter((p) => p.webSearch?.enabled);
  }

  /**
   * Estimate cost for sentiment analysis operation
   */
  static estimateSentimentAnalysisCost(
    modelId: string,
    companyName: string,
    enableWebSearch: boolean = false
  ): {
    estimatedTokenCost: number;
    estimatedSearchCost: number;
    estimatedTotalCost: number;
  } {
    // Estimate tokens for sentiment analysis
    const basePromptTokens = 500; // Base system prompt
    const companyContextTokens = companyName.length * 1.5; // Company context
    const webSearchPromptTokens = enableWebSearch ? 200 : 0; // Web search instructions
    const estimatedInputTokens =
      basePromptTokens + companyContextTokens + webSearchPromptTokens;

    // Estimate output tokens (structured sentiment response)
    const estimatedOutputTokens = 150; // Structured JSON response

    // Estimate search count
    const estimatedSearchCount = enableWebSearch ? 8 : 0; // 8 searches for sentiment analysis

    return {
      estimatedTokenCost: this.calculateTokenCost(
        modelId,
        estimatedInputTokens,
        estimatedOutputTokens
      ),
      estimatedSearchCost: this.calculateWebSearchCost(
        modelId,
        estimatedSearchCount
      ),
      estimatedTotalCost: this.calculateTotalCost(
        modelId,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedSearchCount
      ).totalCost,
    };
  }
}

/**
 * Cost reporting utilities (informational only)
 * Note: Model selection is controlled via models.ts configuration
 */
export class CostReporter {
  /**
   * Get cost information for web search sentiment analysis across all models
   */
  static getSentimentAnalysisCostReport(companyName: string): Array<{
    modelId: string;
    provider: string;
    displayName: string;
    estimatedCost: number;
    tokenCost: number;
    searchCost: number;
    reasoning: string;
  }> {
    const webSearchModels = CostCalculator.getWebSearchEnabledModels();

    return webSearchModels
      .map((model) => {
        const cost = CostCalculator.estimateSentimentAnalysisCost(
          model.modelId,
          companyName,
          true
        );

        return {
          modelId: model.modelId,
          provider: model.provider,
          displayName: model.displayName,
          estimatedCost: cost.estimatedTotalCost,
          tokenCost: cost.estimatedTokenCost,
          searchCost: cost.estimatedSearchCost,
          reasoning: `${model.displayName}: Token cost $${cost.estimatedTokenCost.toFixed(4)} + Search cost $${cost.estimatedSearchCost.toFixed(4)} = $${cost.estimatedTotalCost.toFixed(4)}`,
        };
      })
      .sort((a, b) => a.estimatedCost - b.estimatedCost);
  }

  /**
   * Get cost information for specific models configured in models.ts
   */
  static getCostReportForConfiguredModels(
    modelIds: string[],
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
    return modelIds
      .map((modelId) => {
        const pricing = LLM_PRICING[modelId];
        if (!pricing) {
          return {
            modelId,
            provider: "unknown",
            displayName: "Unknown Model",
            estimatedCost: 0,
            tokenCost: 0,
            searchCost: 0,
            available: false,
          };
        }

        const cost = CostCalculator.estimateSentimentAnalysisCost(
          modelId,
          companyName,
          enableWebSearch
        );

        return {
          modelId,
          provider: pricing.provider,
          displayName: pricing.displayName,
          estimatedCost: cost.estimatedTotalCost,
          tokenCost: cost.estimatedTokenCost,
          searchCost: cost.estimatedSearchCost,
          available: true,
        };
      })
      .sort((a, b) => a.estimatedCost - b.estimatedCost);
  }

  /**
   * Compare costs across all providers for a given operation (informational only)
   */
  static compareCostsAcrossProviders(
    inputTokens: number,
    outputTokens: number,
    searchCount: number = 0
  ): Array<{
    modelId: string;
    provider: string;
    displayName: string;
    tokenCost: number;
    searchCost: number;
    totalCost: number;
  }> {
    return Object.values(LLM_PRICING)
      .map((model) => {
        const costs = CostCalculator.calculateTotalCost(
          model.modelId,
          inputTokens,
          outputTokens,
          searchCount
        );

        return {
          modelId: model.modelId,
          provider: model.provider,
          displayName: model.displayName,
          tokenCost: costs.tokenCost,
          searchCost: costs.searchCost,
          totalCost: costs.totalCost,
        };
      })
      .sort((a, b) => a.totalCost - b.totalCost);
  }

  /**
   * Compare costs for models configured in models.ts (informational only)
   */
  static compareCostsForConfiguredModels(
    modelIds: string[],
    inputTokens: number,
    outputTokens: number,
    searchCount: number = 0
  ): Array<{
    modelId: string;
    provider: string;
    displayName: string;
    tokenCost: number;
    searchCost: number;
    totalCost: number;
    available: boolean;
  }> {
    return modelIds
      .map((modelId) => {
        const pricing = LLM_PRICING[modelId];
        if (!pricing) {
          return {
            modelId,
            provider: "unknown",
            displayName: "Unknown Model",
            tokenCost: 0,
            searchCost: 0,
            totalCost: 0,
            available: false,
          };
        }

        const costs = CostCalculator.calculateTotalCost(
          modelId,
          inputTokens,
          outputTokens,
          searchCount
        );

        return {
          modelId,
          provider: pricing.provider,
          displayName: pricing.displayName,
          tokenCost: costs.tokenCost,
          searchCost: costs.searchCost,
          totalCost: costs.totalCost,
          available: true,
        };
      })
      .sort((a, b) => a.totalCost - b.totalCost);
  }
}

export default LLM_PRICING;
