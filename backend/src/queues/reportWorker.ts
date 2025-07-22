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
import { getBullMQConnection, getBullMQOptions, getWorkerOptions } from "../config/bullmq";
import { getDbClient } from "../config/database"; // Direct DB connection instead of cache
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
import { checkRedisHealth } from "../config/redis";
import { dbCache } from "../config/dbCache";

/**
 * Critical dependency health checks - MUST pass before worker starts
 * This prevents workers from starting when they can't actually process jobs
 */
async function validateWorkerDependencies(): Promise<void> {
  const checks = [];
  
  // 1. Redis connectivity (BullMQ requires this)
  checks.push(
    checkRedisHealth().then(health => {
      if (health.status !== "healthy") {
        throw new Error(`Redis unhealthy: ${health.error || "Unknown error"}`);
      }
      console.log("✅ Redis connection verified");
    })
  );
  
  // 2. Database connectivity (worker needs to update status)
  checks.push(
    dbCache.initialize().then(() => {
      console.log("✅ Database connection verified");
    })
  );
  
  // 3. PydanticAI service availability (for first-time reports)
  checks.push(
    (async () => {
      try {
        const { pydanticLlmService } = await import("../services/pydanticLlmService");
        // Simple health check - try to get available providers
        const healthResult = await pydanticLlmService.executeAgent(
          "health_check",
          { test: "connectivity" },
          null,
          { timeout: 5000 }
        );
        console.log("✅ PydanticAI service verified");
      } catch (error) {
        console.warn("⚠️  PydanticAI service unavailable - first-time reports will fail");
        console.warn("   Make sure the Python service is running: cd src/pydantic_agents && python -m uvicorn main:app");
        // Don't throw - allow worker to start for existing reports that don't need Python
      }
    })()
  );
  
  try {
    await Promise.all(checks);
    console.log("🎯 All worker dependencies verified - ready to process jobs");
  } catch (error) {
    console.error("💥 CRITICAL: Worker dependency check failed:", error);
    
    if (process.env.NODE_ENV === "production") {
      console.error("💥 Exiting in production mode - container will restart");
      process.exit(1);
    } else {
      console.error("💥 Development mode - worker will not start but server continues");
      throw error;
    }
  }
}

// Run health checks before any worker initialization
console.log("🔍 Validating worker dependencies...");
validateWorkerDependencies().then(() => {
  console.log("✅ Dependency validation complete - initializing worker");
  
  // NOW create the worker - only after dependencies are verified
  const worker = new Worker("report-generation", processJob, {
    ...getWorkerOptions(),
    // Override with worker-specific settings
    concurrency: LLM_CONFIG.WORKER_CONCURRENCY,
    lockDuration: 1000 * 60 * 15, // 15 minutes
    limiter: {
      max: LLM_CONFIG.WORKER_RATE_LIMIT.max,
      duration: LLM_CONFIG.WORKER_RATE_LIMIT.duration,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    
    // Enhanced worker configuration
    stalledInterval: 30000, // Check for stalled jobs every 30s
    maxStalledCount: 1, // Retry stalled jobs once
    drainDelay: 5, // Wait 5ms when queue is empty
    
    // CRITICAL: Prevent auto-start to ensure event handlers are attached first
    autorun: false,
  });

  // Enhanced event handlers with proper debugging
  worker.on("ready", () => {
    console.log("🎯 Worker is ready and waiting for jobs...");
  });

  worker.on("active", (job: Job) => {
    const { runId, company } = job.data;
    console.log(`🚀 Worker started processing job ${job.id} for ${company?.name} (runId: ${runId})`);
  });

  worker.on("progress", (job: Job, progress: any) => {
    console.log(`📈 Job ${job.id} progress:`, progress);
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

  worker.on("stalled", (jobId: string) => {
    console.warn(`⚠️ Job ${jobId} stalled and will be retried`);
  });

  // Log when worker closes
  worker.on("closed", () => {
    console.log("🔒 Worker closed");
  });

  // Test Redis connection and worker readiness (keeping your existing logic)
  (async () => {
    try {
      // Test Redis connection
      const connection = getBullMQConnection();
      await connection.ping();
      console.log("✅ Redis connection test successful");
      
      // Import Queue to check status
      const { Queue } = await import("bullmq");
      const testQueue = new Queue("report-generation", getBullMQOptions());
      
      // Check queue status
      const waiting = await testQueue.getWaiting();
      const active = await testQueue.getActive();
      const completed = await testQueue.getCompleted();
      const failed = await testQueue.getFailed();
      
      console.log("📋 Report worker initialized successfully");
      console.log(`🔗 Connected to queue: report-generation`);
      console.log(`🔗 Queue prefix: ${env.BULLMQ_QUEUE_PREFIX || 'none'}`);
      console.log(`📊 Queue status: ${waiting.length} waiting, ${active.length} active, ${completed.length} completed, ${failed.length} failed`);
      console.log("🎯 Worker is ready to process jobs!");
      
      // Set up periodic queue monitoring for debugging
      const monitorQueue = async () => {
        try {
          const currentWaiting = await testQueue.getWaiting();
          if (currentWaiting.length > 0) {
            console.log(`🔍 MONITORING: ${currentWaiting.length} jobs waiting in queue`);
            for (const job of currentWaiting.slice(0, 3)) { // Show first 3 jobs
              console.log(`   - Job ${job.id}: ${job.name} (runId: ${job.data?.runId})`);
            }
          }
        } catch (error) {
          console.error("❌ Queue monitoring failed:", error);
        }
      };
      
      // Monitor queue every 10 seconds continuously
      const monitorInterval = setInterval(monitorQueue, 10000);
      
      // Clean up on process exit
      process.on('SIGINT', () => {
        clearInterval(monitorInterval);
        console.log("🔍 Queue monitoring stopped due to process exit");
      });
      
      // Clean up the test queue
      await testQueue.close();
      
    } catch (error) {
      console.error("❌ Worker/Redis initialization failed:", error);
      // Don't exit in dev mode, just log the error
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  })();

  console.log("📋 Report worker process started...");
  console.log("🔗 Initializing database connection...");

  // CRITICAL: Start worker after all event handlers are attached
  setTimeout(() => {
    worker.run();
    console.log("🎯 Worker started after event handler setup");
  }, 100);

  // Export the worker instance
  module.exports = worker;
  
}).catch(() => {
  console.error("❌ Worker initialization blocked due to failed dependencies");
  // In development, don't crash the entire process
  if (process.env.NODE_ENV !== 'development') {
    process.exit(1);
  }
});

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
 * Advanced competitor deduplication using multiple strategies
 */
async function deduplicateCompetitors(
  competitors: CompetitorInfo[], 
  companyId: string, 
  prisma: any
): Promise<CompetitorInfo[]> {
  if (competitors.length === 0) return competitors;

  // Helper function to normalize brand names for comparison
  function normalizeBrandName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+(inc\.?|llc\.?|corp\.?|corporation|company|co\.?|ltd\.?|limited)$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Helper function to extract root domain from website
  function extractRootDomain(website: string): string {
    try {
      const url = website.startsWith('http') ? website : `https://${website}`;
      const parsed = new URL(url);
      let domain = parsed.hostname.toLowerCase();
      
      // Remove www. prefix
      if (domain.startsWith('www.')) {
        domain = domain.substring(4);
      }
      
      return domain;
    } catch {
      return website.toLowerCase();
    }
  }

  // Helper function to check if two domains are similar (same root domain)
  function areSimilarDomains(domain1: string, domain2: string): boolean {
    const root1 = extractRootDomain(domain1);
    const root2 = extractRootDomain(domain2);
    
    // Exact match
    if (root1 === root2) return true;
    
    // Check if one is a subdomain of the other
    return root1.includes(root2) || root2.includes(root1);
  }

  // Get existing competitors for this company to avoid conflicts
  const existingCompetitors = await prisma.competitor.findMany({
    where: { companyId },
    select: { name: true, website: true }
  });

  // Create a map for existing competitors by normalized name and domain
  const existingByName = new Map<string, string>();
  const existingByDomain = new Map<string, string>();
  
  for (const existing of existingCompetitors) {
    const normName = normalizeBrandName(existing.name);
    const domain = extractRootDomain(existing.website);
    existingByName.set(normName, existing.website);
    existingByDomain.set(domain, existing.name);
  }

  // Deduplicate the new competitors
  const seenNames = new Set<string>();
  const seenDomains = new Set<string>();
  const deduplicated: CompetitorInfo[] = [];

  // Sort by confidence score (highest first) to keep the best entries
  const sortedCompetitors = [...competitors].sort((a, b) => {
    const confA = (a as any).confidence || 0.8; // Default confidence if missing
    const confB = (b as any).confidence || 0.8;
    return confB - confA;
  });

  for (const competitor of sortedCompetitors) {
    const normalizedName = normalizeBrandName(competitor.name);
    const rootDomain = extractRootDomain(competitor.website);

    // Skip if we've already seen this brand name (normalized)
    if (seenNames.has(normalizedName)) {
      console.log(`🔄 Skipping duplicate brand name: ${competitor.name} (normalized: ${normalizedName})`);
      continue;
    }

    // Skip if we've already seen this domain
    if (seenDomains.has(rootDomain)) {
      console.log(`🔄 Skipping duplicate domain: ${competitor.website} (domain: ${rootDomain})`);
      continue;
    }

    // Check for similar domains (e.g., cedars-sinai.com vs www.cedars-sinai.com/health)
    let hasSimilarDomain = false;
    for (const seenDomain of seenDomains) {
      if (areSimilarDomains(rootDomain, seenDomain)) {
        console.log(`🔄 Skipping similar domain: ${rootDomain} (similar to ${seenDomain})`);
        hasSimilarDomain = true;
        break;
      }
    }
    
    if (hasSimilarDomain) continue;

    // Check against existing competitors to avoid conflicts
    if (existingByName.has(normalizedName) || existingByDomain.has(rootDomain)) {
      console.log(`🔄 Skipping existing competitor: ${competitor.name} / ${rootDomain}`);
      continue;
    }

    // This competitor passes all deduplication checks
    seenNames.add(normalizedName);
    seenDomains.add(rootDomain);
    deduplicated.push({
      name: competitor.name,
      website: `https://${rootDomain}`, // Ensure canonical format
    });
  }

  console.log(
    `🎯 Deduplication complete: ${competitors.length} → ${deduplicated.length} competitors`
  );
  
  return deduplicated;
}

/**
 * Main report processing function
 */
async function processReport(runId: string, company: any): Promise<void> {
  console.log(
    `🚀 Starting report generation for ${company?.name || "Unknown"}`,
  );
  console.log(`📊 Stage 0: Checking AWS credentials...`);
  
  // Debug AWS credentials availability
  const awsKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION;
  console.log(`AWS_ACCESS_KEY_ID: ${awsKeyId ? 'SET' : 'MISSING'}`);
  console.log(`AWS_SECRET_ACCESS_KEY: ${awsSecret ? 'SET' : 'MISSING'}`);
  console.log(`AWS_REGION: ${awsRegion || 'MISSING'}`);

  console.log(`📊 Stage 1: Getting direct database client...`);

  // Use direct database connection instead of cache
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

    // === STAGE 1: Check for Questions or Generate Them ===
    console.log(
      `📊 Stage 1: Checking if questions exist for company`,
    );

    await prisma.reportRun.update({
      where: { id: runId },
      data: { stepStatus: "Checking for existing questions" },
    });

    // Check if any questions exist for this company
    const existingQuestions = await prisma.question.findMany({
      where: { companyId: fullCompany.id },
    });

    let activeQuestions;

    if (existingQuestions.length === 0) {
      // First report run - generate questions
      console.log(`🔍 First report run for ${fullCompany.name} - generating questions`);
      
      await prisma.reportRun.update({
        where: { id: runId },
        data: { stepStatus: "First run: researching company and generating questions" },
      });

      // Step 1: Research company website with Sonar
      const { pydanticLlmService } = await import(
        "../services/pydanticLlmService"
      );

      console.log(`📝 Step 1: Researching website for ${fullCompany.name}`);
      const researchResult = await pydanticLlmService.executeAgent(
        "research_agent.py",
        {
          company_name: fullCompany.name,
          website_url: fullCompany.website,
          industry: fullCompany.industry || "General",
        },
        null,
        {
          temperature: 0.3,
          maxTokens: 1500,
          timeout: 60000,
        }
      );

      if (!researchResult.data) {
        throw new Error("Company research failed - no data returned");
      }

      console.log(`🤖 Step 2: Generating questions based on research for ${fullCompany.name}`);
      
      // Step 2: Generate questions using GPT-4.1-mini
      const questionResult = await pydanticLlmService.executeAgent(
        "question_agent.py",
        {
          company_name: fullCompany.name,
          research_context: researchResult.data,
        },
        null,
        {
          temperature: 0.7,
          maxTokens: 2000,
          timeout: 30000,
        }
      );

      if (questionResult.data && 
          typeof questionResult.data === 'object' && 
          'activeQuestions' in questionResult.data && 
          'suggestedQuestions' in questionResult.data) {
        const { activeQuestions: generatedActive, suggestedQuestions } = questionResult.data as {
          activeQuestions: Array<{ query: string; type: string; intent: string }>;
          suggestedQuestions: Array<{ query: string; type: string; intent: string }>;
        };
        
        // Store all 25 questions in database
        const questionsToCreate = [
          ...generatedActive.map((q: any) => ({
            query: q.query,
            type: q.type,
            intent: q.intent,
            isActive: true,
            source: "ai",
            companyId: fullCompany.id,
          })),
          ...suggestedQuestions.map((q: any) => ({
            query: q.query,
            type: q.type,
            intent: q.intent,
            isActive: false,
            source: "ai",
            companyId: fullCompany.id,
          })),
        ];

        await prisma.question.createMany({
          data: questionsToCreate,
        });

        // Mark questions as ready
        await prisma.company.update({
          where: { id: fullCompany.id },
          data: { questionsReady: true },
        });

        // Fetch the newly created active questions
        activeQuestions = await prisma.question.findMany({
          where: {
            companyId: fullCompany.id,
            isActive: true,
          },
          orderBy: { createdAt: "asc" },
        });

        console.log(`✅ Generated and stored ${questionsToCreate.length} questions for ${fullCompany.name}`);
      } else {
        throw new Error("Question generation failed - unexpected response format");
      }
    } else {
      // Subsequent reports - use existing active questions
      console.log(`📋 Using existing questions for ${fullCompany.name}`);
      
      activeQuestions = await prisma.question.findMany({
        where: {
          companyId: fullCompany.id,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (activeQuestions.length === 0) {
        throw new Error(
          `No active questions found for company ${fullCompany.name}. Please activate some questions before generating a report.`,
        );
      }
    }

    await prisma.reportRun.update({
      where: { id: runId },
      data: {
        stepStatus: `Ready to process ${activeQuestions.length} active questions`,
      },
    });

    console.log(
      `✅ Ready to process ${activeQuestions.length} active questions`,
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

    // Import pydantic service for question answering
    const { pydanticLlmService } = await import(
      "../services/pydanticLlmService"
    );

    // Initialize competitor pipeline for parallel processing
    const competitorPipeline = new CompetitorPipeline(runId);

    // Create question-model combinations and process them
    const questionLimit = pLimit(LLM_CONFIG.QUESTION_ANSWERING_CONCURRENCY);
    const questionPromises = [];

    for (const question of activeQuestions) {
      for (const model of questionModels) {
        const promise = questionLimit(async () => {
          try {
            const questionInput = {
              question: question.query,
              company_name: fullCompany.name, // still used for brand-detection fallback
              enable_web_search: true,
            };

            const result = await pydanticLlmService.executeAgent(
              "answer_agent.py",
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

            // Save the response for the active question
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
                  question_type: question.type,
                  question_intent: question.intent,
                  question_source: question.source,
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
              `✅ Generated response for "${question.query}" with ${model.id}`,
            );
            return { success: true };
          } catch (error) {
            console.error(
              `❌ Failed to process question "${question.query}" with ${model.id}:`,
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

    // Apply final deduplication before storage
    const deduplicatedCompetitors = await deduplicateCompetitors(competitors, fullCompany.id, prisma);
    
    // Save enriched competitors
    for (const competitor of deduplicatedCompetitors) {
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
    
    console.log(`🔄 Deduplicated ${competitors.length} → ${deduplicatedCompetitors.length} competitors`);

    console.log(`✅ Stored ${deduplicatedCompetitors.length} unique competitors`);

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
      await persistOptimizationTasks(PRESET_TASKS as any, runId, fullCompany.id, prisma);
      console.log(`✅ Optimization tasks generated successfully`);
    } catch (error) {
      console.error(`❌ Failed to generate optimization tasks:`, error);
    }

    console.log(`🎉 Report generation completed successfully!`);
    console.log(
      `📊 Total: ${activeQuestions.length} questions, ${successfulQuestions} responses, ${competitors.length} competitors, ${successfulSentiments.length} sentiment analyses`,
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
  try {
    console.log(`🔥 WORKER ENTRY POINT - Job ${job.id} starting...`);
    
    const { runId, company, force } = job.data;

  console.log(
    `🎯 Processing job ${job.id} - Report generation for company '${company.name}'`,
  );
  
  console.log(`🔍 AWS ENV CHECK: KEY=${process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'MISSING'}, SECRET=${process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'MISSING'}, REGION=${process.env.AWS_REGION || 'MISSING'}`);

    try {
      await processReport(runId, company);
      console.log(`✅ Job ${job.id} completed successfully`);
    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      console.error(`❌ Error stack:`, error instanceof Error ? error.stack : error);
      throw error;
    }
  } catch (outerError) {
    console.error(`🚨 CRITICAL: Job processor failed at entry level:`, outerError);
    console.error(`🚨 Stack:`, outerError instanceof Error ? outerError.stack : outerError);
    throw outerError;
  }
};
