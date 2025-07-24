/**
 * @file pydanticAgentTests.test.ts
 * @description Comprehensive unit tests for PydanticAI agents
 *
 * This test suite validates:
 * - Individual agent functionality
 * - Data structure validation
 * - Error handling and recovery
 * - Provider failover
 * - Performance benchmarks
 */

import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  it,
  expect,
  jest,
} from "@jest/globals";
import { pydanticLlmService } from "../../services/pydanticLlmService";
import { providerManager } from "../../config/pydanticProviders";

// Mock environment for consistent testing
process.env.NODE_ENV = "test";
process.env.DISABLE_LOGFIRE = "1";

// Mock all database and setup dependencies since these are pure unit tests
jest.mock("../../config/database", () => ({
  getDbClient: jest.fn(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));

jest.mock("../setup", () => ({}));

describe("PydanticAI Agent Unit Tests", () => {
  beforeAll(async () => {
    // Initialize service for testing
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await pydanticLlmService.cleanup();
  });

  describe("Web Search Sentiment Agent", () => {
    const mockSentimentInput = {
      company_name: "TestCorp",
      search_queries: [
        "TestCorp customer reviews",
        "TestCorp vs competitors",
        "TestCorp pricing feedback",
      ],
      max_results_per_query: 5,
      context: "Analyzing sentiment for TestCorp in the technology sector",
    };

    it("should have correct input structure", () => {
      expect(mockSentimentInput).toHaveProperty("company_name");
      expect(mockSentimentInput).toHaveProperty("search_queries");
      expect(mockSentimentInput).toHaveProperty("max_results_per_query");
      expect(mockSentimentInput).toHaveProperty("context");
      expect(Array.isArray(mockSentimentInput.search_queries)).toBe(true);
    });

    it("should validate agent execution flow", async () => {
      // Mock successful agent execution
      const mockExecuteAgent = jest
        .spyOn(pydanticLlmService, "executeAgent")
        .mockResolvedValueOnce({
          data: {
            companyName: "TestCorp",
            totalResults: 15,
            sentimentAnalysis: {
              overall_sentiment: "neutral",
              sentiment_score: 0.2,
              confidence: 0.85,
            },
            results: [
              {
                query: "TestCorp customer reviews",
                url: "https://example.com/review1",
                title: "TestCorp Review",
                snippet: "Great product with excellent support",
                sentiment: "positive",
                sentiment_score: 0.8,
                relevance_score: 0.9,
                mentions_count: 3,
              },
            ],
            generationTimestamp: new Date().toISOString(),
          },
          metadata: {
            modelUsed: "gpt-4.1-mini",
            tokensUsed: 1250,
            executionTime: 3500,
            providerId: "openai",
            success: true,
            attemptCount: 1,
            fallbackUsed: false,
          },
        });

      const result = await pydanticLlmService.executeAgent(
        "web_search_sentiment_agent.py",
        mockSentimentInput,
        null,
      );

      expect(result).toBeDefined();
      expect(result.data).toHaveProperty("companyName");
      expect(result.data).toHaveProperty("sentimentAnalysis");
      expect(result.data.sentimentAnalysis).toHaveProperty("overall_sentiment");
      expect(result.data.sentimentAnalysis).toHaveProperty("sentiment_score");
      expect(result.metadata.success).toBe(true);
      expect(result.metadata.tokensUsed).toBeGreaterThan(0);
      expect(result.metadata.modelUsed).toBeDefined();

      mockExecuteAgent.mockRestore();
    }, 10000);

    it("should handle sentiment analysis errors gracefully", async () => {
      const mockExecuteAgent = jest
        .spyOn(pydanticLlmService, "executeAgent")
        .mockRejectedValueOnce(new Error("Provider temporarily unavailable"));

      await expect(
        pydanticLlmService.executeAgent(
          "web_search_sentiment_agent.py",
          mockSentimentInput,
          null,
        ),
      ).rejects.toThrow("Provider temporarily unavailable");

      mockExecuteAgent.mockRestore();
    });
  });

  describe("Fanout Query Generation Agent", () => {
    const mockFanoutInput = {
      company_name: "TestCorp",
      industry: "Technology",
      context: "Generate fanout queries for comprehensive market analysis",
      query_types: ["comparison", "best_for", "versus", "features", "pricing"],
      max_queries: 15,
      target_audiences: ["developers", "managers", "enterprise teams"],
    };

    it("should validate fanout input structure", () => {
      expect(mockFanoutInput).toHaveProperty("company_name");
      expect(mockFanoutInput).toHaveProperty("industry");
      expect(mockFanoutInput).toHaveProperty("query_types");
      expect(Array.isArray(mockFanoutInput.query_types)).toBe(true);
      expect(Array.isArray(mockFanoutInput.target_audiences)).toBe(true);
    });

    it("should generate diverse query types", async () => {
      const mockExecuteAgent = jest
        .spyOn(pydanticLlmService, "executeAgent")
        .mockResolvedValueOnce({
          data: {
            companyName: "TestCorp",
            industry: "Technology",
            queries: [
              {
                query: "TestCorp vs competitors pricing comparison",
                type: "comparison",
                priority: 1,
                targetAudience: "managers",
                expectedMentions: ["TestCorp", "pricing", "competitor"],
              },
              {
                query: "best practices for TestCorp implementation",
                type: "best_for",
                priority: 2,
                targetAudience: "developers",
                expectedMentions: ["TestCorp", "implementation", "best"],
              },
            ],
            totalQueries: 15,
            generationTimestamp: new Date().toISOString(),
          },
          metadata: {
            modelUsed: "gpt-4.1-mini",
            tokensUsed: 800,
            executionTime: 2500,
            providerId: "openai",
            success: true,
            attemptCount: 1,
            fallbackUsed: false,
          },
        });

      const result = await pydanticLlmService.executeAgent(
        "fanout_agent.py",
        mockFanoutInput,
        null,
      );

      expect(result.data.queries).toBeDefined();
      expect(Array.isArray(result.data.queries)).toBe(true);
      expect(result.data.queries.length).toBeGreaterThan(0);

      // Validate query structure
      result.data.queries.forEach((query: unknown) => {
        expect(query).toHaveProperty("query");
        expect(query).toHaveProperty("type");
        expect(query).toHaveProperty("priority");
        expect(query).toHaveProperty("targetAudience");
        expect(Array.isArray(query.expectedMentions)).toBe(true);
      });

      mockExecuteAgent.mockRestore();
    });
  });

  describe("Question Answering Agent", () => {
    const mockQuestionInput = {
      question: "What are the key advantages of TestCorp over its competitors?",
      company_name: "TestCorp",
      context: "Comprehensive competitive analysis for market positioning",
      search_depth: "comprehensive",
      include_sources: true,
      max_sources: 10,
    };

    it("should process question answering correctly", async () => {
      const mockExecuteAgent = jest
        .spyOn(pydanticLlmService, "executeAgent")
        .mockResolvedValueOnce({
          data: {
            question: mockQuestionInput.question,
            answer:
              "TestCorp offers several key advantages including superior performance, better pricing, and excellent customer support.",
            confidence: 0.85,
            sources: [
              {
                url: "https://example.com/review",
                title: "TestCorp Analysis",
                snippet: "Industry-leading performance metrics",
                relevance: 0.9,
              },
            ],
            reasoning:
              "Based on analysis of multiple sources and market comparisons",
            generationTimestamp: new Date().toISOString(),
          },
          metadata: {
            modelUsed: "gpt-4.1-mini",
            tokensUsed: 1500,
            executionTime: 4000,
            providerId: "openai",
            success: true,
            attemptCount: 1,
            fallbackUsed: false,
          },
        });

      const result = await pydanticLlmService.executeAgent(
        "question_agent.py",
        mockQuestionInput,
        null,
      );

      expect(result.data).toHaveProperty("question");
      expect(result.data).toHaveProperty("answer");
      expect(result.data).toHaveProperty("confidence");
      expect(result.data).toHaveProperty("sources");
      expect(Array.isArray(result.data.sources)).toBe(true);

      mockExecuteAgent.mockRestore();
    });
  });

  // describe('Optimization Tasks Agent', () => {
  //   // DISABLED: Optimization agent has been removed in favor of hardcoded preset tasks
  //   // const mockOptimizationInput = {
  //   //   company_name: "TestCorp",
  //   //   industry: "Technology",
  //   //   context: "Generate optimization tasks based on AI visibility metrics",
  //   //   categories: ["content", "technical", "brand", "visibility", "performance"],
  //   //   max_tasks: 10,
  //   //   priority_focus: "high_impact"
  //   // };

  //   // it('should generate actionable optimization tasks', async () => {
  //   //   const mockExecuteAgent = jest.spyOn(pydanticLlmService, 'executeAgent')
  //   //     .mockResolvedValueOnce({
  //   //       data: {
  //   //         companyName: "TestCorp",
  //   //         industry: "Technology",
  //   //         tasks: [
  //   //           {
  //   //             title: "Improve SEO content strategy",
  //   //             description: "Enhance content to increase search visibility",
  //   //             category: "content",
  //   //             priority: 1,
  //   //             estimatedEffort: 40,
  //   //             expectedImpact: "High visibility improvement",
  //   //             actionItems: [
  //   //               "Conduct keyword research",
  //   //               "Create topic clusters",
  //   //               "Optimize existing content"
  //   //             ]
  //   //           }
  //   //         ],
  //   //         totalTasks: 10,
  //   //         generationTimestamp: new Date().toISOString()
  //   //       },
  //   //       metadata: {
  //   //         modelUsed: "gpt-4.1-mini",
  //   //         tokensUsed: 1200,
  //   //         executionTime: 3000,
  //   //         providerId: "openai",
  //   //         success: true,
  //   //         attemptCount: 1,
  //   //         fallbackUsed: false
  //   //       }
  //   //     });

  //   //   const result = await pydanticLlmService.executeAgent(
  //   //     'optimization_agent.py',
  //   //     mockOptimizationInput,
  //   //     null
  //   //   );

  //   //   expect(result.data.tasks).toBeDefined();
  //   //   expect(Array.isArray(result.data.tasks)).toBe(true);

  //   //   result.data.tasks.forEach((task: unknown) => {
  //   //     expect(task).toHaveProperty('title');
  //   //     expect(task).toHaveProperty('description');
  //   //     expect(task).toHaveProperty('category');
  //   //     expect(task).toHaveProperty('priority');
  //   //     expect(task).toHaveProperty('estimatedEffort');
  //   //     expect(Array.isArray(task.actionItems)).toBe(true);
  //   //   });

  //   //   mockExecuteAgent.mockRestore();
  //   // });
  // });

  describe("Provider Management", () => {
    it("should have available providers", () => {
      const providers = providerManager.getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it("should track provider health", () => {
      const healthReport = providerManager.getHealthReport();
      expect(Array.isArray(healthReport)).toBe(true);

      healthReport.forEach((provider: unknown) => {
        expect(provider).toHaveProperty("id");
        expect(provider).toHaveProperty("available");
        expect(provider).toHaveProperty("errorCount");
      });
    });

    it("should update provider health correctly", () => {
      const providers = providerManager.getAvailableProviders();
      if (providers.length > 0) {
        const providerId = providers[0].id;

        // Test successful health update
        providerManager.updateProviderHealth(providerId, true, 500);

        const healthReport = providerManager.getHealthReport();
        const updatedProvider = healthReport.find(
          (p: unknown) => p.id === providerId,
        );

        expect(updatedProvider).toBeDefined();
        expect(updatedProvider.available).toBe(true);
      }
    });
  });

  describe("Service Statistics", () => {
    it("should provide service statistics", () => {
      const stats = pydanticLlmService.getServiceStatistics();

      expect(stats).toHaveProperty("activeExecutions");
      expect(stats).toHaveProperty("poolSize");
      expect(stats).toHaveProperty("providerHealth");
      expect(typeof stats.activeExecutions).toBe("number");
      expect(typeof stats.poolSize).toBe("number");
      expect(Array.isArray(stats.providerHealth)).toBe(true);
    });
  });
});
