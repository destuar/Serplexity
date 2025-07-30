/**
 * @file logoService.ts
 * @description Service for managing company logos and favicon generation.
 * Provides functionality for logo upload, processing, and favicon generation.
 *
 * @dependencies
 * - ../lib/apiClient: For API communication.
 *
 * @exports
 * - uploadLogo: Function for uploading company logos.
 * - generateFavicon: Function for generating favicon from logo.
 */

import SerplexityLogo from '/Serplexity.svg?url';

export interface LogoResult {
  url: string;
  source: 'clearbit' | 'favicon' | 'google' | 'fallback';
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

/**
 * Get company logo from Clearbit Logo API
 */
function getClearbitLogo(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

/**
 * Main function to get company logo
 */
export function getCompanyLogo(
  websiteUrl: string
): LogoResult {
  const domain = extractDomain(websiteUrl);
  
  if (domain === 'serplexity.com') {
    return { url: SerplexityLogo, source: 'fallback' };
  }
  
  // Try Clearbit first (highest quality)
  const clearbitLogo = getClearbitLogo(domain);
  return { url: clearbitLogo, source: 'clearbit' };
}

/**
 * Batch get logos for multiple companies
 */
export function getBatchCompanyLogos(
  companies: Array<{ website?: string; name: string }>
): Array<LogoResult | null> {
  return companies.map((company) => {
    if (!company.website) return null;
    try {
      return getCompanyLogo(company.website);
    } catch {
      return null;
    }
  });
} 