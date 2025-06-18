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
  aiModel: 'gemini-pro' | 'gpt-4' | 'claude-3' | 'all';
  company: string;
  competitors: string[];
}

export interface DashboardData {
  brandShareOfVoice: MetricData;
  brandVisibility: BrandVisibilityData;
  sentiment: SentimentData;
  keywordTrend: KeywordTrendData;
  sourceChanges: SourceChangesData;
  conceptSource: ConceptSourceData;
  lastUpdated: string;
} 