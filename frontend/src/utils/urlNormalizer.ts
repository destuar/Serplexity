import { z } from 'zod';

// Flexible URL normalizer function
export const normalizeUrl = (input: string): string => {
  if (!input) return input;
  
  let url = input.trim();
  
  // Remove any existing protocol
  url = url.replace(/^https?:\/\//, '');
  
  // Remove www. if present to normalize
  const hasWww = url.startsWith('www.');
  if (hasWww) {
    url = url.replace(/^www\./, '');
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