/**
 * @file errorHandling.ts
 * @description Centralized error handling utilities for consistent error states and loading indicators.
 * Provides standardized error classification, user-friendly messaging, and recovery mechanisms.
 * 
 * Key responsibilities:
 * - Error classification and severity assessment
 * - User-friendly error message generation
 * - Loading state management patterns
 * - Error recovery and retry mechanisms
 * - Performance and error monitoring integration
 * 
 * @author Dashboard Team
 * @version 2.0.0 - Comprehensive error handling for refactored architecture
 */

import { DataQualityMetrics } from '../types/dashboardData';

/**
 * Error severity levels for prioritizing user feedback
 */
export enum ErrorSeverity {
  /** Low impact - data might be stale but functional */
  INFO = 'info',
  /** Medium impact - some functionality affected */
  WARNING = 'warning', 
  /** High impact - major functionality broken */
  ERROR = 'error',
  /** Critical - app unusable */
  CRITICAL = 'critical'
}

/**
 * Error categories for targeted handling
 */
export enum ErrorCategory {
  /** Network connectivity issues */
  NETWORK = 'network',
  /** API endpoint errors */
  API = 'api',
  /** Data validation failures */
  DATA_VALIDATION = 'data_validation',
  /** Permission/authentication issues */
  PERMISSION = 'permission',
  /** Client-side processing errors */
  CLIENT = 'client',
  /** Unknown/unexpected errors */
  UNKNOWN = 'unknown'
}

/**
 * Loading states for different types of operations
 */
export enum LoadingState {
  /** Not loading */
  IDLE = 'idle',
  /** Initial data load */
  LOADING = 'loading',
  /** User-triggered refresh */
  REFRESHING = 'refreshing',
  /** Filter changes with partial updates */
  UPDATING = 'updating',
  /** Background data sync */
  SYNCING = 'syncing'
}

/**
 * Structured error information with context
 */
export interface DashboardError {
  /** Unique error identifier */
  id: string;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Error category for handling */
  category: ErrorCategory;
  /** User-facing error message */
  message: string;
  /** Technical details for debugging */
  details?: string;
  /** Component or context where error occurred */
  source?: string;
  /** Timestamp when error occurred */
  timestamp: string;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested recovery actions */
  recoveryActions?: RecoveryAction[];
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Recovery action that users can take
 */
export interface RecoveryAction {
  /** Action identifier */
  id: string;
  /** User-facing action label */
  label: string;
  /** Action handler function */
  action: () => void | Promise<void>;
  /** Whether this is the primary recommended action */
  primary?: boolean;
}

/**
 * Loading state configuration
 */
export interface LoadingStateConfig {
  /** Current loading state */
  state: LoadingState;
  /** User-facing loading message */
  message?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Whether to show a spinner */
  showSpinner?: boolean;
  /** Whether to overlay existing content */
  overlay?: boolean;
}

/**
 * Error handling configuration options
 */
export interface ErrorHandlingOptions {
  /** Whether to log errors to console */
  logToConsole: boolean;
  /** Whether to send errors to monitoring service */
  sendToMonitoring: boolean;
  /** Maximum error message length */
  maxMessageLength: number;
  /** Whether to include stack traces in development */
  includeStackTrace: boolean;
  /** Custom error message overrides */
  messageOverrides: Record<string, string>;
}

/**
 * Default error handling configuration
 */
const DEFAULT_ERROR_OPTIONS: ErrorHandlingOptions = {
  logToConsole: process.env.NODE_ENV === 'development',
  sendToMonitoring: process.env.NODE_ENV === 'production',
  maxMessageLength: 200,
  includeStackTrace: process.env.NODE_ENV === 'development',
  messageOverrides: {},
};

/**
 * Creates a standardized dashboard error with proper classification
 * 
 * @param error - Original error or error message
 * @param context - Additional context about where/when error occurred
 * @param options - Configuration options
 * @returns Structured dashboard error
 * 
 * @example
 * ```typescript
 * try {
 *   await fetchDashboardData();
 * } catch (err) {
 *   const dashboardError = createDashboardError(err, {
 *     source: 'DashboardContext.fetchData',
 *     operation: 'data-fetch',
 *     selectedModel: 'gpt-4'
 *   });
 *   handleError(dashboardError);
 * }
 * ```
 */
export function createDashboardError(
  error: Error | string | unknown,
  context: {
    source?: string;
    operation?: string;
    [key: string]: unknown;
  } = {},
  options: Partial<ErrorHandlingOptions> = {}
): DashboardError {
  const opts = { ...DEFAULT_ERROR_OPTIONS, ...options };
  const timestamp = new Date().toISOString();
  const id = generateErrorId(error, context, timestamp);

  // Extract error message and details
  let message: string;
  let details: string | undefined;
  let originalError: Error | undefined;

  if (error instanceof Error) {
    originalError = error;
    message = error.message;
    details = opts.includeStackTrace ? error.stack : undefined;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    message = error.message || error.toString() || 'Unknown error occurred';
    details = JSON.stringify(error, null, 2);
  } else {
    message = 'Unknown error occurred';
  }

  // Apply message overrides
  if (opts.messageOverrides[message]) {
    message = opts.messageOverrides[message];
  }

  // Truncate message if too long
  if (message.length > opts.maxMessageLength) {
    message = message.substring(0, opts.maxMessageLength - 3) + '...';
  }

  // Classify error
  const { severity, category, recoverable } = classifyError(originalError || error, context);

  // Generate user-friendly message
  const userMessage = generateUserFriendlyMessage(message, category, context);

  // Generate recovery actions
  const recoveryActions = generateRecoveryActions(category, context);

  const dashboardError: DashboardError = {
    id,
    severity,
    category,
    message: userMessage,
    details,
    source: context.source,
    timestamp,
    recoverable,
    recoveryActions,
    context,
  };

  // Log error if configured
  if (opts.logToConsole) {
    console.error('[Dashboard Error]', dashboardError);
  }

  // Send to monitoring if configured
  if (opts.sendToMonitoring) {
    sendErrorToMonitoring(dashboardError);
  }

  return dashboardError;
}

/**
 * Classifies an error by severity, category, and recoverability
 */
function classifyError(
  error: Error | unknown,
  context: Record<string, unknown>
): {
  severity: ErrorSeverity;
  category: ErrorCategory;
  recoverable: boolean;
} {
  // Network errors
  if (isNetworkError(error)) {
    return {
      severity: ErrorSeverity.WARNING,
      category: ErrorCategory.NETWORK,
      recoverable: true,
    };
  }

  // API errors
  if (isApiError(error)) {
    const status = error.status || error.statusCode;
    if (status === 401 || status === 403) {
      return {
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.PERMISSION,
        recoverable: false,
      };
    }
    if (status >= 500) {
      return {
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.API,
        recoverable: true,
      };
    }
    return {
      severity: ErrorSeverity.WARNING,
      category: ErrorCategory.API,
      recoverable: true,
    };
  }

  // Data validation errors
  if (isDataValidationError(error) || context.operation === 'data-validation') {
    return {
      severity: ErrorSeverity.WARNING,
      category: ErrorCategory.DATA_VALIDATION,
      recoverable: true,
    };
  }

  // Client-side errors
  if (error instanceof TypeError || error instanceof ReferenceError) {
    return {
      severity: ErrorSeverity.ERROR,
      category: ErrorCategory.CLIENT,
      recoverable: false,
    };
  }

  // Default classification
  return {
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.UNKNOWN,
    recoverable: true,
  };
}

/**
 * Generates user-friendly error messages based on error category
 */
function generateUserFriendlyMessage(
  originalMessage: string,
  category: ErrorCategory,
  context: Record<string, unknown>
): string {
  const messageMap: Record<ErrorCategory, string> = {
    [ErrorCategory.NETWORK]: 'Unable to connect to the server. Please check your internet connection.',
    [ErrorCategory.API]: 'There was a problem loading the data. Please try again.',
    [ErrorCategory.DATA_VALIDATION]: 'Some data appears to be invalid. Showing available information.',
    [ErrorCategory.PERMISSION]: 'You don\'t have permission to access this data.',
    [ErrorCategory.CLIENT]: 'A technical error occurred. Please refresh the page.',
    [ErrorCategory.UNKNOWN]: 'An unexpected error occurred. Please try again.',
  };

  const baseMessage = messageMap[category];

  // Add context-specific details
  if (context.selectedModel && context.selectedModel !== 'all') {
    return `${baseMessage} (Model: ${context.selectedModel})`;
  }

  if (context.dateRange) {
    return `${baseMessage} (Date range: ${context.dateRange})`;
  }

  return baseMessage;
}

/**
 * Generates recovery actions based on error category
 */
function generateRecoveryActions(
  category: ErrorCategory,
  context: Record<string, unknown>
): RecoveryAction[] {
  const actions: RecoveryAction[] = [];

  switch (category) {
    case ErrorCategory.NETWORK:
      actions.push({
        id: 'retry',
        label: 'Try Again',
        action: () => window.location.reload(),
        primary: true,
      });
      break;

    case ErrorCategory.API:
      actions.push({
        id: 'refresh',
        label: 'Refresh Data',
        action: () => {
          if (context.refreshData && typeof context.refreshData === 'function') {
            context.refreshData();
          } else {
            window.location.reload();
          }
        },
        primary: true,
      });
      break;

    case ErrorCategory.DATA_VALIDATION:
      actions.push({
        id: 'continue',
        label: 'Continue with Available Data',
        action: () => {}, // No-op, just dismiss error
        primary: true,
      });
      if (context.refreshData) {
        actions.push({
          id: 'refresh',
          label: 'Refresh Data',
          action: context.refreshData,
        });
      }
      break;

    case ErrorCategory.PERMISSION:
      actions.push({
        id: 'login',
        label: 'Sign In Again',
        action: () => {
          // Redirect to login or trigger auth flow
          window.location.href = '/login';
        },
        primary: true,
      });
      break;

    case ErrorCategory.CLIENT:
      actions.push({
        id: 'reload',
        label: 'Reload Page',
        action: () => window.location.reload(),
        primary: true,
      });
      break;

    default:
      actions.push({
        id: 'retry',
        label: 'Try Again',
        action: () => {
          if (context.refreshData) {
            context.refreshData();
          } else {
            window.location.reload();
          }
        },
        primary: true,
      });
  }

  return actions;
}

/**
 * Creates a loading state configuration
 * 
 * @param state - Loading state type
 * @param options - Additional configuration
 * @returns Loading state configuration
 */
export function createLoadingState(
  state: LoadingState,
  options: {
    message?: string;
    progress?: number;
    overlay?: boolean;
  } = {}
): LoadingStateConfig {
  const defaultMessages: Record<LoadingState, string> = {
    [LoadingState.IDLE]: '',
    [LoadingState.LOADING]: 'Loading dashboard data...',
    [LoadingState.REFRESHING]: 'Refreshing data...',
    [LoadingState.UPDATING]: 'Updating...',
    [LoadingState.SYNCING]: 'Syncing data...',
  };

  return {
    state,
    message: options.message || defaultMessages[state],
    progress: options.progress,
    showSpinner: state !== LoadingState.IDLE,
    overlay: options.overlay || state === LoadingState.UPDATING,
  };
}

/**
 * Validates data quality and returns errors if below threshold
 * 
 * @param dataQuality - Data quality metrics
 * @param minConfidence - Minimum acceptable confidence (0-1)
 * @returns Dashboard error if quality is too low, null otherwise
 */
export function validateDataQuality(
  dataQuality: DataQualityMetrics,
  minConfidence: number = 0.5
): DashboardError | null {
  if (dataQuality.confidence < minConfidence) {
    return createDashboardError(
      `Data quality is below acceptable threshold (${Math.round(dataQuality.confidence * 100)}%)`,
      {
        source: 'DataQualityValidator',
        operation: 'data-validation',
        dataQuality,
        minConfidence,
      }
    );
  }

  if (dataQuality.warnings.length > 0) {
    // Create a warning-level error for data quality issues
    const error = createDashboardError(
      `Data quality warnings: ${dataQuality.warnings.slice(0, 2).join(', ')}`,
      {
        source: 'DataQualityValidator',
        operation: 'data-validation',
        dataQuality,
      }
    );
    error.severity = ErrorSeverity.WARNING;
    return error;
  }

  return null;
}

/**
 * Utility functions for error type detection
 */
function isNetworkError(error: unknown): boolean {
  return (
    error &&
    (error.code === 'NETWORK_ERROR' ||
      error.message?.includes('fetch') ||
      error.message?.includes('network') ||
      error.name === 'NetworkError')
  );
}

function isApiError(error: unknown): boolean {
  return (
    error &&
    (typeof error.status === 'number' ||
      typeof error.statusCode === 'number' ||
      error.name === 'ApiError')
  );
}

function isDataValidationError(error: unknown): boolean {
  return (
    error &&
    (error.name === 'ValidationError' ||
      error.message?.includes('validation') ||
      error.message?.includes('invalid data'))
  );
}

/**
 * Generates a unique error ID for tracking
 */
function generateErrorId(
  error: unknown,
  context: Record<string, unknown>,
  _timestamp: string
): string {
  const source = context.source || 'unknown';
  const operation = context.operation || 'unknown';
  const hash = Math.random().toString(36).substring(2, 8);
  return `${source}.${operation}.${hash}`;
}

/**
 * Sends error to monitoring service (placeholder implementation)
 */
function sendErrorToMonitoring(error: DashboardError): void {
  // In a real implementation, this would send to a service like Sentry,
  // LogRocket, or a custom monitoring endpoint
  if (process.env.NODE_ENV === 'development') {
    console.log('[Monitoring] Would send error:', error);
  }
}

/**
 * React hook for error handling (utility for components)
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { handleError, clearError, error, loading } = useErrorHandler('MyComponent');
 *   
 *   const fetchData = async () => {
 *     try {
 *       const data = await api.getData();
 *       // handle success
 *     } catch (err) {
 *       handleError(err, { operation: 'fetch-data' });
 *     }
 *   };
 *   
 *   return (
 *     <div>
 *       {error && <ErrorDisplay error={error} onDismiss={clearError} />}
 *       {loading && <LoadingIndicator />}
 *     </div>
 *   );
 * }
 * ```
 */
export function createErrorHandler(componentName: string) {
  return {
    handleError: (error: Error | string | unknown, context: Record<string, unknown> = {}) => {
      return createDashboardError(error, {
        ...context,
        source: componentName,
      });
    },
    
    createLoadingState: (state: LoadingState, options?: { message?: string; progress?: number }) => {
      return createLoadingState(state, options);
    },
    
    validateDataQuality: (dataQuality: DataQualityMetrics, minConfidence?: number) => {
      return validateDataQuality(dataQuality, minConfidence);
    },
  };
}

/**
 * Error boundary utility for React components
 */
export class DashboardErrorBoundary extends Error {
  public readonly dashboardError: DashboardError;

  constructor(originalError: Error, context: Record<string, unknown> = {}) {
    super(originalError.message);
    this.name = 'DashboardErrorBoundary';
    this.dashboardError = createDashboardError(originalError, {
      ...context,
      source: 'ErrorBoundary',
    });
  }
}

/**
 * Retry mechanism with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise that resolves with function result or rejects with final error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw createDashboardError(lastError!, {
    source: 'RetryMechanism',
    operation: 'retry-with-backoff',
    maxRetries,
    baseDelay,
  });
}