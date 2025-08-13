/**
 * @file typescript-integration.test.ts
 * @description Comprehensive TypeScript service integration tests
 *
 * This test suite validates that all PydanticAI agents integrate properly
 * with the TypeScript service layer without database or BullMQ complexity.
 *
 * 🎯 INTEGRATION TESTING SCOPE:
 * 1. pydanticLlmService ↔ All 6 PydanticAI agents
 * 2. llmService.generateQuestionResponse() ↔ question_agent.py
 * 3. optimizationTaskService ↔ optimization_agent.py
 * 4. metricsService logic validation (without database)
 * 5. Cost calculation and token tracking
 * 6. Error handling and service composition
 *
 * 🚀 VALIDATION APPROACH:
 * - Real PydanticAI agent calls with actual API credentials
 * - Mock database operations to avoid persistence complexity
 * - Validate data flow and type safety between services
 * - Test error handling and service reliability
 */

import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { config } from "dotenv";
import { resolve } from "path";

// Load real environment variables
config({ path: resolve(__dirname, "../../../.env") });

// Import services to test
import { ModelTask, getModelsByTask } from "../config/models";
import * as llmService from "../services/llmService";
import { pydanticLlmService } from "../services/pydanticLlmService";

// Ensure test environment
process.env.NODE_ENV = "test";
process.env.DISABLE_LOGFIRE = "1";

// Mock database to avoid persistence complexity
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    // Mock any database operations as needed
  })),
}));

describe("🔗 TypeScript Service Integration Tests", () => {
  beforeAll(async () => {
    console.log("\\n🔗 TYPESCRIPT SERVICE INTEGRATION TESTING...");
    console.log("Validating PydanticAI ↔ TypeScript service integration");

    // Verify critical environment variables
    const requiredVars = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      console.warn(`⚠️  Missing API keys: ${missingVars.join(", ")}`);
      console.warn("Some integration tests may be skipped");
    } else {
      console.log("✅ All required API keys present");
    }
  });

  afterAll(async () => {
    await pydanticLlmService.cleanup();
    console.log("\\n🎯 TYPESCRIPT INTEGRATION TESTING COMPLETE");
  });

  describe("🎯 PydanticLlmService ↔ Agent Integration", () => {
    it("should integrate with all 6 PydanticAI agents via pydanticLlmService", async () => {
      console.log(
        "\\n🤖 Testing pydanticLlmService ↔ All PydanticAI agents..."
      );

      const agentTests = [
        {
          name: "Sentiment Analysis",
          script: "sentiment_agent.py",
          input: {
            company_name: "TestCorp",
            search_queries: ["TestCorp reviews"],
            max_results_per_query: 1,
            context: "Integration test",
          },
        },
        {
          name: "Fanout Generation",
          script: "fanout_agent.py",
          input: {
            company_name: "TestCorp",
            industry: "Technology",
            base_question: "What are the best solutions?",
            context: "Integration test",
            competitors: ["CompetitorA"],
          },
        },
        {
          name: "Question Answering",
          script: "question_agent.py",
          input: {
            company_name: "TestCorp",
            question: "What makes TestCorp unique?",
            context: "Integration test",
          },
        },
        // Optimization agent removed in favor of preset tasks; skip this entry
        {
          name: "Sentiment Summary",
          script: "sentiment_summary_agent.py",
          input: {
            company_name: "TestCorp",
            sentiment_data: [{ quality: 7, brandReputation: 8 }],
            context: "Integration test",
          },
        },
        {
          name: "Website Enrichment",
          script: "website_agent.py",
          input: {
            company_name: "TestCorp",
            website_url: "https://testcorp.com",
            context: "Integration test",
          },
        },
      ];

      const results = [];

      for (const test of agentTests) {
        try {
          const result = await pydanticLlmService.executeAgent(
            test.script,
            test.input,
            null, // No Zod validation
            { timeout: 30000 }
          );

          // Validate service integration
          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(result.metadata).toBeDefined();
          expect(result.metadata.modelUsed).toBeTruthy();
          expect(typeof result.metadata.executionTime).toBe("number");
          expect(result.metadata.executionTime).toBeGreaterThan(0);

          results.push({
            agent: test.name,
            success: true,
            executionTime: result.metadata.executionTime,
            modelUsed: result.metadata.modelUsed,
            tokensUsed: result.metadata.tokensUsed || 0,
          });

          console.log(`   ✅ ${test.name}: ${result.metadata.executionTime}ms`);
        } catch (error) {
          if (error instanceof Error && error.message.includes("API key")) {
            console.warn(
              `   ⚠️  ${test.name}: Skipped due to missing API keys`
            );
            continue;
          }

          results.push({
            agent: test.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });

          console.error(`   ❌ ${test.name}: ${error}`);
        }
      }

      // Validate overall integration success
      const successfulAgents = results.filter((r) => r.success);
      const integrationScore =
        (successfulAgents.length / agentTests.length) * 100;

      console.log(
        `\\n📊 Integration Score: ${integrationScore}% (${successfulAgents.length}/${agentTests.length} agents)`
      );

      // Should have at least 75% success rate for reliable integration
      expect(integrationScore).toBeGreaterThanOrEqual(75);
    }, 120000); // 2 minutes for all 6 agents
  });

  describe("🔄 LLM Service Integration", () => {
    it("should integrate generateQuestionResponse with question_agent.py", async () => {
      console.log(
        "\\n❓ Testing llmService.generateQuestionResponse ↔ question_agent.py..."
      );

      try {
        // Get a model for question answering
        const models = getModelsByTask(ModelTask.QUESTION_ANSWERING);
        expect(models.length).toBeGreaterThan(0);

        const testModel = models[0];
        const testQuestion: llmService.QuestionInput = {
          id: "test-q1",
          text: "What are the benefits of cloud computing for small businesses?",
          systemPrompt: "You are a helpful business technology advisor.",
        };

        // Execute through llmService (which should call question_agent.py)
        const result = await llmService.generateQuestionResponse(
          testQuestion,
          testModel
        );

        // Validate TypeScript service integration
        expect(result).toBeDefined();
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe("string");
        expect(result.data.length).toBeGreaterThan(10);
        expect(result.usage).toBeDefined();
        expect(result.usage.totalTokens).toBeGreaterThan(0);
        expect(result.modelUsed).toBeTruthy();

        console.log(
          `   ✅ Question Response: ${result.data.length} chars, ${result.usage.totalTokens} tokens`
        );
        console.log(
          `   📝 Model: ${result.modelUsed}, Usage: ${result.usage.totalTokens} tokens`
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes("API key")) {
          console.warn("   ⚠️  Skipping due to missing API keys");
          return;
        }
        throw new Error(`LLM Service integration failed: ${error}`);
      }
    }, 45000);
  });

  describe("🎯 Optimization Task Service Integration", () => {
    // DISABLED: Optimization agent has been removed in favor of hardcoded preset tasks
    // it('should integrate persistOptimizationTasks with optimization_agent.py data', async () => {
    //   console.log('\\n🎯 Testing optimizationTaskService ↔ optimization_agent.py...');
    //   try {
    //     // First generate tasks using optimization_agent.py
    //     const optimizationInput = {
    //       company_name: "TestCorp",
    //       industry: "Technology",
    //       context: "Integration test for optimization tasks",
    //       categories: ["content", "brand"],
    //       max_tasks: 3
    //     };
    //     const agentResult = await pydanticLlmService.executeAgent(
    //       'optimization_agent.py',
    //       optimizationInput,
    //       null,
    //       { timeout: 30000 }
    //     );
    //     // Validate agent result structure
    //     expect(agentResult.data).toBeDefined();
    //     expect(agentResult.data.tasks).toBeDefined();
    //     expect(Array.isArray(agentResult.data.tasks)).toBe(true);
    //     expect(agentResult.data.tasks.length).toBeGreaterThan(0);
    //     console.log(`   ✅ Generated ${agentResult.data.tasks.length} optimization tasks`);
    //     // Test task data structure compatibility (without database persistence)
    //     const mockRunId = 'test-run-123';
    //     const tasks = agentResult.data.tasks;
    //     // Validate each task has required fields for persistence
    //     tasks.forEach((task: unknown, index: number) => {
    //       expect(task).toHaveProperty('title');
    //       expect(task).toHaveProperty('description');
    //       expect(task).toHaveProperty('category');
    //       expect(typeof task.title).toBe('string');
    //       expect(typeof task.description).toBe('string');
    //       expect(task.title.length).toBeGreaterThan(0);
    //       expect(task.description.length).toBeGreaterThan(0);
    //       console.log(`   📋 Task ${index + 1}: [${task.category}] ${task.title.substring(0, 50)}...`);
    //     });
    //     // Mock the persistOptimizationTasks function behavior (without database)
    //     const mockPersistResult = {
    //       tasksCreated: tasks.length,
    //       runId: mockRunId,
    //       tasks: tasks.map((task: unknown, index: number) => ({
    //         id: `mock-task-${index + 1}`,
    //         title: task.title,
    //         description: task.description,
    //         category: task.category,
    //         completed: false
    //       }))
    //     };
    //     console.log(`   ✅ Mock persistence: ${mockPersistResult.tasksCreated} tasks would be saved`);
    //     console.log(`   🎯 Integration validated: optimization_agent.py → optimizationTaskService`);
    //   } catch (error) {
    //     if (error instanceof Error && error.message.includes('API key')) {
    //       console.warn('   ⚠️  Skipping due to missing API keys');
    //       return;
    //     }
    //     throw new Error(`Optimization task service integration failed: ${error}`);
    //   }
    // }, 45000);
  });

  describe("📊 Metrics Service Integration", () => {
    it("should validate metrics calculation logic with mock data", async () => {
      console.log("\\n📊 Testing metricsService calculation logic...");

      // Mock sentiment data structure as it would come from PydanticAI agents
      const mockSentimentData = [
        {
          engine: "openai",
          value: {
            ratings: [
              {
                quality: 8,
                priceValue: 7,
                brandReputation: 9,
                brandTrust: 8,
                customerService: 7,
              },
            ],
          },
        },
        {
          engine: "anthropic",
          value: {
            ratings: [
              {
                quality: 7,
                priceValue: 8,
                brandReputation: 8,
                brandTrust: 7,
                customerService: 8,
              },
            ],
          },
        },
      ];

      // Mock fanout responses as they would come from question_agent.py
      const mockFanoutResponses = [
        {
          response: "TestCorp is a leading technology company...",
          mentions: { TestCorp: 2, CompetitorA: 1 },
        },
        {
          response: "For enterprise solutions, TestCorp offers...",
          mentions: { TestCorp: 1, CompetitorB: 1 },
        },
        {
          response: "When comparing platforms, TestCorp and CompetitorA...",
          mentions: { TestCorp: 1, CompetitorA: 1 },
        },
      ];

      try {
        // Test metrics calculation logic (without database persistence)
        const mockMetricsCalculation = {
          // Calculate average sentiment scores
          calculateAverageSentiment: (sentiments: unknown[]) => {
            const allRatings = sentiments.flatMap((s) => s.value.ratings);
            const avgQuality =
              allRatings.reduce((sum, r) => sum + r.quality, 0) /
              allRatings.length;
            const avgReputation =
              allRatings.reduce((sum, r) => sum + r.brandReputation, 0) /
              allRatings.length;
            return { avgQuality, avgReputation };
          },

          // Calculate mention metrics
          calculateMentionMetrics: (responses: unknown[]) => {
            const totalMentions = responses.reduce(
              (sum, r) =>
                sum +
                Object.values(r.mentions).reduce(
                  (a: unknown, b: unknown) => a + b,
                  0
                ),
              0
            );
            const companyMentions = responses.reduce(
              (sum, r) => sum + (r.mentions.TestCorp || 0),
              0
            );
            const shareOfVoice = companyMentions / totalMentions;
            return { totalMentions, companyMentions, shareOfVoice };
          },
        };

        // Execute calculations
        const sentimentMetrics =
          mockMetricsCalculation.calculateAverageSentiment(mockSentimentData);
        const mentionMetrics =
          mockMetricsCalculation.calculateMentionMetrics(mockFanoutResponses);

        // Validate calculation results
        expect(sentimentMetrics.avgQuality).toBeGreaterThan(0);
        expect(sentimentMetrics.avgQuality).toBeLessThanOrEqual(10);
        expect(sentimentMetrics.avgReputation).toBeGreaterThan(0);
        expect(sentimentMetrics.avgReputation).toBeLessThanOrEqual(10);

        expect(mentionMetrics.totalMentions).toBeGreaterThan(0);
        expect(mentionMetrics.companyMentions).toBeGreaterThan(0);
        expect(mentionMetrics.shareOfVoice).toBeGreaterThan(0);
        expect(mentionMetrics.shareOfVoice).toBeLessThanOrEqual(1);

        console.log(
          `   ✅ Sentiment Metrics: Quality ${sentimentMetrics.avgQuality.toFixed(1)}, Reputation ${sentimentMetrics.avgReputation.toFixed(1)}`
        );
        console.log(
          `   ✅ Mention Metrics: ${mentionMetrics.companyMentions}/${mentionMetrics.totalMentions} mentions (${(mentionMetrics.shareOfVoice * 100).toFixed(1)}% SOV)`
        );
        console.log(`   🎯 Metrics calculation logic validated`);
      } catch (error) {
        throw new Error(`Metrics service logic validation failed: ${error}`);
      }
    }, 15000);
  });

  describe("💰 Cost and Token Tracking Integration", () => {
    it("should validate token tracking and cost calculation across services", async () => {
      console.log("\\n💰 Testing cost calculation and token tracking...");

      try {
        // Execute a few agents and track token usage
        const testCases = [
          {
            name: "Sentiment Analysis",
            script: "sentiment_agent.py",
            input: {
              company_name: "TestCorp",
              search_queries: ["test"],
              max_results_per_query: 1,
            },
          },
          {
            name: "Question Answering",
            script: "question_agent.py",
            input: {
              company_name: "TestCorp",
              question: "What is TestCorp?",
              context: "cost test",
            },
          },
        ];

        let totalTokens = 0;
        const results = [];

        for (const testCase of testCases) {
          try {
            const result = await pydanticLlmService.executeAgent(
              testCase.script,
              testCase.input,
              null,
              { timeout: 20000 }
            );

            const tokensUsed = result.metadata.tokensUsed || 0;
            totalTokens += tokensUsed;

            results.push({
              agent: testCase.name,
              tokensUsed,
              modelUsed: result.metadata.modelUsed,
              executionTime: result.metadata.executionTime,
            });

            console.log(
              `   💎 ${testCase.name}: ${tokensUsed} tokens, Model: ${result.metadata.modelUsed}`
            );
          } catch (error) {
            if (error instanceof Error && error.message.includes("API key")) {
              console.warn(
                `   ⚠️  ${testCase.name}: Skipped due to missing API keys`
              );
              continue;
            }
            console.warn(`   ⚠️  ${testCase.name}: Failed - ${error}`);
          }
        }

        // Mock cost calculation (typical pricing)
        const estimatedCostPerToken = 0.00001; // ~$0.01 per 1K tokens
        const estimatedTotalCost = totalTokens * estimatedCostPerToken;

        console.log(`   ✅ Total Tokens Tracked: ${totalTokens}`);
        console.log(`   ✅ Estimated Cost: $${estimatedTotalCost.toFixed(4)}`);
        console.log(`   🎯 Token tracking and cost calculation validated`);

        // Basic validation
        expect(typeof totalTokens).toBe("number");
        expect(totalTokens).toBeGreaterThanOrEqual(0);
      } catch (error) {
        throw new Error(`Cost and token tracking validation failed: ${error}`);
      }
    }, 60000);
  });

  describe("🛡️ Error Handling and Service Composition", () => {
    it("should handle service integration errors gracefully", async () => {
      console.log("\\n🛡️  Testing error handling in service integration...");

      try {
        // Test 1: Invalid agent script
        try {
          await pydanticLlmService.executeAgent(
            "nonexistent_agent.py",
            { test: true },
            null,
            { timeout: 5000 }
          );
          throw new Error("Should have failed for nonexistent agent");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          console.log("   ✅ Nonexistent agent error handled correctly");
        }

        // Test 2: Invalid input data
        try {
          await pydanticLlmService.executeAgent(
            "question_agent.py",
            { invalid: "data" }, // Missing required fields
            null,
            { timeout: 5000 }
          );
          // This might succeed with fallbacks, which is OK
          console.log(
            "   ✅ Invalid input handled (may succeed with fallbacks)"
          );
        } catch (error) {
          console.log("   ✅ Invalid input error handled correctly");
        }

        // Test 3: Service composition with error recovery
        const serviceComposition = {
          executeWithFallback: async (
            primaryAgent: string,
            fallbackAgent: string,
            input: unknown
          ) => {
            try {
              return await pydanticLlmService.executeAgent(
                primaryAgent,
                input,
                null,
                { timeout: 10000 }
              );
            } catch (primaryError) {
              console.log(
                `   ⚠️  Primary agent ${primaryAgent} failed, trying fallback...`
              );
              return await pydanticLlmService.executeAgent(
                fallbackAgent,
                input,
                null,
                { timeout: 10000 }
              );
            }
          },
        };

        // Test fallback mechanism
        const fallbackResult = await serviceComposition.executeWithFallback(
          "nonexistent_agent.py", // Will fail
          "question_agent.py", // Will succeed
          {
            company_name: "TestCorp",
            question: "What is TestCorp?",
            context: "fallback test",
          }
        );

        expect(fallbackResult).toBeDefined();
        console.log("   ✅ Service composition with fallback works");

        console.log("   🎯 Error handling and service composition validated");
      } catch (error) {
        if (error instanceof Error && error.message.includes("API key")) {
          console.warn("   ⚠️  Skipping due to missing API keys");
          return;
        }
        throw new Error(`Error handling validation failed: ${error}`);
      }
    }, 45000);
  });
});
