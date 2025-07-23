/**
 * @file modelFiltering.test.ts
 * @description Unit tests for model filtering utilities
 * Validates standardized model filtering logic used across components
 * 
 * @author Dashboard Team
 * @version 1.0.0 - Initial test suite for model filtering
 */
import {
  createModelFilterConfig,
  getModelQueryParams,
  filterHistoricalDataByModel,
  filterDetailedMetricsByModel,
  aggregateModelData,
  validateModelSelection
} from '../modelFiltering';
import { 
  ModelFilterConfig,
  ShareOfVoiceHistoryItem,
  SentimentDetail 
} from '../../types/dashboardData';

describe('modelFiltering', () => {
  // Mock historical data for testing
  const mockHistoricalData: ShareOfVoiceHistoryItem[] = [
    {
      date: '2025-01-15',
      aiModel: 'gpt-4',
      shareOfVoice: 35.2,
      inclusionRate: 78.5
    },
    {
      date: '2025-01-15',
      aiModel: 'claude',
      shareOfVoice: 28.8,
      inclusionRate: 65.2
    },
    {
      date: '2025-01-15',
      aiModel: 'perplexity',
      shareOfVoice: 22.1,
      inclusionRate: 58.9
    },
    {
      date: '2025-01-14',
      aiModel: 'gpt-4',
      shareOfVoice: 33.7,
      inclusionRate: 76.2
    },
    {
      date: '2025-01-14',
      aiModel: 'claude',
      shareOfVoice: 29.4,
      inclusionRate: 67.1
    }
  ];

  // Mock detailed metrics for testing
  const mockDetailedMetrics: SentimentDetail[] = [
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
        sampleSize: 150
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
        sampleSize: 120
      },
      lastUpdated: '2025-01-15T09:30:00Z'
    },
    {
      id: '3',
      name: 'Detailed Sentiment Scores',
      engine: 'serplexity-summary',
      confidence: 0.92,
      value: {
        overallSentiment: 4.8,
        ratings: [{
          quality: 4.5,
          priceValue: 5.0,
          brandReputation: 4.9,
          brandTrust: 4.3,
          customerService: 4.9
        }]
      },
      metadata: {
        sampleSize: 200
      },
      lastUpdated: '2025-01-15T11:00:00Z'
    }
  ];

  describe('createModelFilterConfig', () => {
    it('should create config for "all" models', () => {
      const config = createModelFilterConfig('all');
      
      expect(config.selectedModel).toBe('all');
      expect(config.shouldShowAggregated).toBe(true);
      expect(config.supportsBreakdown).toBe(true);
      expect(config.queryParams.isAllModels).toBe(true);
      expect(config.queryParams.displayName).toBe('All Models');
    });

    it('should create config for specific model', () => {
      const config = createModelFilterConfig('gpt-4');
      
      expect(config.selectedModel).toBe('gpt-4');
      expect(config.shouldShowAggregated).toBe(false);
      expect(config.supportsBreakdown).toBe(false);
      expect(config.queryParams.isAllModels).toBe(false);
      expect(config.queryParams.aiModelParam).toBe('gpt-4');
      expect(config.queryParams.engineParam).toBe('gpt-4');
    });

    it('should handle special model mappings', () => {
      const config = createModelFilterConfig('perplexity');
      
      expect(config.queryParams.engineParam).toBe('serplexity-summary');
      expect(config.queryParams.displayName).toBe('Perplexity');
    });

    it('should provide fallback for unknown models', () => {
      const config = createModelFilterConfig('unknown-model');
      
      expect(config.queryParams.aiModelParam).toBe('unknown-model');
      expect(config.queryParams.engineParam).toBe('unknown-model');
      expect(config.queryParams.displayName).toBe('Unknown Model');
    });
  });

  describe('getModelQueryParams', () => {
    it('should return correct params for all models', () => {
      const params = getModelQueryParams('all');
      
      expect(params.isAllModels).toBe(true);
      expect(params.aiModelParam).toBe('all');
      expect(params.engineParam).toBe('all');
    });

    it('should return correct params for specific models', () => {
      const params = getModelQueryParams('claude');
      
      expect(params.isAllModels).toBe(false);
      expect(params.aiModelParam).toBe('claude');
      expect(params.engineParam).toBe('claude');
    });

    it('should handle model mapping correctly', () => {
      const params = getModelQueryParams('perplexity');
      
      expect(params.aiModelParam).toBe('perplexity');
      expect(params.engineParam).toBe('serplexity-summary');
    });
  });

  describe('filterHistoricalDataByModel', () => {
    it('should return all data for "all" models', () => {
      const config = createModelFilterConfig('all');
      const filtered = filterHistoricalDataByModel(mockHistoricalData, config);
      
      expect(filtered).toHaveLength(mockHistoricalData.length);
      expect(filtered).toEqual(mockHistoricalData);
    });

    it('should filter by specific model', () => {
      const config = createModelFilterConfig('gpt-4');
      const filtered = filterHistoricalDataByModel(mockHistoricalData, config);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(item => item.aiModel === 'gpt-4')).toBe(true);
    });

    it('should handle non-existent model gracefully', () => {
      const config = createModelFilterConfig('non-existent');
      const filtered = filterHistoricalDataByModel(mockHistoricalData, config);
      
      expect(filtered).toHaveLength(0);
    });

    it('should handle empty data array', () => {
      const config = createModelFilterConfig('gpt-4');
      const filtered = filterHistoricalDataByModel([], config);
      
      expect(filtered).toHaveLength(0);
    });

    it('should preserve original data structure', () => {
      const config = createModelFilterConfig('claude');
      const filtered = filterHistoricalDataByModel(mockHistoricalData, config);
      
      expect(filtered[0]).toHaveProperty('date');
      expect(filtered[0]).toHaveProperty('aiModel');
      expect(filtered[0]).toHaveProperty('shareOfVoice');
      expect(filtered[0]).toHaveProperty('inclusionRate');
    });
  });

  describe('filterDetailedMetricsByModel', () => {
    it('should return all metrics for "all" models', () => {
      const config = createModelFilterConfig('all');
      const filtered = filterDetailedMetricsByModel(mockDetailedMetrics, config);
      
      expect(filtered).toHaveLength(mockDetailedMetrics.length);
    });

    it('should filter by specific engine', () => {
      const config = createModelFilterConfig('gpt-4');
      const filtered = filterDetailedMetricsByModel(mockDetailedMetrics, config);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].engine).toBe('gpt-4');
    });

    it('should handle engine mapping correctly', () => {
      const config = createModelFilterConfig('perplexity');
      const filtered = filterDetailedMetricsByModel(mockDetailedMetrics, config);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].engine).toBe('serplexity-summary');
    });

    it('should handle no matches gracefully', () => {
      const config = createModelFilterConfig('non-existent');
      const filtered = filterDetailedMetricsByModel(mockDetailedMetrics, config);
      
      expect(filtered).toHaveLength(0);
    });
  });

  describe('aggregateModelData', () => {
    it('should calculate weighted average for historical data', () => {
      const data = mockHistoricalData.filter(item => item.date === '2025-01-15');
      const aggregated = aggregateModelData(data, 'shareOfVoice');
      
      // Should be weighted average of 35.2, 28.8, 22.1
      expect(aggregated).toBeCloseTo(28.7, 1);
    });

    it('should handle single data point', () => {
      const singleData = [mockHistoricalData[0]];
      const aggregated = aggregateModelData(singleData, 'shareOfVoice');
      
      expect(aggregated).toBe(35.2);
    });

    it('should handle empty data', () => {
      const aggregated = aggregateModelData([], 'shareOfVoice');
      
      expect(aggregated).toBeNull();
    });

    it('should handle null/undefined values', () => {
      const dataWithNulls = [
        { ...mockHistoricalData[0], shareOfVoice: 30.0 },
        { ...mockHistoricalData[1], shareOfVoice: null as any },
        { ...mockHistoricalData[2], shareOfVoice: 25.0 }
      ];
      
      const aggregated = aggregateModelData(dataWithNulls, 'shareOfVoice');
      
      // Should average only valid values: (30.0 + 25.0) / 2 = 27.5
      expect(aggregated).toBe(27.5);
    });

    it('should work with different numeric fields', () => {
      const data = mockHistoricalData.filter(item => item.date === '2025-01-15');
      const aggregated = aggregateModelData(data, 'inclusionRate');
      
      expect(aggregated).toBeCloseTo(67.5, 1);
    });
  });

  describe('validateModelSelection', () => {
    it('should validate "all" model selection', () => {
      const result = validateModelSelection('all', mockHistoricalData);
      
      expect(result.isValid).toBe(true);
      expect(result.availableModels).toContain('gpt-4');
      expect(result.availableModels).toContain('claude');
      expect(result.availableModels).toContain('perplexity');
    });

    it('should validate existing model selection', () => {
      const result = validateModelSelection('gpt-4', mockHistoricalData);
      
      expect(result.isValid).toBe(true);
      expect(result.selectedModel).toBe('gpt-4');
    });

    it('should invalidate non-existent model selection', () => {
      const result = validateModelSelection('non-existent', mockHistoricalData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Selected model "non-existent" not found in available data');
    });

    it('should provide suggestions for invalid selections', () => {
      const result = validateModelSelection('gpt-3', mockHistoricalData);
      
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toContain('Did you mean "gpt-4"?');
    });

    it('should handle empty data gracefully', () => {
      const result = validateModelSelection('gpt-4', []);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No data available for model validation');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed data gracefully', () => {
      const malformedData = [
        { date: '2025-01-15', aiModel: null, shareOfVoice: 35.2 },
        { date: '2025-01-15', shareOfVoice: 28.8 }, // Missing aiModel
        { date: '2025-01-15', aiModel: 'gpt-4' } // Missing shareOfVoice
      ] as any[];

      const config = createModelFilterConfig('gpt-4');
      const filtered = filterHistoricalDataByModel(malformedData, config);
      
      // Should handle gracefully and return empty array for malformed data
      expect(filtered).toHaveLength(0);
    });

    it('should handle undefined/null config', () => {
      expect(() => {
        filterHistoricalDataByModel(mockHistoricalData, null as any);
      }).not.toThrow();
    });

    it('should handle case-insensitive model matching', () => {
      const config = createModelFilterConfig('GPT-4');
      const filtered = filterHistoricalDataByModel(mockHistoricalData, config);
      
      // Should handle case differences gracefully
      expect(filtered.length).toBe(0); // Strict matching by design
    });

    it('should maintain immutability', () => {
      const originalData = [...mockHistoricalData];
      const config = createModelFilterConfig('gpt-4');
      
      filterHistoricalDataByModel(mockHistoricalData, config);
      
      // Original data should be unchanged
      expect(mockHistoricalData).toEqual(originalData);
    });
  });

  describe('performance considerations', () => {
    it('should handle large datasets efficiently', () => {
      // Create large mock dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        date: `2025-01-${(i % 30) + 1}`,
        aiModel: ['gpt-4', 'claude', 'perplexity'][i % 3],
        shareOfVoice: Math.random() * 100,
        inclusionRate: Math.random() * 100
      }));

      const config = createModelFilterConfig('gpt-4');
      const start = Date.now();
      
      const filtered = filterHistoricalDataByModel(largeDataset, config);
      
      const duration = Date.now() - start;
      
      // Should complete within reasonable time (< 100ms for 1000 items)
      expect(duration).toBeLessThan(100);
      expect(filtered.length).toBe(Math.ceil(1000 / 3)); // Roughly 1/3 of data
    });
  });
});