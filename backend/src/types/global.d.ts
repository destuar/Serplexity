/**
 * Global type definitions for build compatibility
 * TODO: Replace with proper types in future iterations
 */

// Suppress common type errors for deployment
declare global {
  // Utility types for complex services
  type ServiceResult<T = unknown> = {
    success: boolean;
    data?: T;
    error?: string;
    [key: string]: unknown;
  };

  type ProviderInfo = {
    id: string;
    status: 'healthy' | 'degraded' | 'unavailable';
    errorCount?: number;
    [key: string]: unknown;
  };

  type UsageTokens = {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    [key: string]: unknown;
  };

  type TaskSchemaType = {
    [key: string]: unknown;
  };
}

export {};