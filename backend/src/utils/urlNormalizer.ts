/**
 * @file urlNormalizer.ts
 * @description Backend utility functions for URL normalization and processing.
 * Provides URL cleaning, validation, and standardization functionality for server-side use.
 *
 * @dependencies
 * - zod: For schema validation.
 *
 * @exports
 * - normalizeUrl: Function to normalize URL input to a standard format
 * - flexibleUrlSchema: Zod schema for flexible URL validation
 */
import { z } from 'zod';

/**
 * Normalize a URL input to a standard format
 * Handles various input formats and converts them to https://www.domain.com
 */
export const normalizeUrl = (input: string): string => {
  if (!input) return input;
  
  let url = input.trim();
  
  // Handle empty or whitespace-only input
  if (!url) return url;
  
  // Remove any existing protocol
  url = url.replace(/^https?:\/\//, '');
  
  // Remove trailing slashes
  url = url.replace(/\/+$/, '');
  
  // Handle www. prefix
  const hasWww = url.startsWith('www.');
  if (hasWww) {
    url = url.replace(/^www\./, '');
  }
  
  // Validate that we have at least a domain
  if (!url || url.length < 3 || !url.includes('.')) {
    throw new Error('Invalid domain format');
  }
  
  // Add back www. and https://
  return `https://www.${url}`;
};

/**
 * Flexible URL schema that accepts various input formats and normalizes them
 */
export const flexibleUrlSchema = z.string()
  .min(1, 'Website URL is required')
  .transform((val) => {
    try {
      return normalizeUrl(val);
    } catch (_error) {
      // If normalization fails, return original value for further validation
      return val;
    }
  })
  .refine((val) => {
    try {
      const url = new URL(val);
      // Ensure it's http or https
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Please enter a valid website URL (e.g., example.com, www.example.com, https://example.com)');

/**
 * Strict URL schema for cases where we need exact URL format
 */
export const strictUrlSchema = z.string().url('Must be a valid URL'); 