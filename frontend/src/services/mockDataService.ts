import { DashboardData, DashboardFilters, ChartDataPoint } from '../types/dashboard';

// Helper function to generate realistic data based on company
const generateCompanyMultiplier = (companyName: string): number => {
  // Create a simple hash from company name for consistent but varied data
  const hash = companyName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return 0.5 + (hash % 100) / 100; // Value between 0.5 and 1.5
};

// Generate time series data
const generateTimeSeriesData = (days: number, baseValue: number, trend: 'up' | 'down' | 'stable' = 'stable'): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    let value = baseValue;
    if (trend === 'up') {
      value = baseValue + (days - i) * (Math.random() * 5 + 2);
    } else if (trend === 'down') {
      value = baseValue - (days - i) * (Math.random() * 3 + 1);
    } else {
      value = baseValue + (Math.random() - 0.5) * 20;
    }
    
    data.push({
      name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: Math.max(0, Math.round(value)),
      date: date.toISOString(),
    });
  }
  
  return data;
};

// Mock API delay
const delay = (ms: number = 1000): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Generate mock dashboard data
export const generateMockDashboardData = (filters: DashboardFilters, companyName: string): DashboardData => {
  const multiplier = generateCompanyMultiplier(companyName);
  const isPositiveTrend = multiplier > 0.8;
  
  // Adjust data based on date range
  const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  const days = daysMap[filters.dateRange];
  
  // Base metrics adjusted by company and date range
  const baseVisibility = Math.round(1200 * multiplier);
  const baseShareOfVoice = Math.round(65 * multiplier);
  
  return {
    brandShareOfVoice: {
      value: baseShareOfVoice,
      change: isPositiveTrend ? Math.round(Math.random() * 8 + 2) : -Math.round(Math.random() * 5 + 1),
      changeType: isPositiveTrend ? 'increase' : 'decrease',
    },
    brandVisibility: {
      value: baseVisibility,
      change: isPositiveTrend ? Math.round(Math.random() * 12 + 5) : -Math.round(Math.random() * 8 + 2),
      changeType: isPositiveTrend ? 'increase' : 'decrease',
      total: baseVisibility,
      featured: Math.round(baseVisibility * 0.3),
    },
    sentiment: {
      positive: Math.round(40 * multiplier),
      negative: Math.round(20 / multiplier),
      neutral: Math.round(40 * (2 - multiplier)),
    },
    keywordTrend: {
      data: generateTimeSeriesData(Math.min(days, 30), baseVisibility / 10, isPositiveTrend ? 'up' : 'stable'),
      totalKeywords: Math.round(450 * multiplier),
      trending: [
        { name: 'AI', value: Math.round(85 * multiplier) },
        { name: 'Technology', value: Math.round(72 * multiplier) },
        { name: 'Innovation', value: Math.round(68 * multiplier) },
        { name: 'Software', value: Math.round(55 * multiplier) },
      ],
    },
    sourceChanges: {
      data: generateTimeSeriesData(Math.min(days, 30), 150 * multiplier, 'stable'),
      totalSources: Math.round(1500 * multiplier),
      newSources: Math.round(45 * multiplier),
      removedSources: Math.round(12 / multiplier),
    },
    conceptSource: {
      concepts: [
        { concept: 'Product Quality', sources: Math.round(245 * multiplier), change: isPositiveTrend ? 12 : -5 },
        { concept: 'Customer Service', sources: Math.round(198 * multiplier), change: isPositiveTrend ? 8 : -3 },
        { concept: 'Innovation', sources: Math.round(167 * multiplier), change: isPositiveTrend ? 15 : -7 },
        { concept: 'Pricing', sources: Math.round(134 * multiplier), change: isPositiveTrend ? 5 : -2 },
        { concept: 'Reliability', sources: Math.round(112 * multiplier), change: isPositiveTrend ? 9 : -4 },
      ],
      totalConcepts: Math.round(856 * multiplier),
    },
    lastUpdated: new Date().toISOString(),
  };
};

// Mock API service
export class MockDataService {
  static async getDashboardData(filters: DashboardFilters, companyName: string): Promise<DashboardData> {
    await delay(800); // Simulate API delay
    return generateMockDashboardData(filters, companyName);
  }
  
  static async refreshData(filters: DashboardFilters, companyName: string): Promise<DashboardData> {
    await delay(1200); // Simulate longer refresh delay
    return generateMockDashboardData(filters, companyName);
  }
}

export default MockDataService; 