import { CompetitorRankingsResponse, TopRankingQuestion } from '../services/companyService';

// Model configuration that matches backend models.ts
export interface ModelConfig {
  id: string;
  engine: string;
  displayName: string;
  company: string;
  logoUrl?: string;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    engine: 'openai',
    displayName: 'ChatGPT 4.1',
    company: 'OpenAI',
    logoUrl: 'https://openai.com/favicon.ico'
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    engine: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    company: 'Anthropic',
    logoUrl: 'https://www.anthropic.com/favicon.ico'
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    engine: 'google',
    displayName: 'Gemini 2.5 Flash',
    company: 'Google',
    logoUrl: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg'
  },
  'sonar': {
    id: 'sonar',
    engine: 'perplexity',
    displayName: 'Perplexity Sonar',
    company: 'Perplexity',
    logoUrl: 'https://www.perplexity.ai/favicon.svg'
  }
};

// Engine mapping for backward compatibility and display purposes
export const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  'openai': 'ChatGPT',
  'anthropic': 'Anthropic',
  'google': 'Google Gemini', 
  'gemini': 'Google Gemini',
  'perplexity': 'Perplexity',
  'serplexity-summary': 'Overall Summary'
};

// Get all available model options for filters
export const getModelFilterOptions = () => [
  { value: 'all', label: 'All Models', logoUrl: undefined },
  ...Object.values(MODEL_CONFIGS).map(model => ({
    value: model.id,
    label: model.displayName,
    logoUrl: model.logoUrl
  }))
];

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
  changeType: 'increase' | 'decrease';
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
  dateRange: '7d' | '30d' | '90d' | '1y';
  aiModel: 'all' | 'gpt-4.1-mini' | 'claude-3-5-haiku-20241022' | 'gemini-2.5-flash' | 'sonar';
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
  sentimentDetails?: Metric<SentimentScoreValue>[];

  // Complex, pre-computed data objects
  competitorRankings: CompetitorRankingsResponse;
  topQuestions: TopRankingQuestion[];
  sentimentOverTime: { date: string; score: number }[];
  shareOfVoiceHistory: { date: string; shareOfVoice: number }[];

  // Report metadata
  lastUpdated: string;
  id?: string;
  runId?: string;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  aiModel?: string;
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
  sentimentDetails?: Metric<SentimentScoreValue>; // Optional since it's a specific metric
}

export interface Metric<T = any> {
  id: string;
  runId: string;
  name: string;
  value: T;
  engine: string;
  createdAt: string;
}

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

export interface SentimentScoreValue {
  ratings: SentimentRating[];
} 