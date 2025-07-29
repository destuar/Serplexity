/**
 * Type definitions for PydanticAI service responses
 */

import { CompetitorInfo as BaseCompetitorInfo } from "../services/llmService";

export interface ExtendedCompetitorInfo extends BaseCompetitorInfo {
  confidence?: number;
  [key: string]: unknown;
}

export interface PydanticProvider {
  id: string;
  status: 'available' | 'unavailable';
  [key: string]: unknown;
}

export interface PydanticResponse {
  answer: string;
  confidence?: number;
  has_web_search?: boolean;
  brand_mentions_count?: number;
  citations?: Array<{
    url: string;
    title: string;
  }>;
  [key: string]: unknown;
}

export interface PydanticQuestionResult {
  data: {
    result?: {
      activeQuestions: Array<{ query: string; type: string; intent: string }>;
      suggestedQuestions: Array<{ query: string; type: string; intent: string }>;
    };
    activeQuestions?: Array<{ query: string; type: string; intent: string }>;
    suggestedQuestions?: Array<{ query: string; type: string; intent: string }>;
    active_questions?: Array<{ query: string; type: string; intent: string }>;
    suggested_questions?: Array<{ query: string; type: string; intent: string }>;
    [key: string]: unknown;
  };
}


// Use actual Prisma Client instead of interface - import from @prisma/client
// This interface is removed to prevent any type usage