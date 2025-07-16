/**
 * @file useBlogPosts.ts
 * @description Custom hook for managing blog posts data and operations.
 * Provides blog post fetching, creation, updating, and deletion functionality.
 *
 * @dependencies
 * - react: For state management and effects.
 * - ../lib/apiClient: For API communication.
 *
 * @exports
 * - useBlogPosts: Hook for blog posts functionality.
 */
import { useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/apiClient';

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
    status?: number;
  };
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  tags?: string[];
  estimatedReadTime?: number;
}

interface UseBlogPostsOptions {
  limit?: number;
  publishedOnly?: boolean;
}

interface UseBlogPostsReturn {
  posts: BlogPost[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useBlogPosts = (options: UseBlogPostsOptions = {}): UseBlogPostsReturn => {
  const { limit, publishedOnly = true } = options;
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (publishedOnly) {
        params.append('published', 'true');
      }
      if (limit) {
        params.append('limit', limit.toString());
      }
      
      const response = await apiClient.get(`/blog?${params.toString()}`);
      let fetchedPosts = response.data;
      
      // Sort by publication date (newest first) and limit if needed
      fetchedPosts = fetchedPosts
        .sort((a: BlogPost, b: BlogPost) => {
          const dateA = new Date(a.publishedAt || a.createdAt).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt).getTime();
          return dateB - dateA;
        });
        
      if (limit && fetchedPosts.length > limit) {
        fetchedPosts = fetchedPosts.slice(0, limit);
      }
      
      setPosts(fetchedPosts);
    } catch (err: unknown) {
      const error = err as ApiError;
      const errorMessage = error.response?.data?.error || 'Failed to fetch articles';
      setError(errorMessage);
      console.error('Error fetching blog posts:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, publishedOnly]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    refetch: fetchPosts,
  };
};

export default useBlogPosts; 