/**
 * Temporary stubs to replace logfire functionality
 * This allows the service to run without logfire dependency
 */

export const trackLLMUsage = (..._args: any[]) => {
  // No-op stub
};

export const trackPerformance = (..._args: any[]) => {
  // No-op stub
};

export const trackError = (..._args: any[]) => {
  // No-op stub
};

export const createSpan = (name: string, fn: (span?: any) => any, _attributes?: any) => {
  // Execute function directly without span
  return fn(null);
};

export const initializeLogfire = (..._args: any[]) => {
  return Promise.resolve();
};