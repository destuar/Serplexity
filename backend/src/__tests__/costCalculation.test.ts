/**
 * @file costCalculation.test.ts
 * @description CRITICAL cost calculation tests - validates pricing accuracy to the cent
 * 
 * These tests ensure our cost calculations are accurate as per PhD-level research
 * requirements. Every penny must be accounted for correctly.
 */

import { CostCalculator, LLM_PRICING } from '../config/llmPricing';

describe('🚨 CRITICAL Cost Calculation Accuracy Tests', () => {
  
  describe('Pricing Data Validation', () => {
    test('GPT-4o mini pricing matches 2025 official rates', () => {
      const pricing = LLM_PRICING['gpt-4.1-mini'];
      expect(pricing.tokens.inputTokensPerMillion).toBe(0.15);
      expect(pricing.tokens.outputTokensPerMillion).toBe(0.6);
    });

    test('Claude 3.5 Haiku pricing matches 2025 official rates', () => {
      const pricing = LLM_PRICING['claude-3-5-haiku-20241022'];
      expect(pricing.tokens.inputTokensPerMillion).toBe(0.8);
      expect(pricing.tokens.outputTokensPerMillion).toBe(4.0);
    });

    test('Gemini 2.5 Flash pricing matches CORRECTED 2025 rates', () => {
      const pricing = LLM_PRICING['gemini-2.5-flash'];
      // CRITICAL: These were corrected from massive overcharges
      expect(pricing.tokens.inputTokensPerMillion).toBe(0.1); // Was 0.3 (300% overcharge)
      expect(pricing.tokens.outputTokensPerMillion).toBe(0.6); // Was 2.5 (417% overcharge)
      expect(pricing.tokens.outputThinkingTokensPerMillion).toBe(3.5);
    });

    test('Perplexity Sonar pricing matches 2025 official rates', () => {
      const pricing = LLM_PRICING['sonar'];
      expect(pricing.tokens.inputTokensPerMillion).toBe(1.0);
      expect(pricing.tokens.outputTokensPerMillion).toBe(1.0);
    });
  });

  describe('Token Cost Calculations - Precision to the Cent', () => {
    test('GPT-4o mini: 100K input + 50K output tokens', () => {
      const cost = CostCalculator.calculateTokenCost(
        'gpt-4.1-mini',
        100000, // 100K input tokens
        50000   // 50K output tokens
      );
      
      // Expected: (100K/1M) * $0.15 + (50K/1M) * $0.60 = $0.015 + $0.030 = $0.045
      expect(cost).toBeCloseTo(0.045, 6);
    });

    test('Gemini 2.5 Flash: Standard vs Thinking tokens', () => {
      // Standard output tokens
      const standardCost = CostCalculator.calculateTokenCost(
        'gemini-2.5-flash',
        100000, // 100K input
        50000   // 50K standard output
      );
      
      // Expected: (100K/1M) * $0.10 + (50K/1M) * $0.60 = $0.010 + $0.030 = $0.040
      expect(standardCost).toBeCloseTo(0.040, 6);

      // With thinking tokens
      const thinkingCost = CostCalculator.calculateTokenCost(
        'gemini-2.5-flash',
        100000, // 100K input
        30000,  // 30K standard output
        20000   // 20K thinking tokens
      );
      
      // Expected: (100K/1M) * $0.10 + (30K/1M) * $0.60 + (20K/1M) * $3.50
      // = $0.010 + $0.018 + $0.070 = $0.098
      expect(thinkingCost).toBeCloseTo(0.098, 6);
    });

    test('Claude 3.5 Haiku: High-precision calculation', () => {
      const cost = CostCalculator.calculateTokenCost(
        'claude-3-5-haiku-20241022',
        75000,  // 75K input tokens
        25000   // 25K output tokens
      );
      
      // Expected: (75K/1M) * $0.80 + (25K/1M) * $4.00 = $0.060 + $0.100 = $0.160
      expect(cost).toBeCloseTo(0.160, 6);
    });
  });

  describe('Web Search Cost Calculations', () => {
    test('Perplexity Sonar: Search cost included in model pricing', () => {
      const searchCost = CostCalculator.calculateWebSearchCost('sonar', 10);
      expect(searchCost).toBe(0); // Search cost included in token pricing
    });

    test('Gemini 2.5 Flash: $35 per 1K searches', () => {
      const searchCost = CostCalculator.calculateWebSearchCost('gemini-2.5-flash', 100);
      // Expected: (100/1000) * $35 = $3.50
      expect(searchCost).toBeCloseTo(3.5, 6);
    });

    test('OpenAI GPT-4o mini: $25 per 1K searches', () => {
      const searchCost = CostCalculator.calculateWebSearchCost('gpt-4.1-mini', 50);
      // Expected: (50/1000) * $25 = $1.25
      expect(searchCost).toBeCloseTo(1.25, 6);
    });
  });

  describe('Total Cost Calculations with Breakdown', () => {
    test('Complete cost calculation with all components', () => {
      const result = CostCalculator.calculateTotalCost(
        'gemini-2.5-flash',
        100000, // 100K input
        30000,  // 30K output
        5,      // 5 searches
        10000,  // 10K cached
        20000   // 20K thinking
      );

      // Token costs:
      // Input: (100K/1M) * $0.10 = $0.010
      // Output: (30K/1M) * $0.60 = $0.018
      // Thinking: (20K/1M) * $3.50 = $0.070
      // Caching: (10K/1M) * $0.075 = $0.00075
      // Search: (5/1000) * $35 = $0.175
      // Total: $0.27375

      expect(result.breakdown.inputCost).toBeCloseTo(0.010, 6);
      expect(result.breakdown.outputCost).toBeCloseTo(0.018, 6);
      expect(result.breakdown.thinkingCost).toBeCloseTo(0.070, 6);
      expect(result.breakdown.cachingCost).toBeCloseTo(0.00075, 6);
      expect(result.searchCost).toBeCloseTo(0.175, 6);
      expect(result.totalCost).toBeCloseTo(0.27375, 6);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('Unknown model throws descriptive error', () => {
      expect(() => {
        CostCalculator.calculateTokenCost('unknown-model', 1000, 1000);
      }).toThrow('Pricing not found for model: unknown-model');
    });

    test('Zero tokens results in zero cost', () => {
      const cost = CostCalculator.calculateTokenCost('gpt-4.1-mini', 0, 0);
      expect(cost).toBe(0);
    });

    test('Negative tokens handled gracefully', () => {
      // Should not throw, but may result in negative cost (which could be valid for credits)
      const cost = CostCalculator.calculateTokenCost('gpt-4.1-mini', -1000, 1000);
      expect(typeof cost).toBe('number');
    });
  });

  describe('Regression Tests for Previous Overcharging', () => {
    test('Gemini 2.5 Flash: Verify overcharging fix', () => {
      const inputTokens = 100000;
      const outputTokens = 50000;
      
      const correctedCost = CostCalculator.calculateTokenCost(
        'gemini-2.5-flash',
        inputTokens,
        outputTokens
      );
      
      // Old incorrect calculation would have been:
      // (100K/1M) * $0.30 + (50K/1M) * $2.50 = $0.155
      const oldIncorrectCost = 0.155;
      
      // New correct calculation:
      // (100K/1M) * $0.10 + (50K/1M) * $0.60 = $0.040
      const expectedCorrectCost = 0.040;
      
      expect(correctedCost).toBeCloseTo(expectedCorrectCost, 6);
      expect(correctedCost).not.toBeCloseTo(oldIncorrectCost, 2);
      
      // Verify we fixed the 288% overcharge
      const overchargeRatio = oldIncorrectCost / expectedCorrectCost;
      expect(overchargeRatio).toBeCloseTo(3.875, 1); // ~388% overcharge was fixed
    });
  });

  describe('Financial Impact Validation', () => {
    test('Large-scale operation cost accuracy', () => {
      // Simulate a large report generation
      const inputTokens = 500000;   // 500K input tokens
      const outputTokens = 200000;  // 200K output tokens
      const searches = 25;          // 25 web searches
      
      const geminiCost = CostCalculator.calculateTotalCost(
        'gemini-2.5-flash',
        inputTokens,
        outputTokens,
        searches
      );
      
      const claudeCost = CostCalculator.calculateTotalCost(
        'claude-3-5-haiku-20241022',
        inputTokens,
        outputTokens,
        searches
      );
      
      // Gemini should be significantly cheaper for this workload
      expect(geminiCost.totalCost).toBeLessThan(claudeCost.totalCost);
      
      // Log for manual verification
      console.log('Large-scale cost comparison:');
      console.log(`Gemini 2.5 Flash: $${geminiCost.totalCost.toFixed(4)}`);
      console.log(`Claude 3.5 Haiku: $${claudeCost.totalCost.toFixed(4)}`);
    });
  });
});

describe('🔧 Cost Calculation Integration Tests', () => {
  test('All configured models have valid pricing', () => {
    const configuredModels = ['gpt-4.1-mini', 'claude-3-5-haiku-20241022', 'gemini-2.5-flash', 'sonar'];
    
    configuredModels.forEach(modelId => {
      expect(LLM_PRICING[modelId]).toBeDefined();
      expect(LLM_PRICING[modelId].tokens.inputTokensPerMillion).toBeGreaterThan(0);
      expect(LLM_PRICING[modelId].tokens.outputTokensPerMillion).toBeGreaterThan(0);
    });
  });

  test('Web search pricing consistency', () => {
    Object.values(LLM_PRICING).forEach(pricing => {
      if (pricing.webSearch?.enabled) {
        expect(pricing.webSearch.costPer1000Searches).toBeGreaterThanOrEqual(0);
      }
    });
  });
});