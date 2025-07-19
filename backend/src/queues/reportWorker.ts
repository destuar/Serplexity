/**
 * @file reportWorker.ts
 * @description Clean, streamlined report generation worker
 *
 * Flow:
 * 1. Research website & generate target market questions
 * 2. Answer questions with enabled models
 * 3. Sentiment analysis with enabled models
 * 4. Enrich competitor websites (parallel processing)
 */

import { Worker, Job } from "bullmq";
import pLimit from "p-limit";
import env from "../config/env";
import { getBullMQConnection } from "../config/bullmq";
import { getDbClient } from "../config/database";
import { Prisma } from ".prisma/client";
import {
  generateSentimentScores,
  generateOverallSentimentSummary,
  generateWebsiteForCompetitors,
  getModelsByTaskWithUserPreferences,
  SentimentScores,
  CompetitorInfo,
} from "../services/llmService";
import { ModelTask, LLM_CONFIG } from "../config/models";
import { CostCalculator } from "../config/llmPricing";
import { computeAndPersistMetrics } from "../services/metricsService";
import { initializeLogfire } from "../config/logfire";

// Initialize Logfire
(async () => {
  try {
    await initializeLogfire({
      serviceName: "report-worker",
      enableAutoInstrumentation: false,
    });
    console.log("Logfire initialized for report worker");
  } catch (error) {
    console.error("Failed to initialize Logfire for report worker", error);
  }
})();

/**
 * Calculate USD cost from token usage and web searches
 */
function calculateCost(
  modelId: string | undefined,
  inputTokens: number,
  outputTokens: number = 0,
  searchCount: number = 0,
): number {
  if (!modelId) return 0;

  try {
    const { totalCost } = CostCalculator.calculateTotalCost(
      modelId,
      inputTokens,
      outputTokens,
      searchCount,
    );
    return totalCost;
  } catch (error) {
    console.warn(`Failed to calculate cost for model ${modelId}:`, error);
    return 0;
  }
}

/**
 * Competitor brand extraction and enrichment pipeline
 */
class CompetitorPipeline {
  private brandQueue: string[] = [];
  private processedBrands = new Set<string>();
  private enrichedCompetitors: CompetitorInfo[] = [];
  private batchSize = 5;
  private processingBatches = new Set<Promise<void>>();
  private runId: string;
  private totalTokens = 0;
  private totalCost = 0;

  constructor(runId: string) {
    this.runId = runId;
  }

  async addBrand(brandName: string): Promise<void> {
    if (this.processedBrands.has(brandName)) return;

    this.brandQueue.push(brandName);
    this.processedBrands.add(brandName);

    if (this.brandQueue.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    if (this.brandQueue.length === 0) return;

    const batch = this.brandQueue.splice(0, this.batchSize);
    const batchPromise = this.enrichBatch(batch);

    this.processingBatches.add(batchPromise);
    batchPromise.finally(() => {
      this.processingBatches.delete(batchPromise);
    });
  }

  private async enrichBatch(brands: string[]): Promise<void> {
    try {
      console.log(`🔍 Enriching batch of ${brands.length} competitors`);

      const {
        data: enriched,
        usage,
        modelUsed,
      } = await generateWebsiteForCompetitors(brands);

      this.enrichedCompetitors.push(...enriched);
      const currentTokens = usage.promptTokens + usage.completionTokens;
      this.totalTokens += currentTokens;
      this.totalCost += calculateCost(
        modelUsed,
        usage.promptTokens,
        usage.completionTokens,
      );

      console.log(
        `✅ Enriched ${enriched.length}/${brands.length} competitors`,
      );
    } catch (error) {
      console.error(`❌ Failed to enrich competitor batch:`, error);
    }
  }

  async finalize(): Promise<{
    competitors: CompetitorInfo[];
    tokens: number;
    cost: number;
  }> {
    // Process remaining brands
    if (this.brandQueue.length > 0) {
      await this.processBatch();
    }

    // Wait for all batches to complete
    await Promise.all(Array.from(this.processingBatches));

    console.log(
      `🎯 Competitor pipeline complete: ${this.enrichedCompetitors.length} competitors enriched`,
    );

    return {
      competitors: this.enrichedCompetitors,
      tokens: this.totalTokens,
      cost: this.totalCost,
    };
  }
}

/**
 * Main report processing function
 */
async function processReport(runId: string, company: any): Promise<void> {
  console.log(
    `🚀 Starting report generation for ${company?.name || "Unknown"}`,
  );
  console.log(`📊 Stage 0: Getting database client...`);

  const prisma = await getDbClient();
  console.log(`✅ Database client obtained successfully`);

  const startTime = Date.now();

  let totalTokens = 0;
  let totalCost = 0;

  try {
    console.log(`🚀 Starting report generation for ${company.name}`);

    // Update report status
    await prisma.reportRun.update({
      where: { id: runId },
      data: { status: "RUNNING", stepStatus: "Starting report generation" },
    });

    // Get full company data
    const fullCompany = await prisma.company.findUnique({
      where: { id: company.id },
      include: { user: true },
    });

    if (!fullCompany) {
      throw new Error(`Company ${company.id} not found`);
    }

    // === STAGE 1: Company Research & Question Generation ===
    console.log(
      `📊 Stage 1: Researching website & generating target market questions`,
    );

    await prisma.reportRun.update({
      where: { id: runId },
      data: { stepStatus: "Researching company and generating questions" },
    });

    const { pydanticLlmService } = await import(
      "../services/pydanticLlmService"
    );

    const researchInput = {
      company_name: fullCompany.name,
      website_url: fullCompany.website,
      industry: fullCompany.industry || "Technology",
    };

    const researchResult = await pydanticLlmService.executeAgent(
      "company_research_agent",
      researchInput,
      null, // No output schema validation needed - agent handles structured output
      { modelId: "sonar" }, // Use Perplexity Sonar model
    );

    if (!researchResult.metadata?.success || !researchResult.data) {
      throw new Error(
        `Company research failed: ${JSON.stringify(researchResult)}`,
      );
    }

    const research = researchResult.data as any;
    totalTokens += researchResult.metadata?.tokensUsed || 0;
    // Company research with Sonar typically uses web search
    const researchSearchCount = 1; // Assume 1 search for company research
    totalCost += calculateCost(
      "sonar",
      researchResult.metadata?.tokensUsed || 0,
      0,
      researchSearchCount,
    );

    // Store research data
    await prisma.reportRun.update({
      where: { id: runId },
      data: {
        stepStatus: `Generated ${research.target_questions?.length || 0} target market questions`,
      },
    });

    console.log(
      `✅ Generated ${research.target_questions?.length || 0} target market questions`,
    );

    // === STAGE 2: Answer Questions with Enabled Models ===
    console.log(`🤖 Stage 2: Answering questions with enabled models`);

    await prisma.reportRun.update({
      where: { id: runId },
      data: { stepStatus: "Generating answers to target market questions" },
    });

    // Get enabled models for question answering
    const questionModels = await getModelsByTaskWithUserPreferences(
      ModelTask.QUESTION_ANSWERING,
      fullCompany.userId,
    );

    // Initialize competitor pipeline for parallel processing
    const competitorPipeline = new CompetitorPipeline(runId);

    // Create question-model combinations and process them
    const questionLimit = pLimit(LLM_CONFIG.QUESTION_ANSWERING_CONCURRENCY);
    const questionPromises = [];

    for (const [index, questionText] of (
      research.target_questions || []
    ).entries()) {
      for (const model of questionModels) {
        const promise = questionLimit(async () => {
          try {
            const questionInput = {
              question: questionText,
              company_name: fullCompany.name,
              context: `Target market research for ${fullCompany.name}`,
              enable_web_search: true,
            };

            const result = await pydanticLlmService.executeAgent(
              "question_agent",
              questionInput,
              null,
              { modelId: model.id },
            );

            if (!result.metadata?.success || !result.data) {
              throw new Error(
                `Question agent failed: ${JSON.stringify(result)}`,
              );
            }

            const response = result.data as any;
            totalTokens += result.metadata?.tokensUsed || 0;

            // Count web searches - assume 1 search if web search was used
            const searchCount = response.has_web_search ? 1 : 0;
            totalCost += calculateCost(
              model.id,
              result.metadata?.tokensUsed || 0,
              0,
              searchCount,
            );

            // Extract competitor brands and add to pipeline
            const brandRegex = /<brand>(.*?)<\/brand>/gi;
            let match;
            while ((match = brandRegex.exec(response.answer)) !== null) {
              const brandName = match[1].trim();
              if (brandName && brandName !== fullCompany.name) {
                await competitorPipeline.addBrand(brandName);
              }
            }

            // Create or find the question
            const question = await prisma.question.upsert({
              where: {
                text_companyId_runId: {
                  text: questionText,
                  companyId: fullCompany.id,
                  runId,
                },
              },
              update: {},
              create: {
                text: questionText,
                type: "research",
                companyId: fullCompany.id,
                runId,
              },
            });

            // Save the response
            const responseRecord = await prisma.response.create({
              data: {
                questionId: question.id,
                content: response.answer,
                model: model.id,
                engine: model.id,
                runId,
                metadata: {
                  confidence: response.confidence,
                  has_web_search: response.has_web_search,
                  brand_mentions_count: response.brand_mentions_count,
                  question_type: "research",
                } as any,
              },
            });

            // Extract and save citations
            const citationRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            let citationMatch;
            let citationPosition = 1;

            while (
              (citationMatch = citationRegex.exec(response.answer)) !== null
            ) {
              const title = citationMatch[1];
              const url = citationMatch[2];

              try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname;

                await prisma.citation.create({
                  data: {
                    responseId: responseRecord.id,
                    url,
                    title,
                    domain,
                    position: citationPosition,
                    accessedAt: new Date(),
                  },
                });

                citationPosition++;
              } catch (error) {
                console.warn(`Invalid URL in citation: ${url}`);
              }
            }

            // Extract and save brand mentions with positions
            const brandMentionRegex =
              /<brand(?:\s+position="(\d+)")?>([^<]+)<\/brand>/gi;
            let mentionMatch;
            let fallbackPosition = 1;

            while (
              (mentionMatch = brandMentionRegex.exec(response.answer)) !== null
            ) {
              const position = mentionMatch[1]
                ? parseInt(mentionMatch[1])
                : fallbackPosition++;
              const brandName = mentionMatch[2].trim();

              if (brandName === fullCompany.name) {
                // Company mention
                await prisma.mention.create({
                  data: {
                    responseId: responseRecord.id,
                    position,
                    companyId: fullCompany.id,
                  },
                });
              } else {
                // Check if it's a known competitor
                const competitor = await prisma.competitor.findFirst({
                  where: {
                    companyId: fullCompany.id,
                    name: { contains: brandName, mode: "insensitive" },
                  },
                });

                if (competitor) {
                  await prisma.mention.create({
                    data: {
                      responseId: responseRecord.id,
                      position,
                      competitorId: competitor.id,
                    },
                  });
                }
              }
            }

            console.log(
              `✅ Generated response for "${questionText}" with ${model.id}`,
            );
            return { success: true };
          } catch (error) {
            console.error(
              `❌ Failed to process question "${questionText}" with ${model.id}:`,
              error,
            );
            return { success: false, error };
          }
        });

        questionPromises.push(promise);
      }
    }

    const questionResults = await Promise.allSettled(questionPromises);
    const successfulQuestions = questionResults.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;

    console.log(
      `📊 Question answering complete: ${successfulQuestions}/${questionPromises.length} successful`,
    );

    // === STAGE 3: Sentiment Analysis with Enabled Models ===
    console.log(`😊 Stage 3: Sentiment analysis with enabled models`);

    await prisma.reportRun.update({
      where: { id: runId },
      data: { stepStatus: "Analyzing sentiment" },
    });

    const sentimentModels = await getModelsByTaskWithUserPreferences(
      ModelTask.SENTIMENT,
      fullCompany.userId,
    );
    const sentimentLimit = pLimit(3);

    const sentimentPromises = sentimentModels.map((model) =>
      sentimentLimit(async () => {
        try {
          const result = await generateSentimentScores(
            fullCompany.name,
            fullCompany.industry || "Technology",
            model,
          );

          const currentTokens =
            result.usage.promptTokens + result.usage.completionTokens;
          totalTokens += currentTokens;
          // Sentiment analysis typically doesn't use web search, but check if available
          const sentimentSearchCount = 0; // Sentiment analysis usually doesn't search
          totalCost += calculateCost(
            result.modelUsed,
            result.usage.promptTokens,
            result.usage.completionTokens,
            sentimentSearchCount,
          );

          // Save sentiment to database
          await prisma.sentimentScore.create({
            data: {
              runId,
              name: "Detailed Sentiment Scores",
              value: result.data as unknown as Prisma.InputJsonValue,
              engine: model.id,
            },
          });

          return { success: true, data: result.data };
        } catch (error) {
          console.error(`❌ Sentiment analysis failed for ${model.id}:`, error);
          return { success: false, error };
        }
      }),
    );

    const sentimentResults = await Promise.allSettled(sentimentPromises);
    const successfulSentiments = sentimentResults
      .filter((r) => r.status === "fulfilled" && r.value.success)
      .map((r) => (r as PromiseFulfilledResult<any>).value.data);

    // Generate overall sentiment summary
    if (successfulSentiments.length > 0) {
      try {
        const summaryResult = await generateOverallSentimentSummary(
          fullCompany.name,
          successfulSentiments,
        );

        const summaryTokens =
          summaryResult.usage.promptTokens +
          summaryResult.usage.completionTokens;
        totalTokens += summaryTokens;
        // Summary generation doesn't use web search
        const summarySearchCount = 0;
        totalCost += calculateCost(
          summaryResult.modelUsed,
          summaryResult.usage.promptTokens,
          summaryResult.usage.completionTokens,
          summarySearchCount,
        );

        await prisma.sentimentScore.create({
          data: {
            runId,
            name: "Overall Sentiment Summary",
            value: summaryResult.data as unknown as Prisma.InputJsonValue,
            engine: "serplexity-summary",
          },
        });

        console.log(`✅ Generated sentiment summary`);
      } catch (error) {
        console.error(`❌ Failed to generate sentiment summary:`, error);
      }
    }

    console.log(
      `😊 Sentiment analysis complete: ${successfulSentiments.length} successful analyses`,
    );

    // === STAGE 4: Finalize Competitor Enrichment (Parallel) ===
    console.log(`🌐 Stage 4: Finalizing competitor website enrichment`);

    await prisma.reportRun.update({
      where: { id: runId },
      data: { stepStatus: "Finalizing competitor data" },
    });

    const {
      competitors,
      tokens: competitorTokens,
      cost: competitorCost,
    } = await competitorPipeline.finalize();
    totalTokens += competitorTokens;
    totalCost += competitorCost;

    // Save enriched competitors
    for (const competitor of competitors) {
      await prisma.competitor.upsert({
        where: {
          companyId_website: {
            companyId: fullCompany.id,
            website: competitor.website,
          },
        },
        update: {
          name: competitor.name,
          isGenerated: true,
        },
        create: {
          companyId: fullCompany.id,
          name: competitor.name,
          website: competitor.website,
          isGenerated: true,
        },
      });
    }

    console.log(`✅ Enriched ${competitors.length} competitors`);

    // === FINALIZATION ===
    const duration = Date.now() - startTime;

    await prisma.reportRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        stepStatus: "Report completed successfully",
        tokensUsed: totalTokens,
        usdCost: totalCost,
      },
    });

    // Compute and persist metrics
    try {
      await computeAndPersistMetrics(runId, fullCompany.id);
    } catch (error) {
      console.error(`❌ Failed to compute metrics:`, error);
    }

    // Generate and persist optimization tasks
    try {
      const { persistOptimizationTasks, PRESET_TASKS } = await import('../services/optimizationTaskService');
      console.log(`📋 Generating optimization tasks...`);
      await persistOptimizationTasks(PRESET_TASKS, runId, fullCompany.id, prisma);
      console.log(`✅ Optimization tasks generated successfully`);
    } catch (error) {
      console.error(`❌ Failed to generate optimization tasks:`, error);
    }

    console.log(`🎉 Report generation completed successfully!`);
    console.log(
      `📊 Total: ${research.target_questions?.length || 0} questions, ${successfulQuestions} responses, ${competitors.length} competitors, ${successfulSentiments.length} sentiment analyses`,
    );
    console.log(`💰 Cost: ${totalTokens} tokens, $${totalCost.toFixed(4)} USD`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error(`💥 Report generation failed:`, error);

    await prisma.reportRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        stepStatus: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        tokensUsed: totalTokens,
        usdCost: totalCost,
      },
    });

    throw error;
  }
}

/**
 * Main job processor
 */
const processJob = async (job: Job) => {
  const { runId, company, force } = job.data;

  console.log(
    `🎯 Processing job ${job.id} - Report generation for company '${company.name}'`,
  );

  try {
    await processReport(runId, company);
    console.log(`✅ Job ${job.id} completed successfully`);
  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error);
    throw error;
  }
};

/**
 * Create and export the worker
 */
const worker = new Worker("report-generation", processJob, {
  connection: getBullMQConnection(),
  prefix: env.BULLMQ_QUEUE_PREFIX,
  concurrency: LLM_CONFIG.WORKER_CONCURRENCY,
  lockDuration: 1000 * 60 * 15, // 15 minutes
  limiter: {
    max: LLM_CONFIG.WORKER_RATE_LIMIT.max,
    duration: LLM_CONFIG.WORKER_RATE_LIMIT.duration,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});

worker.on("completed", (job: Job) => {
  const { runId, company } = job.data;
  console.log(`✅ Worker event: Job ${job.id} completed for ${company?.name}`);
});

worker.on("failed", async (job, err) => {
  const { runId, company } = job?.data || {};
  console.error(
    `❌ Worker event: Job ${job?.id} failed for ${company?.name}:`,
    err,
  );
});

worker.on("error", (err) => {
  console.error("❌ Worker error:", err);
});

console.log("📋 Report worker process started...");
console.log("🔗 Initializing database connection...");

export default worker;
