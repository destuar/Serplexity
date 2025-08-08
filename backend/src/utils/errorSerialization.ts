/**
 * @file errorSerialization.ts
 * @description Utility functions for proper error serialization in logs
 * 
 * Provides consistent error serialization across the application to avoid
 * empty error objects in logs and ensure proper debugging information.
 */

/**
 * Serializes an error object to a plain object with all relevant information
 * @param error - The error to serialize
 * @returns Serialized error object with name, message, stack, and additional context
 */
export function serializeError(error: unknown): Record<string, any> {
  if (error instanceof Error) {
    const serialized: Record<string, any> = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };

    // Add any additional enumerable properties
    for (const key in error) {
      if (key !== 'name' && key !== 'message' && key !== 'stack') {
        try {
          serialized[key] = (error as any)[key];
        } catch {
          // Skip properties that can't be serialized
        }
      }
    }

    return serialized;
  }

  if (typeof error === 'string') {
    return {
      type: 'string',
      message: error
    };
  }

  if (typeof error === 'object' && error !== null) {
    try {
      return {
        type: 'object',
        value: JSON.parse(JSON.stringify(error))
      };
    } catch {
      return {
        type: 'object',
        value: String(error)
      };
    }
  }

  return {
    type: typeof error,
    value: String(error)
  };
}

/**
 * Enhanced error logging with proper serialization
 * @param logger - The logger instance to use
 * @param message - Log message
 * @param error - Error to serialize
 * @param context - Additional context to include
 */
export function logError(
  logger: { error: (message: string, meta?: Record<string, unknown>) => void },
  message: string,
  error: unknown,
  context: Record<string, unknown> = {}
): void {
  logger.error(message, {
    error: serializeError(error),
    ...context,
    timestamp: new Date().toISOString()
  });
}

/**
 * Enhanced warning logging with proper error serialization
 * @param logger - The logger instance to use
 * @param message - Log message
 * @param error - Error to serialize (optional)
 * @param context - Additional context to include
 */
export function logWarning(
  logger: { warn: (message: string, meta?: Record<string, unknown>) => void },
  message: string,
  error?: unknown,
  context: Record<string, unknown> = {}
): void {
  const logData: Record<string, unknown> = {
    ...context,
    timestamp: new Date().toISOString()
  };

  if (error) {
    logData['error'] = serializeError(error);
  }

  logger.warn(message, logData);
}

/**
 * Create a structured error context object for debugging
 * @param operation - The operation that failed
 * @param error - The error that occurred
 * @param metadata - Additional metadata
 * @returns Structured error context
 */
export function createErrorContext(
  operation: string,
  error: unknown,
  metadata: Record<string, any> = {}
): Record<string, any> {
  return {
    operation,
    error: serializeError(error),
    metadata,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    nodeVersion: process.version
  };
}

/**
 * Helper to determine if an error is a specific type
 * @param error - Error to check
 * @param errorType - Error type to check against
 * @returns Whether the error is of the specified type
 */
export function isErrorOfType(error: unknown, errorType: string): boolean {
  if (error instanceof Error) {
    return error.name === errorType || error.constructor.name === errorType;
  }
  return false;
}

/**
 * Helper to check if an error indicates a network/connection issue
 * @param error - Error to check
 * @returns Whether the error appears to be network-related
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const networkErrorPatterns = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    'ENETUNREACH',
    'EHOSTUNREACH'
  ];

  const message = error.message.toLowerCase();
  const code = (error as any).code;

  return networkErrorPatterns.some(pattern => 
    message.includes(pattern.toLowerCase()) || code === pattern
  );
}

/**
 * Helper to check if an error indicates an authentication issue
 * @param error - Error to check
 * @returns Whether the error appears to be auth-related
 */
export function isAuthenticationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const authErrorPatterns = [
    'authentication',
    'unauthorized', 
    'invalid credentials',
    'access denied',
    'forbidden',
    'auth',
    'token'
  ];

  const message = error.message.toLowerCase();
  const code = (error as any).code;

  return authErrorPatterns.some(pattern => 
    message.includes(pattern) || 
    (typeof code === 'string' && code.toLowerCase().includes(pattern))
  ) || (error as any).status === 401 || (error as any).statusCode === 401;
}