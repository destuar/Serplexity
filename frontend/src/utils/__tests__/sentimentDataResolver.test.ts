/**
 * @file sentimentDataResolver.test.ts
 * @description Unit tests for sentiment data resolution utilities
 * Validates the core functionality that fixes the 5.0 vs 4.6 data discrepancy
 * 
 * @author Dashboard Team
 * @version 1.0.0 - Initial test suite for sentiment resolution
 */
import {
  resolveCurrentSentimentValue,
  resolveCurrentSentimentChange,
  extractSentimentFromHistory,
  extractSentimentFromDetails,
  validateSentimentDataSources
} from '../sentimentDataResolver';
import { 
  SentimentDataContext, 
  SentimentResolutionOptions,
  SentimentDetail,
  SentimentHistoryItem 
} from '../../types/dashboardData';

describe('sentimentDataResolver', () => {
  // Mock data for testing
  const mockSentimentDetails: SentimentDetail[] = [
    {
      id: '1',
      name: 'Detailed Sentiment Scores',
      engine: 'gpt-4',
      confidence: 0.95,
      value: {
        overallSentiment: 4.6,
        ratings: [{
          quality: 4.2,
          priceValue: 4.8,
          brandReputation: 4.9,
          brandTrust: 4.1,
          customerService: 4.7
        }]
      },
      metadata: {
        sampleSize: 150,
        dataSource: 'api'
      },
      lastUpdated: '2025-01-15T10:00:00Z'
    },
    {
      id: '2', 
      name: 'Detailed Sentiment Scores',
      engine: 'claude',
      confidence: 0.88,
      value: {
        overallSentiment: 4.3,
        ratings: [{
          quality: 4.0,
          priceValue: 4.5,
          brandReputation: 4.6,
          brandTrust: 3.9,
          customerService: 4.4
        }]
      },
      metadata: {
        sampleSize: 120,
        dataSource: 'api'
      },
      lastUpdated: '2025-01-15T09:30:00Z'
    }
  ];

  const mockSentimentHistory: SentimentHistoryItem[] = [
    {
      date: '2025-01-15',
      aiModel: 'gpt-4',
      sentimentScore: 4.6
    },
    {
      date: '2025-01-14',
      aiModel: 'gpt-4',
      sentimentScore: 4.5
    },
    {
      date: '2025-01-15',
      aiModel: 'claude',
      sentimentScore: 4.3
    },
    {
      date: '2025-01-14',
      aiModel: 'claude',
      sentimentScore: 4.2
    }
  ];

  const defaultOptions: SentimentResolutionOptions = {
    selectedModel: 'all',
    dateRange: '30d' as const,
    preferAggregated: true,
    minConfidence: 0.7
  };

  describe('resolveCurrentSentimentValue', () => {
    it('should prioritize time series data for all models', () => {
      const context: SentimentDataContext = {
        sentimentScore: 5.0, // This should be overridden
        sentimentOverTime: mockSentimentHistory,
        sentimentDetails: mockSentimentDetails
      };

      const result = resolveCurrentSentimentValue(context, defaultOptions);
      
      expect(result.value).toBe(4.45); // Average of 4.6 and 4.3
      expect(result.source).toBe('time-series');
      expect(result.isAggregated).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should return specific model value when model is selected', () => {
      const context: SentimentDataContext = {
        sentimentScore: 5.0,
        sentimentOverTime: mockSentimentHistory,
        sentimentDetails: mockSentimentDetails
      };

      const options = { ...defaultOptions, selectedModel: 'gpt-4' as const };
      const result = resolveCurrentSentimentValue(context, options);
      
      expect(result.value).toBe(4.6);
      expect(result.source).toBe('time-series');
      expect(result.isAggregated).toBe(false);
    });

    it('should fallback to detailed metrics when time series unavailable', () => {
      const context: SentimentDataContext = {
        sentimentScore: 5.0,
        sentimentDetails: mockSentimentDetails
      };

      const result = resolveCurrentSentimentValue(context, defaultOptions);
      
      expect(result.value).toBe(4.45); // Average of detailed metrics
      expect(result.source).toBe('detailed-metrics');
      expect(result.isAggregated).toBe(true);
    });

    it('should use direct field as last resort', () => {
      const context: SentimentDataContext = {
        sentimentScore: 5.0
      };

      const result = resolveCurrentSentimentValue(context, defaultOptions);
      
      expect(result.value).toBe(5.0);
      expect(result.source).toBe('direct-field');
      expect(result.isAggregated).toBe(false);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should return null when no data is available', () => {
      const context: SentimentDataContext = {};

      const result = resolveCurrentSentimentValue(context, defaultOptions);
      
      expect(result.value).toBeNull();
      expect(result.source).toBe('unavailable');
      expect(result.confidence).toBe(0);
    });

    it('should respect minimum confidence threshold', () => {
      const lowConfidenceDetails: SentimentDetail[] = [
        {
          ...mockSentimentDetails[0],
          confidence: 0.3 // Below threshold
        }
      ];

      const context: SentimentDataContext = {
        sentimentScore: 5.0,
        sentimentDetails: lowConfidenceDetails
      };

      const options = { ...defaultOptions, minConfidence: 0.7 };
      const result = resolveCurrentSentimentValue(context, options);
      
      // Should fallback to direct field since detailed metrics don't meet confidence
      expect(result.value).toBe(5.0);
      expect(result.source).toBe('direct-field');
    });
  });

  describe('resolveCurrentSentimentChange', () => {
    it('should return API-provided change when available', () => {
      const context: SentimentDataContext = {
        sentimentChange: 0.2
      };

      const result = resolveCurrentSentimentChange(context, defaultOptions);
      
      expect(result.change).toBe(0.2);
      expect(result.source).toBe('api-provided');
      expect(result.confidence).toBe(1.0);
    });

    it('should calculate change from time series data', () => {
      const context: SentimentDataContext = {
        sentimentOverTime: mockSentimentHistory
      };

      const result = resolveCurrentSentimentChange(context, defaultOptions);
      
      // Should calculate based on latest vs previous aggregated values
      expect(result.change).toBeDefined();
      expect(result.source).toBe('calculated');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should return null when insufficient data', () => {
      const context: SentimentDataContext = {
        sentimentOverTime: [mockSentimentHistory[0]] // Only one data point
      };

      const result = resolveCurrentSentimentChange(context, defaultOptions);
      
      expect(result.change).toBeNull();
      expect(result.source).toBe('unavailable');
      expect(result.confidence).toBe(0);
    });
  });

  describe('extractSentimentFromHistory', () => {
    it('should extract aggregated value for all models', () => {
      const result = extractSentimentFromHistory(mockSentimentHistory, 'all', '30d');
      
      expect(result.value).toBe(4.45); // Average of latest values
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should extract specific model value', () => {
      const result = extractSentimentFromHistory(mockSentimentHistory, 'gpt-4', '30d');
      
      expect(result.value).toBe(4.6);
      expect(result.isAggregated).toBe(false);
    });

    it('should return null for non-existent model', () => {
      const result = extractSentimentFromHistory(mockSentimentHistory, 'non-existent', '30d');
      
      expect(result.value).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle empty history', () => {
      const result = extractSentimentFromHistory([], 'all', '30d');
      
      expect(result.value).toBeNull();
      expect(result.warnings).toContain('No sentiment history data available');
    });
  });

  describe('extractSentimentFromDetails', () => {
    it('should extract aggregated value from detailed metrics', () => {
      const result = extractSentimentFromDetails(mockSentimentDetails, 'all', 0.7);
      
      expect(result.value).toBe(4.45); // Average of 4.6 and 4.3
      expect(result.isAggregated).toBe(true);
    });

    it('should extract specific engine value', () => {
      const result = extractSentimentFromDetails(mockSentimentDetails, 'gpt-4', 0.7);
      
      expect(result.value).toBe(4.6);
      expect(result.isAggregated).toBe(false);
    });

    it('should filter by confidence threshold', () => {
      const result = extractSentimentFromDetails(mockSentimentDetails, 'all', 0.9);
      
      // Only gpt-4 (0.95) meets the threshold, claude (0.88) is filtered out
      expect(result.value).toBe(4.6);
      expect(result.warnings).toContain('Some metrics filtered due to low confidence');
    });
  });

  describe('validateSentimentDataSources', () => {
    it('should validate complete data sources', () => {
      const context: SentimentDataContext = {
        sentimentScore: 4.5,
        sentimentChange: 0.1,
        sentimentOverTime: mockSentimentHistory,
        sentimentDetails: mockSentimentDetails
      };

      const result = validateSentimentDataSources(context);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should identify missing data sources', () => {
      const context: SentimentDataContext = {
        sentimentScore: 4.5
        // Missing other data sources
      };

      const result = validateSentimentDataSources(context);
      
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain('Missing sentiment history data - trends may be inaccurate');
      expect(result.warnings).toContain('Missing detailed sentiment metrics - breakdowns unavailable');
    });

    it('should validate data consistency', () => {
      const inconsistentContext: SentimentDataContext = {
        sentimentScore: 5.0, // Different from history average
        sentimentOverTime: mockSentimentHistory
      };

      const result = validateSentimentDataSources(inconsistentContext);
      
      expect(result.warnings.some(w => w.includes('inconsistency'))).toBe(true);
    });

    it('should suggest improvements', () => {
      const context: SentimentDataContext = {
        sentimentScore: 4.5,
        sentimentDetails: [{
          ...mockSentimentDetails[0],
          confidence: 0.4 // Low confidence
        }]
      };

      const result = validateSentimentDataSources(context);
      
      expect(result.suggestions).toContain('Consider increasing sample size for more reliable sentiment metrics');
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined values gracefully', () => {
      const context: SentimentDataContext = {
        sentimentScore: null,
        sentimentChange: undefined,
        sentimentOverTime: undefined
      };

      const result = resolveCurrentSentimentValue(context, defaultOptions);
      
      expect(result.value).toBeNull();
      expect(result.source).toBe('unavailable');
    });

    it('should handle malformed history data', () => {
      const malformedHistory = [
        { date: '2025-01-15', aiModel: 'gpt-4', sentimentScore: NaN },
        { date: '2025-01-14', aiModel: 'gpt-4', sentimentScore: Infinity },
        { date: '2025-01-13', aiModel: 'gpt-4', sentimentScore: 4.5 }
      ] as SentimentHistoryItem[];

      const result = extractSentimentFromHistory(malformedHistory, 'gpt-4', '30d');
      
      expect(result.value).toBe(4.5); // Should use the valid value
      expect(result.warnings).toContain('Invalid sentiment scores found in history data');
    });

    it('should handle extreme date ranges', () => {
      const result = extractSentimentFromHistory(mockSentimentHistory, 'all', '7d');
      
      // Should still work with short date range
      expect(result.value).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});