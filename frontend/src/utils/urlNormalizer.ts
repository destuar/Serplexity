/**
 * @file urlNormalizer.ts
 * @description Utility functions for URL normalization and processing.
 * Provides URL cleaning, validation, and standardization functionality.
 *
 * @dependencies
 * - None (pure utility functions).
 *
 * @exports
 * - Various utility functions for URL processing and normalization.
 */
import { z } from 'zod';

// Flexible URL normalizer function
export const normalizeUrl = (input: string): string => {
  if (!input) return input;
  
  let url = input.trim();
  
  // Handle empty or whitespace-only input
  if (!url) return url;
  
  // Remove any existing protocol
  url = url.replace(/^https?:\/\//, '');
  
  // Remove trailing slashes
  url = url.replace(/\/+$/, '');
  
  // Remove www. if present to normalize
  const hasWww = url.startsWith('www.');
  if (hasWww) {
    url = url.replace(/^www\./, '');
  }
  
  // Basic validation - ensure we have at least a domain structure
  if (!url || url.length < 3 || !url.includes('.')) {
    // Return original input for validation to catch
    return input;
  }
  
  // Add back www. and https://
  return `https://www.${url}`;
};

// Custom URL validation that accepts flexible formats
export const flexibleUrlSchema = z.string()
  .min(1, 'Website URL is required')
  .transform((val) => normalizeUrl(val))
  .refine((val) => {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, 'Please enter a valid website URL (e.g., website.com, www.website.com)');