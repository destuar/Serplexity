/**
 * @file TokenUsageDetail.ts
 * @description Precise token usage tracking for accurate cost calculations
 * 
 * CRITICAL: This interface replaces the dangerous hardcoded percentage splits
 * that were causing massive cost calculation errors. All LLM responses MUST
 * provide actual token counts, not estimates.
 */

export interface TokenUsageDetail {
  readonly inputTokens: number;        // Actual input tokens from LLM provider
  readonly outputTokens: number;       // Actual output tokens from LLM provider
  readonly totalTokens: number;        // Total tokens (must equal input + output + thinking + cached)
  readonly thinkingTokens?: number;    // Thinking tokens (Gemini 2.5+ only)
  readonly cachedTokens?: number;      // Cached tokens (if applicable)
  readonly searchCount?: number;       // Actual web search count
  readonly modelUsed: string;          // Exact model ID used for the request
}

export interface CostBreakdown {
  readonly inputCost: number;
  readonly outputCost: number;
  readonly thinkingCost: number;
  readonly cachingCost: number;
  readonly searchCost: number;
  readonly totalCost: number;
}

export interface DetailedChatCompletionResponse<T> {
  readonly data: T;
  readonly usage: TokenUsageDetail;
  readonly cost: CostBreakdown;
  readonly metadata?: {
    readonly attemptCount: number;
    readonly fallbackUsed: boolean;
    readonly executionTime: number;
  };
}

/**
 * DEPRECATED: Legacy TokenUsage interface with dangerous estimation
 * @deprecated Use TokenUsageDetail instead for accurate cost calculations
 */
export interface TokenUsage {
  readonly promptTokens: number;       // DANGER: Often estimated, not actual
  readonly completionTokens: number;   // DANGER: Often estimated, not actual
  readonly totalTokens: number;
}