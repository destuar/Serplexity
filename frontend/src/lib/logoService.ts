/**
 * Service for fetching company logos from website URLs
 */

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
 * Get favicon using Google's favicon service
 */
function getGoogleFavicon(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

/**
 * Generate a fallback logo with company initials
 */
function generateFallbackLogo(companyName: string): string {
  const initials = companyName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  
  // Create a data URL for a simple colored circle with initials
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  canvas.width = 64;
  canvas.height = 64;
  
  // Generate a color based on company name
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
  const colorIndex = companyName.length % colors.length;
  
  // Draw circle background
  ctx.fillStyle = colors[colorIndex];
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, 2 * Math.PI);
  ctx.fill();
  
  // Draw initials
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 32, 32);
  
  return canvas.toDataURL();
}

/**
 * Main function to get company logo
 */
export function getCompanyLogo(
  websiteUrl: string, 
  companyName: string
): LogoResult {
  const domain = extractDomain(websiteUrl);
  
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
      return getCompanyLogo(company.website, company.name);
    } catch {
      return null;
    }
  });
} 