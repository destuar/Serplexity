/**
 * @file chartDataProcessing.test.ts
 * @description Unit tests for chart data processing utilities
 * Tests the core functionality that eliminates 500+ lines of duplicated chart logic
 * 
 * @author Dashboard Team
 * @version 1.0.0 - Initial test suite for chart processing
 */
import {
  processTimeSeriesData,
  extractCurrentValue,
  calculateYAxisScaling,
  calculateXAxisInterval,
  parseApiDate,
  formatChartDate
} from '../chartDataProcessing';
import {
  ShareOfVoiceHistoryItem,
  SentimentHistoryItem,
  MetricsChartDataPoint,
  SentimentChartDataPoint,
  ChartProcessingOptions
} from '../../types/dashboardData';

describe('chartDataProcessing', () => {
  // Mock data for testing
  const mockShareOfVoiceData: ShareOfVoiceHistoryItem[] = [
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
    },
    {
      date: '2025-01-13',
      aiModel: 'gpt-4',
      shareOfVoice: 31.5,
      inclusionRate: 74.8
    }
  ];

  const mockSentimentData: SentimentHistoryItem[] = [
    {
      date: '2025-01-15',
      aiModel: 'gpt-4',
      sentimentScore: 4.6
    },
    {
      date: '2025-01-15', 
      aiModel: 'claude',
      sentimentScore: 4.3
    },
    {
      date: '2025-01-14',
      aiModel: 'gpt-4',
      sentimentScore: 4.5
    },
    {
      date: '2025-01-14',
      aiModel: 'claude',
      sentimentScore: 4.2
    }
  ];

  const defaultOptions: ChartProcessingOptions = {
    dateRange: '30d',
    selectedModel: 'all',
    showModelBreakdown: false,
    includeZeroPoint: true
  };

  describe('parseApiDate', () => {
    it('should parse ISO date strings', () => {
      const date = parseApiDate('2025-01-15T10:30:00Z');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2025);
      expect(date?.getMonth()).toBe(0); // January = 0
      expect(date?.getDate()).toBe(15);
    });

    it('should parse simple date strings', () => {
      const date = parseApiDate('2025-01-15');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2025);
    });

    it('should handle invalid dates', () => {
      const date = parseApiDate('invalid-date');
      expect(date).toBeNull();
    });

    it('should handle empty/null input', () => {
      expect(parseApiDate('')).toBeNull();
      expect(parseApiDate(null as unknown as string)).toBeNull();
      expect(parseApiDate(undefined as unknown as string)).toBeNull();
    });
  });

  describe('formatChartDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2025-01-15');
      const formatted = formatChartDate(date);
      expect(formatted).toBe('Jan 15');
    });

    it('should handle month boundaries', () => {
      const date = new Date('2025-12-31');
      const formatted = formatChartDate(date);
      expect(formatted).toBe('Dec 31');
    });
  });

  describe('calculateYAxisScaling', () => {
    it('should calculate appropriate scaling for percentages', () => {
      const values = [25.5, 45.2, 67.8, 89.1];
      const { yAxisMax, ticks } = calculateYAxisScaling(values, true, 100);
      
      expect(yAxisMax).toBe(100);
      expect(ticks).toContain(0);
      expect(ticks).toContain(100);
      expect(ticks.length).toBeGreaterThan(3);
    });

    it('should calculate scaling for sentiment scores', () => {
      const values = [3.2, 4.1, 4.6, 4.9];
      const { yAxisMax, ticks } = calculateYAxisScaling(values, false);
      
      expect(yAxisMax).toBeGreaterThan(4.9);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBe(yAxisMax);
    });

    it('should handle empty values', () => {
      const { yAxisMax, ticks } = calculateYAxisScaling([], true, 100);
      
      expect(yAxisMax).toBe(100);
      expect(ticks).toContain(0);
      expect(ticks).toContain(100);
    });

    it('should handle single value', () => {
      const values = [50.0];
      const { yAxisMax, ticks } = calculateYAxisScaling(values, true, 100);
      
      expect(yAxisMax).toBe(100);
      expect(ticks).toContain(50);
    });
  });

  describe('calculateXAxisInterval', () => {
    it('should return 0 for small datasets', () => {
      expect(calculateXAxisInterval(5)).toBe(0);
      expect(calculateXAxisInterval(10)).toBe(0);
    });

    it('should return appropriate intervals for larger datasets', () => {
      expect(calculateXAxisInterval(15)).toBe(1);
      expect(calculateXAxisInterval(25)).toBe(2);
      expect(calculateXAxisInterval(35)).toBe(3);
    });

    it('should handle zero or negative input', () => {
      expect(calculateXAxisInterval(0)).toBe(0);
      expect(calculateXAxisInterval(-5)).toBe(0);
    });
  });

  // Note: filterDataByDateRange is internal to processTimeSeriesData

  // Note: aggregateDataByDate is internal to processTimeSeriesData

  // Note: createZeroDataPoint is internal to processTimeSeriesData

  describe('extractCurrentValue', () => {
    const mockChartData: MetricsChartDataPoint[] = [
      {
        date: 'Jan 14',
        fullDate: '2025-01-14',
        shareOfVoice: 31.5,
        inclusionRate: 71.65,
        'gpt-4': 33.7,
        'claude': 29.4
      },
      {
        date: 'Jan 15',
        fullDate: '2025-01-15',
        shareOfVoice: 32.0,
        inclusionRate: 71.85,
        'gpt-4': 35.2,
        'claude': 28.8
      }
    ];

    it('should extract current value from single line mode', () => {
      const value = extractCurrentValue(mockChartData, 'shareOfVoice', [], false);
      expect(value).toBe(32.0); // Latest shareOfVoice value
    });

    it('should extract aggregated value from breakdown mode', () => {
      const value = extractCurrentValue(mockChartData, 'shareOfVoice', ['gpt-4', 'claude'], true);
      expect(value).toBe(32.0); // Aggregated from model breakdown
    });

    it('should handle empty chart data', () => {
      const value = extractCurrentValue([], 'shareOfVoice', [], false);
      expect(value).toBeNull();
    });

    it('should filter out zero points', () => {
      const dataWithZeroPoint = [
        ...mockChartData,
        {
          date: 'Jan 16',
          fullDate: '2025-01-16',
          shareOfVoice: 0,
          inclusionRate: 0,
          isZeroPoint: true
        }
      ];

      const value = extractCurrentValue(dataWithZeroPoint, 'shareOfVoice', [], false);
      expect(value).toBe(32.0); // Should skip zero point
    });
  });

  describe('processTimeSeriesData', () => {
    const dataTransformer = (item: ShareOfVoiceHistoryItem) => {
      const parsedDate = parseApiDate(item.date);
      if (!parsedDate) return null;

      return {
        date: formatChartDate(parsedDate),
        fullDate: item.date,
        shareOfVoice: item.shareOfVoice,
        inclusionRate: item.inclusionRate || 0
      } as MetricsChartDataPoint;
    };

    const valueExtractor = (chartData: MetricsChartDataPoint[]) => {
      return chartData.map(d => d.shareOfVoice).filter(v => typeof v === 'number');
    };

    it('should process data in single line mode', () => {
      const result = processTimeSeriesData(
        mockShareOfVoiceData,
        { ...defaultOptions, showModelBreakdown: false },
        dataTransformer,
        valueExtractor
      );

      expect(result.chartData.length).toBeGreaterThan(0);
      expect(result.modelIds).toHaveLength(0);
      
      // Should have aggregated data by date
      const uniqueDates = new Set(result.chartData.map(d => d.date));
      expect(uniqueDates.size).toBe(3); // 3 unique dates
    });

    it('should process data in breakdown mode', () => {
      const result = processTimeSeriesData(
        mockShareOfVoiceData,
        { ...defaultOptions, showModelBreakdown: true },
        dataTransformer,
        valueExtractor
      );

      expect(result.chartData.length).toBeGreaterThan(0);
      expect(result.modelIds).toContain('gpt-4');
      expect(result.modelIds).toContain('claude');

      // Chart data should have model-specific fields
      const firstDataPoint = result.chartData[0];
      expect(firstDataPoint).toHaveProperty('gpt-4');
      expect(firstDataPoint).toHaveProperty('claude');
    });

    it('should filter by selected model', () => {
      const result = processTimeSeriesData(
        mockShareOfVoiceData,
        { ...defaultOptions, selectedModel: 'gpt-4' },
        dataTransformer,
        valueExtractor
      );

      // Should only include gpt-4 data
      expect(result.modelIds).toHaveLength(0); // Single model mode
      
      // All chart data should be from gpt-4 only
      expect(result.chartData.every(d => d.shareOfVoice === 35.2 || d.shareOfVoice === 33.7 || d.shareOfVoice === 31.5)).toBe(true);
    });

    it('should include zero point when requested', () => {
      const result = processTimeSeriesData(
        mockShareOfVoiceData,
        { ...defaultOptions, includeZeroPoint: true },
        dataTransformer,
        valueExtractor
      );

      // Should have one zero point at the beginning
      const zeroPoints = result.chartData.filter(d => d.isZeroPoint);
      expect(zeroPoints).toHaveLength(1);
      expect(zeroPoints[0].shareOfVoice).toBe(0);
    });

    it('should handle empty input data', () => {
      const result = processTimeSeriesData(
        [],
        defaultOptions,
        dataTransformer,
        valueExtractor
      );

      expect(result.chartData).toHaveLength(0);
      expect(result.modelIds).toHaveLength(0);
    });

    it('should handle malformed data gracefully', () => {
      const malformedData = [
        { date: 'invalid-date', aiModel: 'gpt-4', shareOfVoice: 35.2 },
        { date: '2025-01-15', aiModel: null, shareOfVoice: 28.8 },
        { date: '2025-01-15', aiModel: 'claude', shareOfVoice: null }
      ] as Array<Record<string, unknown>>;

      const result = processTimeSeriesData(
        malformedData,
        defaultOptions,
        dataTransformer,
        valueExtractor
      );

      // Should handle gracefully, possibly with reduced data
      expect(result.chartData).toBeDefined();
      expect(result.modelIds).toBeDefined();
    });
  });

  describe('integration tests', () => {
    it('should process sentiment data end-to-end', () => {
      const sentimentTransformer = (item: SentimentHistoryItem) => {
        const parsedDate = parseApiDate(item.date);
        if (!parsedDate) return null;

        return {
          date: formatChartDate(parsedDate),
          fullDate: item.date,
          score: item.sentimentScore
        } as SentimentChartDataPoint;
      };

      const sentimentExtractor = (chartData: SentimentChartDataPoint[]) => {
        return chartData.map(d => d.score).filter(v => typeof v === 'number');
      };

      const result = processTimeSeriesData(
        mockSentimentData,
        defaultOptions,
        sentimentTransformer,
        sentimentExtractor
      );

      expect(result.chartData.length).toBeGreaterThan(0);
      expect(result.chartData.every(d => typeof d.score === 'number')).toBe(true);
    });

    it('should maintain data consistency across processing', () => {
      const transformer = (item: ShareOfVoiceHistoryItem) => {
        const parsedDate = parseApiDate(item.date);
        if (!parsedDate) return null;

        return {
          date: formatChartDate(parsedDate),
          fullDate: item.date,
          shareOfVoice: item.shareOfVoice,
          inclusionRate: item.inclusionRate || 0
        } as MetricsChartDataPoint;
      };

      const extractor = (chartData: MetricsChartDataPoint[]) => {
        return chartData.map(d => d.shareOfVoice).filter(v => typeof v === 'number');
      };

      // Process same data with different options
      const singleLineResult = processTimeSeriesData(
        mockShareOfVoiceData,
        { ...defaultOptions, showModelBreakdown: false },
        transformer,
        extractor
      );

      const breakdownResult = processTimeSeriesData(
        mockShareOfVoiceData,
        { ...defaultOptions, showModelBreakdown: true },
        transformer,
        extractor
      );

      // Both should have same number of date points (excluding zero points)
      const singleLineDates = singleLineResult.chartData.filter(d => !d.isZeroPoint);
      const breakdownDates = breakdownResult.chartData.filter(d => !d.isZeroPoint);
      
      expect(singleLineDates.length).toBe(breakdownDates.length);
    });
  });
});