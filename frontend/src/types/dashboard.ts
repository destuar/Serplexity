/**
 * @file dashboard.ts
 * @description Type definitions for dashboard data, analytics, and related interfaces.
 * Provides comprehensive type definitions for dashboard functionality and data structures.
 *
 * @dependencies
 * - None (pure type definitions).
 *
 * @exports
 * - Various TypeScript interfaces and types for dashboard functionality.
 */
import { Sparkles } from "lucide-react";
import {
  CompetitorRankingsResponse,
  TopRankingQuestion,
} from "../services/companyService";
import { SentimentDetail } from "./dashboardData";

// Model configuration that matches backend models.ts
export interface ModelConfig {
  id: string;
  engine: string;
  displayName: string;
  company: string;
  logoUrl?: string;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    engine: "openai",
    displayName: "ChatGPT",
    company: "OpenAI",
    logoUrl: "https://openai.com/favicon.ico",
  },
  "claude-3-5-haiku-20241022": {
    id: "claude-3-5-haiku-20241022",
    engine: "anthropic",
    displayName: "Claude",
    company: "Anthropic",
    logoUrl: "https://claude.ai/favicon.ico",
  },
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    engine: "google",
    displayName: "Gemini",
    company: "Google",
    logoUrl:
      "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
  },
  sonar: {
    id: "sonar",
    engine: "perplexity",
    displayName: "Perplexity",
    company: "Perplexity",
    logoUrl: "https://www.perplexity.ai/favicon.svg",
  },
  "ai-overview": {
    id: "ai-overview",
    engine: "google",
    displayName: "AI Overviews",
    company: "Google",
    logoUrl: "https://www.google.com/favicon.ico",
  },
};

// Engine mapping for backward compatibility and display purposes
export const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  google: "Gemini",
  gemini: "Gemini",
  perplexity: "Perplexity",
  "serplexity-summary": "Overall Summary",
};

// Get all available model options for filters
export const getModelFilterOptions = (
  preferences?: Record<string, boolean> | null
) => {
  const enabledIds = preferences
    ? Object.entries(preferences)
        .filter(([, enabled]) => enabled)
        .map(([id]) => id)
    : null;

  const models = Object.values(MODEL_CONFIGS).filter((m) =>
    enabledIds ? enabledIds.includes(m.id) : true
  );

  return [
    { value: "all", label: "All Models", logoUrl: undefined, icon: Sparkles },
    ...models.map((model) => ({
      value: model.id,
      label: model.displayName,
      logoUrl: model.logoUrl,
    })),
  ];
};

// Get display name for a model ID or engine
export const getModelDisplayName = (modelIdOrEngine: string): string => {
  // First check if it's a model ID
  const modelConfig = MODEL_CONFIGS[modelIdOrEngine];
  if (modelConfig) {
    return modelConfig.displayName;
  }

  // Then check if it's an engine name
  return ENGINE_DISPLAY_NAMES[modelIdOrEngine] || modelIdOrEngine;
};

// Dashboard data types and interfaces

export interface MetricData {
  value: number;
  change: number;
  changeType: "increase" | "decrease";
}

export interface ChartDataPoint {
  name: string;
  value: number;
  date?: string;
}

export interface SentimentData {
  positive: number;
  negative: number;
  neutral: number;
}

export interface BrandVisibilityData extends MetricData {
  total: number;
  featured: number;
}

export interface KeywordTrendData {
  data: ChartDataPoint[];
  totalKeywords: number;
  trending: ChartDataPoint[];
}

export interface SourceChangesData {
  data: ChartDataPoint[];
  totalSources: number;
  newSources: number;
  removedSources: number;
}

export interface ConceptSourceData {
  concepts: Array<{
    concept: string;
    sources: number;
    change: number;
  }>;
  totalConcepts: number;
}

export interface DashboardFilters {
  dateRange: "24h" | "7d" | "30d" | "90d" | "1y";
  aiModel:
    | "all"
    | "gpt-4.1-mini"
    | "claude-3-5-haiku-20241022"
    | "gemini-2.5-flash"
    | "sonar"
    | "ai-overview";
  company: string;
  competitors: string[];
}

export interface DashboardData {
  // Simple metric values
  shareOfVoice: number;
  shareOfVoiceChange: number | null;
  averageInclusionRate: number;
  averageInclusionChange: number | null;
  averagePosition: number;
  averagePositionChange: number | null;
  sentimentScore: number | null;
  sentimentChange: number | null;
  topRankingsCount: number | null;
  rankingsChange: number | null;

  // Detailed sentiment scores, which may not always be present
  sentimentDetails?: SentimentDetail[];

  // Complex, pre-computed data objects
  competitorRankings: CompetitorRankingsResponse;
  citationRankings?: {
    sources: Array<{
      domain: string;
      name: string;
      shareOfVoice: number;
      citationCount: number;
      uniqueUrls: number;
      sampleTitle: string;
    }>;
    chartSources: Array<{
      domain: string;
      name: string;
      shareOfVoice: number;
      citationCount: number;
      uniqueUrls: number;
      sampleTitle: string;
    }>;
    totalCitations: number;
  };
  topQuestions: TopRankingQuestion[];
  sentimentOverTime: {
    date: string;
    sentimentScore: number;
    aiModel: string;
  }[];
  shareOfVoiceHistory: {
    date: string;
    shareOfVoice: number;
    aiModel: string;
  }[];
  inclusionRateHistory: {
    date: string;
    inclusionRate: number;
    aiModel: string;
  }[];

  // Report metadata
  lastUpdated: string;
  id?: string;
  runId?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  aiModel?: string;

  // AI Visibility Summary and Optimization Tasks

  optimizationTasks?: import("../services/reportService").OptimizationTask[];
}

export interface PreloadedMetricSet {
  shareOfVoice: number;
  shareOfVoiceChange: number | null;
  averageInclusionRate: number;
  averageInclusionChange: number | null;
  averagePosition: number;
  averagePositionChange: number | null;
  sentimentScore: number | null;
  sentimentChange: number | null;
  topRankingsCount: number | null;
  rankingsChange: number | null;
  sentimentDetails?: SentimentDetail; // Optional since it's a specific metric
}

// Legacy Metric interface - use SentimentDetail from dashboardData.ts instead

export interface SentimentRating {
  quality: number;
  priceValue: number;
  brandReputation: number;
  brandTrust: number;
  customerService: number;
  summaryDescription: string;
}

export interface SentimentScores {
  companyName: string;
  industry: string;
  ratings: SentimentRating[];
}

// Legacy SentimentScoreValue interface - use SentimentRating from dashboardData.ts instead
