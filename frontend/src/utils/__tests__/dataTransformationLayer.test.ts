/**
 * @file dataTransformationLayer.test.ts
 * @description Unit tests for data transformation and validation layer
 * Tests the comprehensive API response validation and normalization
 * 
 * @author Dashboard Team
 * @version 1.0.0 - Initial test suite for data transformation
 */
import {
  transformDashboardData,
  validateNormalizedData,
  NormalizedDashboardData as TransformationNormalizedData
} from '../dataTransformationLayer';
import {
  RawDashboardData
} from '../../types/dashboardData';

describe('dataTransformationLayer', () => {
  // Mock raw API data for testing
  const mockRawData: RawDashboardData = {
    shareOfVoice: '35.2',
    shareOfVoiceChange: 0.8,
    averageInclusionRate: 78.5,
    averageInclusionChange: null,
    averagePosition: '2.3',
    sentimentScore: '4.6',
    sentimentChange: '-0.1',
    
    shareOfVoiceHistory: [
      {
        date: '2025-01-15',
        aiModel: 'gpt-4',
        shareOfVoice: '35.2',
        inclusionRate: 78.5
      },
      {
        date: '2025-01-15',
        aiModel: 'claude',
        shareOfVoice: 28.8,
        inclusionRate: '65.2'
      }
    ],
    
    inclusionRateHistory: [
      {
        date: '2025-01-15',
        aiModel: 'gpt-4',
        inclusionRate: 78.5
      },
      {
        date: '2025-01-15',
        aiModel: 'claude',
        inclusionRate: '65.2'
      }
    ],
    
    sentimentOverTime: [
      {
        date: '2025-01-15',
        aiModel: 'gpt-4',
        sentimentScore: '4.6'
      },
      {
        date: '2025-01-15',
        aiModel: 'claude',
        sentimentScore: 4.3
      }
    ],
    
    sentimentDetails: [
      {
        id: '1',
        name: 'Detailed Sentiment Scores',
        engine: 'gpt-4',
        confidence: '0.95',
        value: {
          overallSentiment: '4.6',
          ratings: [{
            quality: 4.2,
            priceValue: '4.8',
            brandReputation: 4.9,
            brandTrust: '4.1',
            customerService: 4.7
          }]
        }
      }
    ],
    
    lastUpdated: '2025-01-15T10:00:00Z'
  };

  const defaultOptions: TransformationOptions = {
    strictMode: false,
    includeDebugInfo: true,
    minConfidence: 0.3,
    defaultValues: {}
  };

  // Note: normalizeNumericField is internal to transformDashboardData

  // Note: validateHistoricalData is internal to transformDashboardData

  // Note: transformSentimentDetails is internal to transformDashboardData

  // Note: calculateDataQuality is internal to transformDashboardData

  describe('transformDashboardData', () => {
    it('should transform complete raw data successfully', () => {
      const result = transformDashboardData(mockRawData, defaultOptions);
      
      expect(result.shareOfVoice).toBe(35.2);
      expect(result.shareOfVoiceChange).toBe(0.8);
      expect(result.sentimentScore).toBe(4.6);
      expect(result.shareOfVoiceHistory).toHaveLength(2);
      expect(result.dataQuality).toBeDefined();
      expect(result.dataQuality.confidence).toBeGreaterThan(0);
    });

    it('should handle missing optional fields', () => {
      const sparseRawData: RawDashboardData = {
        shareOfVoice: 35.2,
        lastUpdated: '2025-01-15T10:00:00Z'
      };

      const result = transformDashboardData(sparseRawData, defaultOptions);
      
      expect(result.shareOfVoice).toBe(35.2);
      expect(result.shareOfVoiceChange).toBeNull();
      expect(result.shareOfVoiceHistory).toHaveLength(0);
      expect(result.dataQuality.missingFields.length).toBeGreaterThan(0);
    });

    it('should respect strict mode', () => {
      const invalidRawData: RawDashboardData = {
        shareOfVoice: 'invalid-number',
        shareOfVoiceChange: null,
        lastUpdated: '2025-01-15T10:00:00Z'
      };

      const strictOptions = { ...defaultOptions, strictMode: true };
      
      expect(() => {
        transformDashboardData(invalidRawData, strictOptions);
      }).toThrow();
    });

    it('should apply default values', () => {
      const rawDataWithMissing: RawDashboardData = {
        shareOfVoice: null,
        lastUpdated: '2025-01-15T10:00:00Z'
      };

      const optionsWithDefaults = {
        ...defaultOptions,
        defaultValues: { shareOfVoice: 0 }
      };

      const result = transformDashboardData(rawDataWithMissing, optionsWithDefaults);
      
      expect(result.shareOfVoice).toBe(0);
    });

    it('should include debug info when requested', () => {
      const debugOptions = { ...defaultOptions, includeDebugInfo: true };
      const result = transformDashboardData(mockRawData, debugOptions);
      
      expect(result.dataQuality.warnings).toBeDefined();
      expect(result.lastUpdated).toBeDefined();
    });
  });

  describe('validateNormalizedData', () => {
    it('should validate correct normalized data', () => {
      const validData: TransformationNormalizedData = {
        shareOfVoice: 35.2,
        shareOfVoiceChange: 0.8,
        averageInclusionRate: 78.5,
        averageInclusionChange: -0.2,
        averagePosition: 2.3,
        sentimentScore: 4.6,
        sentimentChange: -0.1,
        shareOfVoiceHistory: [],
        inclusionRateHistory: [],
        sentimentOverTime: [],
        sentimentDetails: [],
        topQuestions: [],
        competitorRankings: [],
        lastUpdated: '2025-01-15T10:00:00Z',
        dataQuality: {
          totalFields: 10,
          validFields: 10,
          missingFields: [],
          invalidFields: [],
          warnings: [],
          confidence: 1.0
        }
      };

      const result = validateNormalizedData(validData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify data type violations', () => {
      const invalidData = {
        shareOfVoice: 'should-be-number',
        shareOfVoiceHistory: 'should-be-array',
        dataQuality: null
      } as any;

      const result = validateNormalizedData(invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should suggest improvements', () => {
      const dataWithIssues: TransformationNormalizedData = {
        shareOfVoice: 35.2,
        shareOfVoiceChange: null,
        averageInclusionRate: null,
        averageInclusionChange: null,
        averagePosition: null,
        sentimentScore: null,
        sentimentChange: null,
        shareOfVoiceHistory: [],
        inclusionRateHistory: [],
        sentimentOverTime: [],
        sentimentDetails: [],
        topQuestions: [],
        competitorRankings: [],
        lastUpdated: '2025-01-15T10:00:00Z',
        dataQuality: {
          totalFields: 10,
          validFields: 1,
          missingFields: ['sentimentScore', 'averageInclusionRate'],
          invalidFields: [],
          warnings: [],
          confidence: 0.1
        }
      };

      const result = validateNormalizedData(dataWithIssues);
      
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('historical data'))).toBe(true);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null input gracefully', () => {
      expect(() => {
        transformDashboardData(null as any, defaultOptions);
      }).toThrow('Raw data is required');
    });

    it('should handle circular references', () => {
      const circularData: any = { shareOfVoice: 35.2 };
      circularData.self = circularData;

      // Should not throw or hang
      expect(() => {
        transformDashboardData(circularData, defaultOptions);
      }).not.toThrow();
    });

    it('should handle deeply nested invalid data', () => {
      const deeplyInvalidData: RawDashboardData = {
        sentimentDetails: [
          {
            value: {
              ratings: [
                {
                  quality: { invalid: 'nested-object' } as any,
                  priceValue: 'not-a-number'
                }
              ]
            }
          }
        ] as any,
        lastUpdated: '2025-01-15T10:00:00Z'
      };

      const result = transformDashboardData(deeplyInvalidData, defaultOptions);
      
      // Should handle gracefully
      expect(result).toBeDefined();
      expect(result.dataQuality.warnings.length).toBeGreaterThan(0);
    });

    it('should handle extremely large datasets', () => {
      const largeHistoryData = Array.from({ length: 1000 }, (_, i) => ({
        date: `2025-01-${Math.floor(i / 30) + 1}`,
        aiModel: 'gpt-4',
        shareOfVoice: Math.random() * 100
      }));

      const largeRawData: RawDashboardData = {
        shareOfVoice: 35.2,
        shareOfVoiceHistory: largeHistoryData,
        lastUpdated: '2025-01-15T10:00:00Z'
      };

      const start = Date.now();
      const result = transformDashboardData(largeRawData, defaultOptions);
      const duration = Date.now() - start;

      expect(result).toBeDefined();
      expect(result.shareOfVoiceHistory).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});