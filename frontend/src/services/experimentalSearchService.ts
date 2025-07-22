/**
 * @file experimentalSearchService.ts
 * @description Service for experimental search functionality and AI model testing.
 * Provides experimental search tools and AI model interaction capabilities.
 *
 * @dependencies
 * - ../lib/apiClient: For API communication.
 *
 * @exports
 * - Various functions for experimental search operations.
 */
import apiClient from '../lib/apiClient';

export interface Citation {
  url: string;
  title: string;
  domain: string;
}

export interface ModelAnswer {
  engine: string;
  answer: string;
  latencyMs: number;
  // Enhanced search agent properties
  citations?: Citation[];
  hasWebSearch?: boolean;
  tokensUsed?: number;
  requestId?: string;
}

interface SearchSettings {
  webSearchEnabled?: boolean;
  temperature?: number;
  persona?: string;
}

// Hit backend endpoint to get answer from specified model
export const searchModels = async (question: string, modelId: string, settings?: SearchSettings): Promise<ModelAnswer[]> => {
  const start = Date.now();
  
  try {
    // Use new search agent endpoint for better results
    const { data } = await apiClient.post('/search/agent', { 
      query: question, 
      modelId,
      enableWebSearch: settings?.webSearchEnabled ?? true,
      temperature: settings?.temperature ?? 0.7,
    });

    const latencyMs = Date.now() - start;

    // Transform response to match expected format with enhanced search agent data
    const answer: ModelAnswer = {
      engine: data.engine ?? modelId,
      answer: data.answer ?? '',
      latencyMs: data.latencyMs ?? latencyMs,
      // Enhanced search agent properties
      citations: data.citations || [],
      hasWebSearch: data.hasWebSearch ?? false,
      tokensUsed: data.tokensUsed,
      requestId: data.requestId,
    };

    return [answer];
  } catch (error) {
    // Fallback to legacy endpoint if search agent fails
    console.warn('Search agent failed, falling back to legacy search:', error);
    
    const { data } = await apiClient.post('/search', { query: question, modelId });
    const latencyMs = Date.now() - start;

    const answer: ModelAnswer = {
      engine: data.engine ?? modelId,
      answer: data.answer ?? '',
      latencyMs: data.latencyMs ?? latencyMs,
    };

    return [answer];
  }
}; 