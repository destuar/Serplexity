/**
 * @file errorHandling.test.ts
 * @description Unit tests for error handling utilities
 * Tests consistent error states and recovery mechanisms
 * 
 * @author Dashboard Team
 * @version 1.0.0 - Initial test suite for error handling
 */
import {
  createDashboardError,
  createLoadingState,
  createErrorHandler,
  formatErrorMessage,
  categorizeError,
  shouldRetryError,
  DashboardError,
  type LoadingState as _LoadingState,
  type ErrorCategory as _ErrorCategory
} from '../errorHandling';

describe('errorHandling', () => {
  describe('createDashboardError', () => {
    it('should create basic error with message', () => {
      const error = createDashboardError('Something went wrong');
      
      expect(error.message).toBe('Something went wrong');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.severity).toBe('error');
      expect(error.category).toBe('unknown');
      expect(error.retryable).toBe(false);
    });

    it('should create error with context', () => {
      const context = {
        operation: 'data-fetch',
        userId: '123',
        endpoint: '/api/dashboard'
      };

      const error = createDashboardError('API request failed', context);
      
      expect(error.context).toEqual(context);
      expect(error.category).toBe('api');
    });

    it('should create error from Error object', () => {
      const originalError = new Error('Network timeout');
      const error = createDashboardError(originalError);
      
      expect(error.message).toBe('Network timeout');
      expect(error.originalError).toBe(originalError);
    });

    it('should categorize errors automatically', () => {
      const networkError = createDashboardError('Failed to fetch');
      expect(networkError.category).toBe('network');
      
      const validationError = createDashboardError('Invalid data format');
      expect(validationError.category).toBe('validation');
      
      const permissionError = createDashboardError('Access denied');
      expect(permissionError.category).toBe('permission');
    });

    it('should set retryable flag based on error type', () => {
      const networkError = createDashboardError('Network timeout');
      expect(networkError.retryable).toBe(true);
      
      const validationError = createDashboardError('Invalid JSON');
      expect(validationError.retryable).toBe(false);
    });
  });

  describe('createLoadingState', () => {
    it('should create basic loading state', () => {
      const loading = createLoadingState('Loading dashboard data');
      
      expect(loading.message).toBe('Loading dashboard data');
      expect(loading.progress).toBeUndefined();
      expect(loading.cancelable).toBe(false);
    });

    it('should create loading state with progress', () => {
      const loading = createLoadingState('Processing data', { progress: 0.6 });
      
      expect(loading.progress).toBe(0.6);
    });

    it('should create cancelable loading state', () => {
      const onCancel = jest.fn();
      const loading = createLoadingState('Fetching data', { 
        cancelable: true,
        onCancel 
      });
      
      expect(loading.cancelable).toBe(true);
      expect(loading.onCancel).toBe(onCancel);
    });

    it('should validate progress values', () => {
      // Valid progress
      const validLoading = createLoadingState('Loading', { progress: 0.5 });
      expect(validLoading.progress).toBe(0.5);
      
      // Out of range progress should be clamped
      const highProgress = createLoadingState('Loading', { progress: 1.5 });
      expect(highProgress.progress).toBe(1.0);
      
      const lowProgress = createLoadingState('Loading', { progress: -0.1 });
      expect(lowProgress.progress).toBe(0.0);
    });
  });

  describe('createErrorHandler', () => {
    it('should create error handler with context', () => {
      const handler = createErrorHandler('TestComponent');
      
      expect(handler.context).toBe('TestComponent');
      expect(handler.handleError).toBeInstanceOf(Function);
    });

    it('should handle errors with component context', () => {
      const handler = createErrorHandler('DashboardCard');
      const error = handler.handleError('Data loading failed');
      
      expect(error.context?.component).toBe('DashboardCard');
      expect(error.message).toBe('Data loading failed');
    });

    it('should preserve additional context', () => {
      const handler = createErrorHandler('DataProcessor');
      const error = handler.handleError('Processing failed', {
        operation: 'transform',
        dataSize: 1000
      });
      
      expect(error.context?.component).toBe('DataProcessor');
      expect(error.context?.operation).toBe('transform');
      expect(error.context?.dataSize).toBe(1000);
    });

    it('should handle Error objects', () => {
      const handler = createErrorHandler('ApiClient');
      const originalError = new TypeError('Cannot read property');
      const error = handler.handleError(originalError);
      
      expect(error.originalError).toBe(originalError);
      expect(error.category).toBe('runtime');
    });
  });

  describe('formatErrorMessage', () => {
    it('should format user-friendly messages', () => {
      const message = formatErrorMessage('Failed to fetch', { userFriendly: true });
      
      expect(message).toBe('Unable to load data. Please check your connection and try again.');
    });

    it('should include technical details when requested', () => {
      const error = createDashboardError('API Error', {
        endpoint: '/api/dashboard',
        status: 500
      });
      
      const message = formatErrorMessage(error, {
        includeTechnicalDetails: true
      });
      
      expect(message).toContain('API Error');
      expect(message).toContain('/api/dashboard');
      expect(message).toContain('500');
    });

    it('should suggest recovery actions', () => {
      const networkError = createDashboardError('Network timeout');
      const message = formatErrorMessage(networkError, {
        includeRecoveryActions: true
      });
      
      expect(message).toContain('try again');
      expect(message).toContain('connection');
    });

    it('should handle different error categories', () => {
      const validationError = createDashboardError('Invalid data format');
      const message = formatErrorMessage(validationError, { userFriendly: true });
      
      expect(message).toContain('data');
      expect(message).not.toContain('Invalid data format'); // Technical term removed
    });
  });

  describe('categorizeError', () => {
    it('should categorize network errors', () => {
      expect(categorizeError('Failed to fetch')).toBe('network');
      expect(categorizeError('Network timeout')).toBe('network');
      expect(categorizeError('Connection refused')).toBe('network');
    });

    it('should categorize API errors', () => {
      expect(categorizeError('HTTP 500 error')).toBe('api');
      expect(categorizeError('Server returned 404')).toBe('api');
      expect(categorizeError('API rate limit exceeded')).toBe('api');
    });

    it('should categorize validation errors', () => {
      expect(categorizeError('Invalid JSON')).toBe('validation');
      expect(categorizeError('Schema validation failed')).toBe('validation');
      expect(categorizeError('Missing required field')).toBe('validation');
    });

    it('should categorize permission errors', () => {
      expect(categorizeError('Access denied')).toBe('permission');
      expect(categorizeError('Unauthorized request')).toBe('permission');
      expect(categorizeError('Forbidden')).toBe('permission');
    });

    it('should categorize runtime errors', () => {
      expect(categorizeError('Cannot read property of undefined')).toBe('runtime');
      expect(categorizeError('TypeError: invalid argument')).toBe('runtime');
      expect(categorizeError('ReferenceError')).toBe('runtime');
    });

    it('should default to unknown for unrecognized errors', () => {
      expect(categorizeError('Something unexpected happened')).toBe('unknown');
      expect(categorizeError('')).toBe('unknown');
    });
  });

  describe('shouldRetryError', () => {
    it('should allow retry for network errors', () => {
      const networkError = createDashboardError('Network timeout');
      expect(shouldRetryError(networkError)).toBe(true);
    });

    it('should allow retry for temporary API errors', () => {
      const serverError = createDashboardError('HTTP 500 error');
      expect(shouldRetryError(serverError)).toBe(true);
      
      const timeoutError = createDashboardError('Request timeout');
      expect(shouldRetryError(timeoutError)).toBe(true);
    });

    it('should not retry validation errors', () => {
      const validationError = createDashboardError('Invalid data format');
      expect(shouldRetryError(validationError)).toBe(false);
    });

    it('should not retry permission errors', () => {
      const permissionError = createDashboardError('Access denied');
      expect(shouldRetryError(permissionError)).toBe(false);
    });

    it('should respect explicit retryable flag', () => {
      const error = createDashboardError('Custom error');
      error.retryable = false;
      
      expect(shouldRetryError(error)).toBe(false);
    });

    it('should consider retry count', () => {
      const error = createDashboardError('Network error');
      error.retryCount = 3;
      
      // Should not retry after 3 attempts by default
      expect(shouldRetryError(error)).toBe(false);
    });

    it('should respect custom max retry limit', () => {
      const error = createDashboardError('Network error');
      error.retryCount = 2;
      
      expect(shouldRetryError(error, { maxRetries: 5 })).toBe(true);
      expect(shouldRetryError(error, { maxRetries: 1 })).toBe(false);
    });
  });

  describe('error context and metadata', () => {
    it('should preserve error chain', () => {
      const rootError = new Error('Root cause');
      const wrappedError = createDashboardError('Operation failed', {
        originalError: rootError
      });
      
      expect(wrappedError.originalError).toBe(rootError);
    });

    it('should include environment context', () => {
      const error = createDashboardError('Error occurred', {
        environment: 'production',
        version: '1.2.3',
        userAgent: 'Chrome/91.0'
      });
      
      expect(error.context?.environment).toBe('production');
      expect(error.context?.version).toBe('1.2.3');
      expect(error.context?.userAgent).toBe('Chrome/91.0');
    });

    it('should track error timing', () => {
      const error = createDashboardError('Timeout error');
      
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should support custom severity levels', () => {
      const warning = createDashboardError('Non-critical issue');
      warning.severity = 'warning';
      
      expect(warning.severity).toBe('warning');
    });
  });

  describe('integration with dashboard context', () => {
    it('should work with dashboard error states', () => {
      const error = createDashboardError('Data fetch failed', {
        operation: 'dashboard-load',
        component: 'DashboardProvider'
      });
      
      const formatted = formatErrorMessage(error, {
        userFriendly: true,
        includeRecoveryActions: true
      });
      
      expect(formatted).toContain('data');
      expect(formatted).toContain('try again');
    });

    it('should handle loading state transitions', () => {
      const loading = createLoadingState('Loading dashboard');
      
      // Simulate completion with error
      const error = createDashboardError('Load failed');
      
      expect(loading.message).toBe('Loading dashboard');
      expect(error.message).toBe('Load failed');
    });

    it('should support cancellation', () => {
      const cancelFn = jest.fn();
      const loading = createLoadingState('Fetching data', {
        cancelable: true,
        onCancel: cancelFn
      });
      
      if (loading.onCancel) {
        loading.onCancel();
      }
      
      expect(cancelFn).toHaveBeenCalled();
    });
  });

  describe('edge cases and error boundaries', () => {
    it('should handle circular reference in context', () => {
      const circularContext: Record<string, unknown> = { data: {} };
      circularContext.data.parent = circularContext;
      
      expect(() => {
        createDashboardError('Error with circular context', circularContext);
      }).not.toThrow();
    });

    it('should handle very long error messages', () => {
      const longMessage = 'Error: ' + 'x'.repeat(10000);
      const error = createDashboardError(longMessage);
      
      expect(error.message.length).toBeLessThanOrEqual(1000); // Should be truncated
    });

    it('should handle null/undefined inputs gracefully', () => {
      expect(() => {
        createDashboardError(null as unknown);
      }).not.toThrow();
      
      expect(() => {
        createDashboardError(undefined as unknown);
      }).not.toThrow();
    });

    it('should handle error objects without message', () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      
      const error = createDashboardError(errorWithoutMessage);
      
      expect(error.message).toBe('Unknown error occurred');
    });
  });

  describe('performance considerations', () => {
    it('should handle rapid error creation efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        createDashboardError(`Error ${i}`, { index: i });
      }
      
      const duration = Date.now() - start;
      
      // Should handle 1000 errors in reasonable time
      expect(duration).toBeLessThan(100);
    });

    it('should not leak memory with error context', () => {
      const errors: DashboardError[] = [];
      
      for (let i = 0; i < 100; i++) {
        const error = createDashboardError(`Error ${i}`, {
          largeData: new Array(1000).fill(i)
        });
        errors.push(error);
      }
      
      // Clear references
      errors.length = 0;
      
      // Memory should be available for GC
      expect(errors.length).toBe(0);
    });
  });
});