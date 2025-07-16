/**
 * @file companyService.ts
 * @description Service for managing company-related operations and API calls.
 * Provides company data management, logo handling, and company settings functionality.
 *
 * @dependencies
 * - ../lib/apiClient: For API communication.
 *
 * @exports
 * - Various functions for company management operations.
 */
import apiClient from '../lib/apiClient';
import { Company } from '../types/schemas';
import { SentimentScores } from '../types/dashboard';

export interface ShareOfVoiceResponse {
  shareOfVoice: number | null;
  change: number | null;
}

export type ShareOfVoiceHistoryResponse = Array<{
  date: string;
  shareOfVoice: number;
  aiModel: string;
}>;

export const updateCompany = async (companyId: string, updates: Partial<Company>): Promise<{ company: Company }> => {
  const { data } = await apiClient.put(`/companies/${companyId}`, updates);
  return data;
};

export const getShareOfVoice = async (companyId: string, filters?: { dateRange?: string; aiModel?: string }): Promise<ShareOfVoiceResponse> => {
  const params = new URLSearchParams();
  if (filters?.dateRange) params.append('dateRange', filters.dateRange);
  if (filters?.aiModel) params.append('aiModel', filters.aiModel);
  
  const { data } = await apiClient.get(`/companies/${companyId}/metrics/share-of-voice?${params.toString()}`);
  return data;
};

export const getShareOfVoiceHistory = async (companyId: string, filters?: { dateRange?: string; aiModel?: string }): Promise<ShareOfVoiceHistoryResponse> => {
  const params = new URLSearchParams();
  if (filters?.dateRange) params.append('dateRange', filters.dateRange);
  if (filters?.aiModel) params.append('aiModel', filters.aiModel);
  
  const { data } = await apiClient.get(`/companies/${companyId}/share-of-voice-history?${params.toString()}`);
  return data;
};

export const getSentimentData = async (companyId: string, filters: { dateRange?: string; aiModel?: string } = {}): Promise<{ sentimentData: SentimentScores | null }> => {
  const { data } = await apiClient.get(`/companies/${companyId}/metrics/sentiment`, {
    params: filters,
  });
  return data;
};

export interface TopRankingQuestion {
  id: string;
  question: string;
  // Supports legacy types as well as new fan-out keys.  Fallback to string keeps TS happy on future additions.
  type: 'visibility' | 'benchmark' | 'personal' |
        'paraphrase' | 'comparison' | 'temporal' | 'topical' | 'entity_broader' | 'entity_narrower' |
        'session_context' | 'user_profile' | 'vertical' | 'safety_probe' | string;
  productName?: string;
  bestPosition: number | null; // Allow null when company not mentioned
  totalMentions: number;
  averagePosition: number | null; // Allow null when company not mentioned
  bestResponse: string;
  bestResponseModel: string;
  responses?: Array<{
    model: string;
    response: string;
    position?: number | null; // Allow null when company not mentioned
    createdAt?: string;
  }>;
}

export interface TopRankingQuestionsResponse {
  questions: TopRankingQuestion[];
  totalCount: number;
  runId: string;
  runDate: string;
}

export interface CompetitorRanking {
  name: string;
  website?: string;
  shareOfVoice: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'stable';
  isUserCompany: boolean;
}

export interface CompetitorRankingsResponse {
  competitors: CompetitorRanking[];
  chartCompetitors: CompetitorRanking[];
  industryRanking: number | null;
  userCompany: CompetitorRanking | null;
}

export const getTopRankingQuestions = async (companyId: string, filters?: { aiModel?: string; limit?: number; questionType?: string }): Promise<TopRankingQuestionsResponse> => {
  const params = new URLSearchParams();
  if (filters?.aiModel) params.append('aiModel', filters.aiModel);
  if (filters?.questionType) params.append('questionType', filters.questionType);
  // Note: We don't send limit parameter anymore - fetch all questions and filter on frontend
  
  const { data } = await apiClient.get(`/companies/${companyId}/top-ranking-questions?${params.toString()}`);
  return data;
};

export const getCompetitorRankings = async (companyId: string, filters?: { dateRange?: string; aiModel?: string }): Promise<CompetitorRankingsResponse> => {
  const params = new URLSearchParams();
  if (filters?.dateRange) params.append('dateRange', filters.dateRange);
  if (filters?.aiModel) params.append('aiModel', filters.aiModel);
  
  const { data } = await apiClient.get(`/companies/${companyId}/metrics/competitor-rankings?${params.toString()}`);
  return data;
};

export const getAverageInclusionRate = async (companyId: string, filters?: { dateRange?: string; aiModel?: string }): Promise<{ averageInclusionRate: number | null; change: number | null; }> => {
  const params = new URLSearchParams();
  if (filters?.dateRange) params.append('dateRange', filters.dateRange);
  if (filters?.aiModel) params.append('aiModel', filters.aiModel);
  
  const { data } = await apiClient.get(`/companies/${companyId}/metrics/air?${params.toString()}`);
  return data;
};

export const getAveragePosition = async (companyId: string, filters?: { dateRange?: string; aiModel?: string }): Promise<{ averagePosition: number | null; change: number | null; }> => {
  const params = new URLSearchParams();
  if (filters?.dateRange) params.append('dateRange', filters.dateRange);
  if (filters?.aiModel) params.append('aiModel', filters.aiModel);
  
  const { data } = await apiClient.get(`/companies/${companyId}/metrics/position?${params.toString()}`);
  return data;
};

export const getSentimentOverTime = async (companyId: string, filters?: { dateRange?: string; aiModel?: string }): Promise<{ history: { date: string; score: number }[] }> => {
  const params = new URLSearchParams();
  if (filters?.dateRange) params.append('dateRange', filters.dateRange);
  if (filters?.aiModel) params.append('aiModel', filters.aiModel);

  const { data } = await apiClient.get(`/companies/${companyId}/metrics/sentiment-over-time?${params.toString()}`);
  return data;
}; 