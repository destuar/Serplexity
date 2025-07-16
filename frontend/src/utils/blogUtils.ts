/**
 * @file blogUtils.ts
 * @description Utility functions for blog post processing and management.
 * Provides blog-related utilities for content processing and formatting.
 *
 * @dependencies
 * - None (pure utility functions).
 *
 * @exports
 * - Various utility functions for blog post management.
 */
export const formatBlogDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const estimateReadTime = (content: string): number => {
  // Average reading speed: 250 words per minute
  const wordsPerMinute = 250;
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return Math.max(1, minutes); // Minimum 1 minute
};

export const extractFirstCategory = (tags?: string[]): string => {
  if (!tags || tags.length === 0) return 'Research';
  return tags[0];
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

export const stripHtmlTags = (html: string): string => {
  // Simple HTML tag removal for excerpt display
  return html.replace(/<[^>]*>/g, '').trim();
}; 