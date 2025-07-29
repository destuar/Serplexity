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
import { PydanticProvider, PydanticResponse, PydanticQuestionResult, ExtendedCompetitorInfo } from "../types/pydantic";
import { PrismaClient } from "@prisma/client";
import pLimit from "p-limit";
import env from "../config/env";
import { getBullMQConnection, getBullMQOptions, getWorkerOptions } from "../config/bullmq";
import { getDbClient } from "../config/database"; // Direct DB connection instead of cache
import { Prisma } from ".prisma/client";
import {
  generateSentimentScores,
  generateOverallSentimentSummary,
  SentimentScores,
  generateWebsiteForCompetitors,
  getModelsByTaskWithUserPreferences,
  CompetitorInfo,
} from "../services/llmService";
import { ModelTask, LLM_CONFIG } from "../config/models";
import { CostCalculator } from "../config/llmPricing";
import { computeAndPersistMetrics } from "../services/metricsService";
import { initializeLogfire } from "../config/logfire";
import { checkRedisHealth } from "../config/redis";
import { dbCache } from "../config/dbCache";

// Type definitions for report worker
interface CompanyData {
  id: string;
  name: string;
  domain: string;
  timezone?: string;
}

interface _ProgressData {
  stage: string;
  progress: number;
  message?: string;
}

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
        // Simple health check - check available providers
        const providers = pydanticLlmService.getAvailableProviders();
        const healthyProviders = (providers as PydanticProvider[]).filter(p => p.status === 'available').length;
        if (healthyProviders > 0) {
          console.log("✅ PydanticAI service verified");
        } else {
          console.warn("⚠️  No healthy PydanticAI providers available");
        }
      } catch {
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

  worker.on("progress", (job: Job, progress: unknown) => {
    console.log(`📈 Job ${job.id} progress:`, progress);
  });

  worker.on("completed", (job: Job) => {
    const { company } = job.data;
    console.log(`✅ Worker event: Job ${job.id} completed for ${company?.name}`);
  });

  worker.on("failed", async (job, err) => {
    const { company } = job?.data || {};
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
 * Calculate USD cost from ACTUAL token usage and web searches
 * CRITICAL: This replaces the dangerous estimation-based approach
 */
function calculateCost(
  modelId: string | undefined,
  inputTokens: number,
  outputTokens: number = 0,
  searchCount: number = 0,
  thinkingTokens?: number,
  cachedTokens?: number,
): number {
  if (!modelId) return 0;

  try {
    const result = CostCalculator.calculateTotalCost(
      modelId,
      inputTokens,
      outputTokens,
      searchCount,
      cachedTokens,
      thinkingTokens,
    );
    
    // Log cost breakdown for audit trail
    console.log(`💰 Cost calculation for ${modelId}:`, {
      inputTokens,
      outputTokens,
      thinkingTokens,
      searchCount,
      breakdown: result.breakdown,
      totalCost: result.totalCost
    });
    
    return result.totalCost;
  } catch (error) {
    console.error(`❌ CRITICAL: Cost calculation failed for model ${modelId}:`, error);
    // Don't silently return 0 - this hides cost tracking failures
    throw new Error(`Cost calculation failed for ${modelId}: ${error}`);
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
  competitors: ExtendedCompetitorInfo[], 
  companyId: string, 
  prisma: PrismaClient
): Promise<ExtendedCompetitorInfo[]> {
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
  const deduplicated: ExtendedCompetitorInfo[] = [];

  // Sort by confidence score (highest first) to keep the best entries
  const sortedCompetitors = [...competitors].sort((a, b) => {
    const confA = a.confidence || 0.8; // Default confidence if missing
    const confB = b.confidence || 0.8;
    return confB - confA;
  });

  for (const competitor of sortedCompetitors) {
    const normalizedName = normalizeBrandName(competitor.name);
    const rootDomain = extractRootDomain(competitor.website || "");

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
async function processReport(runId: string, company: CompanyData): Promise<void> {
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

      // Handle both the Python response format and the expected format
      const resultData = (questionResult as PydanticQuestionResult).data;
      let generatedActive: Array<{ query: string; type: string; intent: string }> = [];
      let suggestedQuestions: Array<{ query: string; type: string; intent: string }> = [];

      if (resultData && typeof resultData === 'object') {
        console.log(`🔍 Question result data keys: ${Object.keys(resultData)}`);
        
        // Check for nested result structure first (Python agent format)
        if ('result' in resultData && resultData.result) {
          const nestedResult = resultData.result;
          generatedActive = nestedResult.activeQuestions || [];
          suggestedQuestions = nestedResult.suggestedQuestions || [];
        }
        // Check for direct structure (expected format)
        else if ('activeQuestions' in resultData && 'suggestedQuestions' in resultData) {
          generatedActive = resultData.activeQuestions || [];
          suggestedQuestions = resultData.suggestedQuestions || [];
        }
        // Handle Python snake_case format
        else if ('active_questions' in resultData && 'suggested_questions' in resultData) {
          generatedActive = resultData.active_questions || [];
          suggestedQuestions = resultData.suggested_questions || [];
        }
      }

      if (generatedActive.length > 0 && suggestedQuestions.length > 0) {
        
        console.log(`✅ Found ${generatedActive.length} active questions and ${suggestedQuestions.length} suggested questions`);
        
        // Store all 25 questions in database
        const questionsToCreate = [
          ...generatedActive.map((q: { query: string; type: string; intent: string }) => ({
            query: q.query,
            type: q.type,
            intent: q.intent,
            isActive: true,
            source: "ai",
            companyId: fullCompany.id,
          })),
          ...suggestedQuestions.map((q: { query: string; type: string; intent: string }) => ({
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
        console.log(`❌ Question generation failed - no valid questions found`);
        console.log(`🔍 Active questions count: ${generatedActive.length}`);
        console.log(`🔍 Suggested questions count: ${suggestedQuestions.length}`);
        console.log(`🔍 Raw questionResult.data:`, JSON.stringify(questionResult.data, null, 2));
        
        throw new Error(`Question generation failed - no valid questions found. Active: ${generatedActive.length}, Suggested: ${suggestedQuestions.length}`);
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
    const questionTracker = new Map(); // Track processing status per question

    // Initialize tracker for all questions
    for (const question of activeQuestions) {
      questionTracker.set(question.id, {
        question: question.query,
        attempted: 0,
        successful: 0,
        failed: 0,
        models: []
      });
    }

    for (const question of activeQuestions) {
      for (const model of questionModels) {
        const promise = questionLimit(async () => {
          const tracker = questionTracker.get(question.id);
          tracker.attempted++;
          tracker.models.push(model.id);

          try {
            console.log(`🤖 Processing question "${question.query.substring(0, 50)}..." with ${model.id}`);
            
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

            const response = result.data as PydanticResponse;
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
                } as Prisma.JsonObject,
              },
            });

            console.log(`📊 [PERPLEXITY DEBUG] Saved response with model: "${model.id}" for question: "${question.query.substring(0, 50)}..."`);

            // Extract and save citations - handle both markdown links and natural URLs
            const citations = new Set(); // Avoid duplicates
            let citationPosition = 1;

            // 1. Extract markdown-style citations [title](url)
            const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            let markdownMatch;
            while ((markdownMatch = markdownRegex.exec(response.answer)) !== null) {
              const title = markdownMatch[1];
              const url = markdownMatch[2];
              citations.add({ url, title, source: 'markdown' });
            }

            // 2. Extract natural URLs from web search responses
            const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)/g;
            const urlMatches = response.answer.match(urlRegex) || [];
            
            for (const url of urlMatches) {
              // Extract domain for title
              try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname.replace('www.', '');
                const title = `${domain.charAt(0).toUpperCase() + domain.slice(1)} - Web Result`;
                citations.add({ url, title, source: 'natural' });
              } catch {
                continue; // Skip invalid URLs
              }
            }

            // 3. Extract from structured citation data if available
            if (response.citations && Array.isArray(response.citations)) {
              for (const cite of response.citations) {
                if (cite.url && cite.title) {
                  citations.add({ url: cite.url, title: cite.title, source: 'structured' });
                }
              }
            }

            console.log(`📊 [PERPLEXITY DEBUG] Found ${citations.size} citations from ${model.id} response`);

            // 4. Save all unique citations to database
            for (const citation of Array.from(citations) as Array<{url: string; title: string; source: string}>) {
              try {
                const urlObj = new URL(citation.url);
                const domain = urlObj.hostname;

                await prisma.citation.create({
                  data: {
                    responseId: responseRecord.id,
                    url: citation.url,
                    title: citation.title,
                    domain,
                    position: citationPosition,
                    accessedAt: new Date(),
                  },
                });

                citationPosition++;
              } catch {
                console.warn(`Invalid URL in citation: ${citation.url}`);
              }
            }

            // Extract and save ALL brand mentions with intelligent matching
            const brandMentionRegex =
              /<brand(?:\s+position="(\d+)")?>([^<]+)<\/brand>/gi;
            let mentionMatch;
            let fallbackPosition = 1;

            console.log(`🔍 [PERPLEXITY DEBUG] Processing brand mentions for ${model.id} response to: "${question.query.substring(0, 50)}..."`);

            const mentionsFound: Array<{brandName: string; position: number; isCompany: boolean}> = [];

            while (
              (mentionMatch = brandMentionRegex.exec(response.answer)) !== null
            ) {
              const position = mentionMatch[1]
                ? parseInt(mentionMatch[1])
                : fallbackPosition++;
              const brandName = mentionMatch[2].trim();

              console.log(`🏢 [PERPLEXITY DEBUG] Found brand mention: "${brandName}" at position ${position} in ${model.id} response`);

              // Intelligent brand matching - check various forms of the company name
              // Also check if brandName is a domain-like version (e.g., "nordstrom" for "Nordstrom")
              const companyNameLower = fullCompany.name.toLowerCase();
              const brandNameLower = brandName.toLowerCase();
              
              const isCompanyMention = 
                brandNameLower === companyNameLower ||
                brandNameLower.includes(companyNameLower) ||
                companyNameLower.includes(brandNameLower) ||
                // Handle domain-style mentions (nordstrom.com -> nordstrom)
                brandNameLower === companyNameLower.replace(/\s+/g, '') ||
                companyNameLower.replace(/\s+/g, '') === brandNameLower ||
                // Handle brand without spaces/punctuation
                brandNameLower.replace(/[^a-z0-9]/g, '') === companyNameLower.replace(/[^a-z0-9]/g, '');

              if (isCompanyMention) {
                // Company mention
                await prisma.mention.create({
                  data: {
                    responseId: responseRecord.id,
                    position,
                    companyId: fullCompany.id,
                  },
                });
                mentionsFound.push({brandName, position, isCompany: true});
                console.log(`✅ [PERPLEXITY DEBUG] Saved company mention: ${brandName} for ${model.id}`);
              } else {
                // First check if it's a known competitor with fuzzy matching
                let competitor = await prisma.competitor.findFirst({
                  where: {
                    companyId: fullCompany.id,
                    OR: [
                      { name: { contains: brandName, mode: "insensitive" } },
                      { name: { equals: brandName, mode: "insensitive" } },
                      // Also check if brandName contains competitor name
                      ...(brandName.length > 3 ? [{ name: { in: [brandName] } }] : [])
                    ]
                  },
                });

                // If not found, create new competitor immediately
                // BUT first double-check this isn't the main company (safety check)
                if (!competitor && !isCompanyMention) {
                  try {
                    competitor = await prisma.competitor.create({
                      data: {
                        name: brandName,
                        companyId: fullCompany.id,
                        website: `https://${brandName.toLowerCase().replace(/\s+/g, '')}.com`, // Placeholder
                        isGenerated: true,
                      },
                    });
                    console.log(`🆕 [PERPLEXITY DEBUG] Created new competitor: ${brandName} for ${model.id}`);
                  } catch {
                    // Handle duplicate creation race condition
                    competitor = await prisma.competitor.findFirst({
                      where: {
                        companyId: fullCompany.id,
                        name: { equals: brandName, mode: "insensitive" }
                      },
                    });
                  }
                } else if (isCompanyMention) {
                  console.log(`🚫 [PERPLEXITY DEBUG] Skipping competitor creation for company brand: ${brandName}`);
                }

                // Save mention for competitor
                if (competitor) {
                  await prisma.mention.create({
                    data: {
                      responseId: responseRecord.id,
                      position,
                      competitorId: competitor.id,
                    },
                  });
                  mentionsFound.push({brandName, position, isCompany: false});
                  console.log(`✅ [PERPLEXITY DEBUG] Saved competitor mention: ${brandName} for ${model.id}`);
                }
              }
            }

            console.log(`📊 [PERPLEXITY DEBUG] ${model.id} mention summary - Total: ${mentionsFound.length}, Company: ${mentionsFound.filter(m => m.isCompany).length}, Competitors: ${mentionsFound.filter(m => !m.isCompany).length}`);

            tracker.successful++;
            console.log(
              `✅ Successfully processed question "${question.query.substring(0, 50)}..." with ${model.id}`,
            );
            return { success: true, questionId: question.id, modelId: model.id };
          } catch (error) {
            tracker.failed++;
            console.error(
              `❌ Failed to process question "${question.query.substring(0, 50)}..." with ${model.id}:`,
              error,
            );
            return { success: false, error, questionId: question.id, modelId: model.id };
          }
        });

        questionPromises.push(promise);
      }
    }

    // Process questions with granular progress updates
    let completedQuestions = 0;
    const totalQuestionPromises = questionPromises.length;
    
    const questionResults = await Promise.allSettled(
      questionPromises.map(async (promise) => {
        const result = await promise;
        completedQuestions++;
        
        // Update progress every 5 questions or at key milestones
        if (completedQuestions % 5 === 0 || completedQuestions === totalQuestionPromises) {
          const progressPercent = Math.round((completedQuestions / totalQuestionPromises) * 100);
          
          await prisma.reportRun.update({
            where: { id: runId },
            data: { 
              stepStatus: `Generating answers to target market questions (${progressPercent}% - ${completedQuestions}/${totalQuestionPromises} processed)` 
            },
          });
          
          console.log(`📊 Question progress: ${completedQuestions}/${totalQuestionPromises} (${progressPercent}%)`);
        }
        
        return result;
      })
    );
    
    const successfulAnswers = questionResults.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;

    // Log detailed results per question
    console.log(`📊 Question processing summary:`);
    console.log(`📊 Total question-model combinations: ${questionPromises.length}`);
    console.log(`📊 Successful answers: ${successfulAnswers}/${questionPromises.length}`);
    
    for (const [, tracker] of questionTracker) {
      const { question, attempted, successful, failed, models } = tracker;
      console.log(`📊 Question: "${question.substring(0, 50)}..."`);
      console.log(`📊   - Attempted: ${attempted}, Successful: ${successful}, Failed: ${failed}`);
      console.log(`📊   - Models: ${models.join(", ")}`);
      
      if (successful === 0) {
        console.error(`❌ CRITICAL: Question "${question}" has NO successful responses!`);
        console.error(`❌   This question will appear as inactive in the UI`);
        console.error(`❌   Models attempted: ${models.join(", ")}`);
      }
    }

    console.log(
      `📊 Question answering complete: ${successfulAnswers}/${questionPromises.length} successful`,
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
      .map((r) => (r as PromiseFulfilledResult<{ success: boolean; data: SentimentScores }>).value.data);

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
    const deduplicatedCompetitors = await deduplicateCompetitors(competitors as ExtendedCompetitorInfo[], fullCompany.id, prisma);
    
    // Save enriched competitors
    for (const competitor of deduplicatedCompetitors) {
      await prisma.competitor.upsert({
        where: {
          companyId_website: {
            companyId: fullCompany.id,
            website: competitor.website || "",
          },
        },
        update: {
          name: competitor.name,
          isGenerated: true,
        },
        create: {
          companyId: fullCompany.id,
          name: competitor.name,
          website: competitor.website || "",
          isGenerated: true,
        },
      });
    }
    
    console.log(`🔄 Deduplicated ${competitors.length} → ${deduplicatedCompetitors.length} competitors`);

    console.log(`✅ Stored ${deduplicatedCompetitors.length} unique competitors`);

    // === FINALIZATION ===
    const duration = Date.now() - startTime;

    // Check if any questions generated successful responses
    if (successfulAnswers === 0) {
      await prisma.reportRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          stepStatus: "Report failed: No questions generated successful responses",
          tokensUsed: totalTokens,
          usdCost: totalCost,
        },
      });
      throw new Error("Report failed: No questions generated successful responses");
    }

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
      console.log(`✅ Metrics computed successfully for report ${runId}`);
    } catch (error) {
      // 10x IMPROVEMENT: Enhanced error logging for better debugging
      console.error(`❌ CRITICAL: Failed to compute metrics for report ${runId}:`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        reportId: runId,
        companyId: fullCompany.id,
        timestamp: new Date().toISOString()
      });
      
      // TODO: In production, consider alerting/monitoring integration
      // This non-blocking failure means dashboard will use degraded mode
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
      `📊 Total: ${activeQuestions.length} questions, ${successfulAnswers} responses, ${competitors.length} competitors, ${successfulSentiments.length} sentiment analyses`,
    );
    console.log(`💰 Cost: ${totalTokens} tokens, $${totalCost.toFixed(4)} USD`);
    console.log(`⏱️  Duration: ${(duration / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error(`💥 Report generation failed:`, error);

    // Enhanced error handling with database connection resilience
    await safeUpdateReportStatus(prisma, runId, {
      status: "FAILED",
      stepStatus: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      tokensUsed: totalTokens,
      usdCost: totalCost,
    });

    throw error;
  }
}

/**
 * Safely update report status with database connection resilience
 * Prevents cascade failures when database connections fail during error handling
 */
async function safeUpdateReportStatus(
  prisma: PrismaClient,
  runId: string, 
  updateData: {
    status: string;
    stepStatus: string;
    tokensUsed?: number;
    usdCost?: number;
  },
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.reportRun.update({
        where: { id: runId },
        data: updateData,
      });
      
      console.log(`✅ Report status updated successfully (attempt ${attempt})`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown database error');
      
      // Log the database error with context
      console.error(`❌ Database update failed (attempt ${attempt}/${maxRetries}):`, {
        error: lastError.message,
        runId,
        updateData,
        attempt,
        isTLSError: lastError.message.includes('certificate') || lastError.message.includes('TLS') || lastError.message.includes('SSL')
      });
      
      // Handle specific database connection errors
      if (isDatabaseConnectionError(lastError)) {
        console.warn(`🔄 Database connection issue detected, attempting reconnection...`);
        
        // Wait with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try to reinitialize database connection if possible
        try {
          await reinitializeDatabaseConnection();
        } catch (reconnectError) {
          console.error(`❌ Database reconnection failed:`, reconnectError);
        }
      } else if (attempt === maxRetries) {
        // Non-recoverable error or max retries reached
        break;
      }
    }
  }
  
  // If all retries failed, log to alternative storage or alerting system
  console.error(`💥 CRITICAL: Failed to update report status after ${maxRetries} attempts`, {
    runId,
    updateData,
    lastError: lastError?.message,
    timestamp: new Date().toISOString()
  });
  
  // Send to fallback error reporting (don't throw to prevent cascade failure)
  await fallbackErrorReporting(runId, updateData, lastError);
}

/**
 * Check if error is a database connection-related issue
 */
function isDatabaseConnectionError(error: Error): boolean {
  const connectionErrors = [
    'certificate',
    'TLS connection',
    'SSL',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'connection terminated',
    'connection refused',
    'server closed the connection'
  ];
  
  return connectionErrors.some(pattern => 
    error.message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Attempt to reinitialize database connection
 */
async function reinitializeDatabaseConnection(): Promise<void> {
  try {
    // Import database service dynamically to avoid circular dependencies
    const { databaseService } = await import("../config/database");
    
    // Force reconnection by testing and reinitializing if needed
    const isHealthy = await databaseService.testConnection();
    if (!isHealthy) {
      throw new Error("Database health check failed after reconnection attempt");
    }
    
    console.log("✅ Database connection reinitialized successfully");
  } catch (error) {
    console.error("❌ Database reinitialization failed:", error);
    throw error;
  }
}

/**
 * Fallback error reporting when database is unavailable
 */
async function fallbackErrorReporting(
  runId: string, 
  updateData: Record<string, unknown>, 
  error: Error | null
): Promise<void> {
  try {
    // Log to file system as fallback
    const fallbackLog = {
      timestamp: new Date().toISOString(),
      event: 'database_update_failed',
      runId,
      updateData,
      error: error?.message,
      stack: error?.stack
    };
    
    // In a production environment, you could:
    // 1. Write to a local file
    // 2. Send to an external monitoring service
    // 3. Publish to a message queue
    // 4. Send webhook notification
    
    console.error(`📝 FALLBACK ERROR LOG:`, JSON.stringify(fallbackLog, null, 2));
    
    // Example: Send to external monitoring (implement based on your monitoring setup)
    // await sendToExternalMonitoring(fallbackLog);
    
  } catch (fallbackError) {
    console.error(`💥 CRITICAL: Even fallback error reporting failed:`, fallbackError);
  }
}

/**
 * Main job processor
 */
const processJob = async (job: Job) => {
  try {
    console.log(`🔥 WORKER ENTRY POINT - Job ${job.id} starting...`);
    
    const { runId, company } = job.data;

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
