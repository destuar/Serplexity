/**
 * @file reportWorker.ts
 * @description This file defines the core BullMQ worker responsible for generating comprehensive reports.
 * It orchestrates a multi-stage process including: fetching company data, generating fanout questions,
 * performing sentiment analysis, generating responses to questions, enriching competitor data, and persisting
 * all this information to the database. It also handles progress updates, error logging, and post-processing
 * tasks like metrics computation and optimization task generation. This is arguably the most complex and critical
 * worker in the system.
 *
 * @dependencies
 * - bullmq: The BullMQ library for creating workers.
 * - p-limit: A tiny promise concurrency limiter.
 * - ../config/env: Environment variable configuration.
 * - ../config/bullmq: BullMQ connection configuration.
 * - ../config/db: The singleton Prisma client instance.
 * - @prisma/client: Prisma client types.
 * - ../services/llmService: Service for interacting with LLMs (sentiment, questions, website enrichment).


 * - ../config/models: LLM model configuration and task mapping.
 * - ../types/reports: Type definitions for reports.
 * - ./streaming-db-writer: Utility for streaming database writes.
 * - ../services/metricsService: Service for computing and persisting report metrics.
 * - ./archiveWorker: BullMQ queue for archiving old data.
 * - ../services/alertingService: Service for sending system alerts.
 *
 * @exports
 * - worker: The BullMQ worker instance for report generation jobs.
 */
import { Worker, Job } from 'bullmq';
import pLimit from 'p-limit';
import env from '../config/env';
import { getBullMQConnection } from '../config/bullmq';
import { getDbClient } from '../config/database';
import { Prisma, PrismaClient } from '.prisma/client';
import { 
    generateSentimentScores, 
    generateOverallSentimentSummary, 
    generateQuestionResponse,
    generateWebsiteForCompetitors,
    SentimentScores,
    CompetitorInfo,
    QuestionInput,
    TokenUsage,
    ChatCompletionResponse
} from '../services/llmService';
// NOTE: Fanout generation now handled directly by PydanticAI fanout_agent.py
// Legacy fanout service imports removed - using inline PydanticAI implementation
import { getModelsByTask, ModelTask, LLM_CONFIG } from '../config/models';
import { CostCalculator } from '../config/llmPricing';

/**
 * Helper function to calculate and accumulate USD cost from token usage
 */
function addCostFromUsage(
    modelId: string | undefined,
    promptTokens: number,
    completionTokens: number,
    searchCount: number = 0
): number {
    if (!modelId) {
        console.warn('Model ID not provided for cost calculation, skipping cost tracking');
        return 0;
    }
    
    try {
        const { totalCost } = CostCalculator.calculateTotalCost(
            modelId,
            promptTokens,
            completionTokens,
            searchCount
        );
        return totalCost;
    } catch (error) {
        console.warn(`Failed to calculate cost for model ${modelId}:`, error);
        return 0;
    }
}
import { z } from 'zod';
import { Question } from '../types/reports';
import { StreamingDatabaseWriter } from './streaming-db-writer';
import { computeAndPersistMetrics } from '../services/metricsService';
import { archiveQueue } from './archiveWorker';
import { alertingService } from '../services/alertingService';
import { initializeLogfire } from '../config/logfire';

// Initialize Logfire for this worker
(async () => {
  try {
    await initializeLogfire({
      serviceName: 'report-worker',
      enableAutoInstrumentation: false, // We use custom spans
    });
    console.log('Logfire initialized for report worker');
  } catch (error) {
    console.error('Failed to initialize Logfire for report worker', error);
    // Decide if you want to exit the process if logging fails
    // process.exit(1);
  }
})();

// Simple log types instead of complex levels
type LogType = 'STAGE' | 'CONTENT' | 'PERFORMANCE' | 'TECHNICAL' | 'ERROR';

// Enhanced logging with structured data and performance metrics
interface LogContext {
    runId: string;
    stage?: string;
    step?: string;
    progress?: number;
    duration?: number;
    tokenUsage?: { prompt: number; completion: number; total: number };
    error?: any;
    metadata?: Record<string, any>;
}

const log = (context: LogContext | string, message?: string, _logType?: any) => {
    const timestamp = new Date().toISOString();
    
    if (typeof context === 'string') {
        // Legacy support for simple string logging
        if (LLM_CONFIG.LOGGING.SHOW_STAGES) {
            console.log(`[${timestamp}] ${context}: ${message || ''}`);
        }
        return;
    }

    const { runId, stage, step, progress, duration, tokenUsage, error, metadata } = context;
    
    // Always show stage transitions
    if (LLM_CONFIG.LOGGING.SHOW_STAGES) {
        let logLine = `[${timestamp}]`;
        if (stage) logLine += ` [${stage}]`;
        if (step) logLine += ` ${step}`;
        if (progress !== undefined) logLine += ` (${progress}%)`;
        logLine += ` ${message || ''}`;
        
        // Show performance info if enabled
        if (LLM_CONFIG.LOGGING.SHOW_PERFORMANCE) {
            if (duration !== undefined) logLine += ` - ${duration}ms`;
            if (tokenUsage) logLine += ` - ${tokenUsage.total} tokens`;
        }
        
        console.log(logLine);
    }
    
    // Show actual generated content if enabled and available
    if (LLM_CONFIG.LOGGING.SHOW_GENERATED_CONTENT && metadata) {
        if (metadata.generatedQuestions && Array.isArray(metadata.generatedQuestions)) {
            console.log('  Generated Questions:');
            metadata.generatedQuestions.forEach((q: string, i: number) => {
                console.log(`    ${i + 1}. ${q}`);
            });
        }
        
        if (metadata.generatedCompetitors && Array.isArray(metadata.generatedCompetitors)) {
            console.log('  Generated Competitors:');
            metadata.generatedCompetitors.slice(0, 5).forEach((c: any) => {
                console.log(`    - ${c.name} (${c.website})`);
            });
            if (metadata.generatedCompetitors.length > 5) {
                console.log(`    ... and ${metadata.generatedCompetitors.length - 5} more`);
            }
        }
        
        if (metadata.responseContent && typeof metadata.responseContent === 'string') {
            const truncated = metadata.responseContent.length > 200 
                ? metadata.responseContent.substring(0, 200) + '...'
                : metadata.responseContent;
            console.log(`  Response: ${truncated}`);
        }
        
        if (metadata.questionText && typeof metadata.questionText === 'string') {
            console.log(`  Question: ${metadata.questionText}`);
        }
    }
    
    // Show technical details if enabled
    if (LLM_CONFIG.LOGGING.SHOW_TECHNICAL_DETAILS && metadata && Object.keys(metadata).length > 0) {
        const techDetails = Object.entries(metadata)
            .filter(([key]) => !['generatedQuestions', 'generatedCompetitors', 'responseContent', 'questionText'].includes(key))
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join(', ');
        if (techDetails) {
            console.log(`  Technical: ${techDetails}`);
        }
    }
    
    // Always show errors if error logging is enabled
    if (error && LLM_CONFIG.LOGGING.SHOW_ERRORS) {
        console.error(`[ERROR] ${error.message}`);
        if (LLM_CONFIG.LOGGING.SHOW_TECHNICAL_DETAILS) {
            console.error(error.stack);
        }
    }
};

// Create a single concurrency limiter for all LLM calls in this worker
const limit = pLimit(LLM_CONFIG.WORKER_CONCURRENCY);

// Competitor enrichment pipeline for parallel processing
class CompetitorEnrichmentPipeline {
    private brandQueue: string[] = [];
    private processingBatches = new Set<Promise<void>>();
    private enrichmentLimit = pLimit(3); // Allow 3 parallel enrichment calls
    private isFinalized = false;
    private totalPromptTokens = 0;
    private totalCompletionTokens = 0;
    private totalUsdCost = 0;
    private processedBrands = new Set<string>();
    private enrichedCompetitors: CompetitorInfo[] = [];
    private readonly BATCH_SIZE = 20;
    
    constructor(
        private runId: string,
        private companyId: string,
        private fullCompany: any,
        private onProgressUpdate: (processed: number, total: number) => Promise<void>
    ) {}

    async addBrand(brandName: string): Promise<void> {
        if (this.isFinalized || this.processedBrands.has(brandName)) {
            return;
        }
        
        this.processedBrands.add(brandName);
        this.brandQueue.push(brandName);
        
        // Process batch if we have enough brands
        if (this.brandQueue.length >= this.BATCH_SIZE) {
            await this.processBatch();
        }
    }

    private async processBatch(): Promise<void> {
        if (this.brandQueue.length === 0) return;
        
        const batch = this.brandQueue.splice(0, this.BATCH_SIZE);
        
        const batchPromise = this.enrichmentLimit(async () => {
            try {
                log({
                    runId: this.runId,
                    stage: 'BRAND_DISCOVERY',
                    step: 'PIPELINE_BATCH_START',
                    metadata: {
                        batchSize: batch.length,
                        queueSize: this.brandQueue.length,
                        activeBatches: this.processingBatches.size
                    }
                }, `Starting pipeline enrichment for batch of ${batch.length} brands`);

                const { data: enrichedCompetitors, usage: websiteUsage, modelUsed } = await generateWebsiteForCompetitors(batch);
                
                this.totalPromptTokens += websiteUsage.promptTokens;
                this.totalCompletionTokens += websiteUsage.completionTokens;
                this.totalUsdCost += addCostFromUsage(modelUsed, websiteUsage.promptTokens, websiteUsage.completionTokens);
                
                // Store enriched competitors for later deduplication and saving
                this.enrichedCompetitors.push(...enrichedCompetitors);
                
                log({
                    runId: this.runId,
                    stage: 'BRAND_DISCOVERY',
                    step: 'PIPELINE_BATCH_COMPLETE',
                    tokenUsage: {
                        prompt: websiteUsage.promptTokens,
                        completion: websiteUsage.completionTokens,
                        total: websiteUsage.totalTokens
                    },
                    metadata: {
                        batchSize: batch.length,
                        enrichedCount: enrichedCompetitors.length,
                        totalEnriched: this.enrichedCompetitors.length
                    }
                }, `Pipeline enriched ${enrichedCompetitors.length}/${batch.length} competitors`);
                
                // Update progress
                await this.onProgressUpdate(this.enrichedCompetitors.length, this.processedBrands.size);
                
            } catch (error) {
                log({
                    runId: this.runId,
                    stage: 'BRAND_DISCOVERY',
                    step: 'PIPELINE_BATCH_ERROR',
                    error,
                    metadata: { batchSize: batch.length }
                }, `Pipeline enrichment batch failed`, 'ERROR');
            }
        });
        
        this.processingBatches.add(batchPromise);
        batchPromise.finally(() => {
            this.processingBatches.delete(batchPromise);
        });
    }

    async finalize(): Promise<{ 
        enrichedCompetitors: CompetitorInfo[], 
        totalPromptTokens: number, 
        totalCompletionTokens: number,
        totalUsdCost: number
    }> {
        this.isFinalized = true;
        
        // Process any remaining brands in the queue
        if (this.brandQueue.length > 0) {
            await this.processBatch();
        }
        
        // Wait for all batches to complete
        await Promise.all(Array.from(this.processingBatches));
        
        log({
            runId: this.runId,
            stage: 'BRAND_DISCOVERY',
            step: 'PIPELINE_FINALIZED',
            metadata: {
                totalBrandsProcessed: this.processedBrands.size,
                totalEnriched: this.enrichedCompetitors.length,
                totalPromptTokens: this.totalPromptTokens,
                totalCompletionTokens: this.totalCompletionTokens
            }
        }, `Pipeline finalized: ${this.enrichedCompetitors.length} competitors enriched from ${this.processedBrands.size} brands`);
        
        return {
            enrichedCompetitors: this.enrichedCompetitors,
            totalPromptTokens: this.totalPromptTokens,
            totalCompletionTokens: this.totalCompletionTokens,
            totalUsdCost: this.totalUsdCost
        };
    }
}

// Performance timing helper
class Timer {
    private startTime: number;
    
    constructor() {
        this.startTime = Date.now();
    }
    
    elapsed(): number {
        return Date.now() - this.startTime;
    }
    
    reset(): void {
        this.startTime = Date.now();
    }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateNameVariations(name: string): Set<string> {
    const variations = new Set<string>();
    variations.add(name);
    
    const lowerCaseName = name.toLowerCase();

    // 1. Remove corporate suffixes (comprehensive list)
    const corporateSuffixes = [
        'llc', 'inc', 'corp', 'corporation', 'company', 'co', 'ltd', 'limited',
        'enterprises', 'group', 'holdings', 'international', 'worldwide', 'global',
        'solutions', 'systems', 'technologies', 'tech', 'labs', 'laboratory',
        'stores', 'store', 'shops', 'shop', 'retail', 'mart', 'market', 'depot'
    ];
    
    for (const suffix of corporateSuffixes) {
        const patterns = [
            new RegExp(`\\s*,?\\s*${suffix}\\.?$`, 'i'),
            new RegExp(`\\s+${suffix}\\.?$`, 'i')
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(name)) {
                const withoutSuffix = name.replace(pattern, '').trim();
                if (withoutSuffix && withoutSuffix !== name) {
                    variations.add(withoutSuffix);
                }
            }
        }
    }

    // 2. Handle location-based names ("Company of Location")
    if (lowerCaseName.includes(' of ')) {
        const parts = name.split(/\s+of\s+/i);
        if (parts.length > 1) {
            variations.add(parts[0].trim());
        }
    }

    // 3. Symbol and punctuation variations
    const baseVariations = Array.from(variations);
    for (const base of baseVariations) {
        // Replace & with "and" and vice versa
        if (base.includes('&')) {
            variations.add(base.replace(/&/g, 'and'));
            variations.add(base.replace(/\s*&\s*/g, ' and '));
        }
        if (base.includes(' and ')) {
            variations.add(base.replace(/\s+and\s+/g, ' & '));
        }
        
        // Remove dots, hyphens, and other punctuation
        if (/[.\-''""]/.test(base)) {
            variations.add(base.replace(/[.\-''""/]/g, ''));
            variations.add(base.replace(/[.\-]/g, ' '));
        }
    }

    // 4. Generate acronyms for multi-word companies
    const words = name.split(/\s+/).filter(word => 
        word.length > 1 && 
        !corporateSuffixes.includes(word.toLowerCase().replace(/[.,]/g, ''))
    );
    
    if (words.length >= 2 && words.length <= 5) {
        const acronym = words.map(word => word[0]).join('').toUpperCase();
        if (acronym.length >= 2) {
            variations.add(acronym);
            // Also add with dots (e.g., "I.B.M.")
            variations.add(acronym.split('').join('.'));
        }
    }

    // 5. Handle common business name patterns
    const commonPatterns = [
        // "The Company Name" -> "Company Name"
        /^the\s+/i,
        // "Company Name Inc" -> "Company Name"
        /\s+(inc|llc|corp)\.?$/i
    ];
    
    const currentVariations = Array.from(variations);
    for (const variation of currentVariations) {
        for (const pattern of commonPatterns) {
            if (pattern.test(variation)) {
                const cleaned = variation.replace(pattern, '').trim();
                if (cleaned && cleaned !== variation) {
                    variations.add(cleaned);
                }
            }
        }
    }

    // 6. Filter out variations that are too short or common words
    const commonWords = new Set(['the', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'a', 'an', 'ross', 'gap', 'target', 'best', 'old', 'new']);
    const filteredVariations = new Set<string>();
    
    for (const variation of variations) {
        const trimmed = variation.trim();
        const isOriginalName = trimmed.toLowerCase() === name.toLowerCase();
        
        // If the variation is a common word, only allow it if it's the original name.
        if (commonWords.has(trimmed.toLowerCase())) {
            if (isOriginalName) {
                filteredVariations.add(trimmed);
            }
            continue; // Skip common words that are not the original name
        }

        // For other variations, apply the minimum length rule.
        // This prevents matching very short words like "TJX" from "TJX Companies" being filtered out if not common.
        const minLength = isOriginalName ? 2 : 4;
        if (trimmed.length >= minLength) {
            filteredVariations.add(trimmed);
        }
    }
    
    // Ensure the original name is always present, as the loop might have filtered it
    // if it was a common word but the casing was different.
    filteredVariations.add(name);

    return filteredVariations;
}

/**
 * Parses a response string to find all companies mentioned within <brand> tags.
 * It's case-insensitive and ensures each company is counted only once, 
 * returning them in the order of their first appearance.
 *
 * @param text The text content from the LLM response.
 * @param entities An array of entity objects ({ id, name }) to look for.
 * @returns An array of objects, each containing a company's ID and its position in the response.
 */
function findMentionsInBrandTags(text: string, entities: { id: string; name: string }[]): { id: string; position: number }[] {
    const mentions = new Map<string, { id: string; index: number }>();
    const brandRegex = /<brand>(.*?)<\/brand>/gi;

    // Create a map for quick, case-insensitive lookups of entity names
    const entityMap = new Map<string, string>();
    for (const entity of entities) {
        entityMap.set(entity.name.toLowerCase(), entity.id);
    }

    let match;
    while ((match = brandRegex.exec(text)) !== null) {
        const brandName = match[1].trim();
        const brandNameLower = brandName.toLowerCase();
        
        // Find the corresponding entity ID from our list
        const entityId = entityMap.get(brandNameLower);

        // If the brand is in our list and we haven't seen it before, add it
        if (entityId && !mentions.has(entityId)) {
            mentions.set(entityId, {
                id: entityId,
                index: match.index, // Store the position of the first mention
            });
        }
    }

    // Sort the found mentions by their appearance in the text and assign a position
    return Array.from(mentions.values())
        .sort((a, b) => a.index - b.index)
        .map((mention, index) => ({
            id: mention.id,
            position: index + 1,
        }));
}

/**
 * Normalizes a company name for effective deduplication.
 * This function performs several steps to create a canonical representation of a name:
 * 1. Converts the name to lowercase.
 * 2. Removes common corporate suffixes (e.g., 'llc', 'inc', 'corp').
 * 3. Removes all punctuation and symbols.
 * 4. Collapses multiple whitespace characters into a single space.
 * 5. Trims leading/trailing whitespace.
 * 
 * Example: "The Example Co., Inc." -> "the example"
 */
function normalizeNameForDeduplication(name: string): string {
    if (!name) return '';
    
    let normalized = name.toLowerCase();

    // Remove common corporate suffixes more robustly
    const suffixRegex = /\s*,?\s*\b(llc|inc|corp|corporation|ltd|company|co)\b\.?$/;
    normalized = normalized.replace(suffixRegex, '').trim();
    
    // Remove all non-alphanumeric characters (keeps spaces), like apostrophes, periods, commas, etc.
    normalized = normalized.replace(/[^a-z0-9\s]/g, '');
    
    // Collapse whitespace and trim
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
}

// Quick validation test for normalization function
// Examples: normalizeNameForDeduplication("Bloomingdale's") === normalizeNameForDeduplication("Bloomingdales")
// Both return "bloomingdales"

type PrismaTransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// Note: This function now returns the total token usage.
async function generateAndSaveSentiments(runId: string, company: { id: string; name: string; industry: string | null }, tx: PrismaTransactionClient): Promise<{ promptTokens: number, completionTokens: number, usdCost: number }> {
    const timer = new Timer();
    
    log({ 
        runId, 
        stage: 'SENTIMENT_GENERATION', 
        step: 'START',
        metadata: { companyName: company.name, industry: company.industry }
    }, 'Starting sentiment analysis generation', 'DEBUG');

    if (!company.industry) {
        log({ runId, stage: 'SENTIMENT_GENERATION', step: 'SKIP' }, 
            'Company has no industry specified - skipping sentiment analysis', 'WARN');
        
        await tx.reportRun.update({
            where: { id: runId },
            data: { stepStatus: 'Analyzing Sentiment' },
        });
        return { promptTokens: 0, completionTokens: 0, usdCost: 0 };
    }

    const sentimentModels = getModelsByTask(ModelTask.SENTIMENT);
    log({ 
        runId, 
        stage: 'SENTIMENT_GENERATION', 
        step: 'MODEL_SETUP',
        metadata: { 
            modelCount: sentimentModels.length, 
            models: sentimentModels.map(m => m.id) 
        }
    }, `Initialized ${sentimentModels.length} sentiment models`, 'DEBUG');

    // Generate sentiment scores from all models in parallel
    log({ runId, stage: 'SENTIMENT_GENERATION', step: 'API_CALLS' }, 
        'Starting parallel API calls to all sentiment models', 'TRACE');
    
    const sentimentPromises = sentimentModels.map((model, index) => {
        log({ 
            runId, 
            stage: 'SENTIMENT_GENERATION', 
            step: 'API_CALL_START',
            metadata: { modelId: model.id, modelIndex: index }
        }, `Starting API call to ${model.id}`, 'TRACE');
        
        return generateSentimentScores(company.name!, company.industry!, model);
    });

    const results = await Promise.allSettled(sentimentPromises);
    
    const apiCallDuration = timer.elapsed();
    log({ 
        runId, 
        stage: 'SENTIMENT_GENERATION', 
        step: 'API_CALLS_COMPLETE',
        duration: apiCallDuration,
        metadata: { 
            totalCalls: results.length,
            successful: results.filter(r => r.status === 'fulfilled').length,
            failed: results.filter(r => r.status === 'rejected').length
        }
    }, `Completed all sentiment API calls`, 'DEBUG');

    const allSentiments: SentimentScores[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalUsdCost = 0;

    // Process results and save to database
    timer.reset();
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const model = sentimentModels[i];

        if (result.status === 'fulfilled') {
            const { data, usage, modelUsed } = result.value;
            allSentiments.push(data);
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
            totalUsdCost += addCostFromUsage(modelUsed, usage.promptTokens, usage.completionTokens);

            log({ 
                runId, 
                stage: 'SENTIMENT_GENERATION', 
                step: 'SAVE_SUCCESS',
                tokenUsage: { 
                    prompt: usage.promptTokens, 
                    completion: usage.completionTokens, 
                    total: usage.totalTokens 
                },
                metadata: { modelId: model.id }
            }, `Successfully processed sentiment from ${model.id}`, 'TRACE');

            await tx.sentimentScore.create({
                data: {
                    runId,
                    name: 'Detailed Sentiment Scores',
                    value: data as unknown as Prisma.InputJsonValue,
                    engine: model.id,
                }
            });
        } else {
            log({ 
                runId, 
                stage: 'SENTIMENT_GENERATION', 
                step: 'MODEL_ERROR',
                error: result.reason,
                metadata: { modelId: model.id }
            }, `Failed to get sentiment from ${model.id}`, 'ERROR');
        }
    }

    const dbSaveDuration = timer.elapsed();
    log({ 
        runId, 
        stage: 'SENTIMENT_GENERATION', 
        step: 'DB_SAVE_COMPLETE',
        duration: dbSaveDuration,
        tokenUsage: { 
            prompt: totalPromptTokens, 
            completion: totalCompletionTokens, 
            total: totalPromptTokens + totalCompletionTokens 
        },
        metadata: { sentimentCount: allSentiments.length }
    }, `Saved ${allSentiments.length} sentiment results to database`, 'DEBUG');

    await tx.reportRun.update({
        where: { id: runId },
        data: { stepStatus: `Analyzing Sentiment (${allSentiments.length}/${sentimentModels.length})` },
    });

    // Generate overall sentiment summary if we have data
    if (allSentiments.length > 0) {
        timer.reset();
        try {
            log({ runId, stage: 'SENTIMENT_GENERATION', step: 'SUMMARY_START' }, 
                'Generating overall sentiment summary', 'DEBUG');
            
            const { data: summarySentiment, usage, modelUsed } = await generateOverallSentimentSummary(company.name, allSentiments);
            
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
            totalUsdCost += addCostFromUsage(modelUsed, usage.promptTokens, usage.completionTokens);

            const summaryDuration = timer.elapsed();
            log({ 
                runId, 
                stage: 'SENTIMENT_GENERATION', 
                step: 'SUMMARY_SUCCESS',
                duration: summaryDuration,
                tokenUsage: { 
                    prompt: usage.promptTokens, 
                    completion: usage.completionTokens, 
                    total: usage.totalTokens 
                }
            }, 'Successfully generated sentiment summary', 'TRACE');

            await tx.sentimentScore.create({
                data: {
                    runId,
                    name: 'Detailed Sentiment Scores',
                    value: summarySentiment as unknown as Prisma.InputJsonValue,
                    engine: 'serplexity-summary',
                }
            });
        } catch (error) {
            log({ 
                runId, 
                stage: 'SENTIMENT_GENERATION', 
                step: 'SUMMARY_ERROR',
                error,
                duration: timer.elapsed()
            }, 'Failed to generate overall sentiment summary', 'ERROR');
        }
    } else {
        log({ runId, stage: 'SENTIMENT_GENERATION', step: 'SUMMARY_SKIP' }, 
            'No successful sentiment models - skipping summary generation', 'WARN');
    }

    const totalDuration = timer.elapsed() + apiCallDuration + dbSaveDuration;
    log({ 
        runId, 
        stage: 'SENTIMENT_GENERATION', 
        step: 'COMPLETE',
        duration: totalDuration,
        tokenUsage: { 
            prompt: totalPromptTokens, 
            completion: totalCompletionTokens, 
            total: totalPromptTokens + totalCompletionTokens 
        },
        metadata: { 
            successfulModels: allSentiments.length,
            totalModels: sentimentModels.length
        }
    }, 'Sentiment generation phase completed');

    return { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens, usdCost: totalUsdCost };
}

// Note: The calculateAndStoreDashboardData function has been removed
// Dashboard data is now calculated dynamically in the API controller using raw database queries
// This provides better flexibility for filtering and real-time data access

// Enhanced progress tracking with more realistic time distribution
const PROGRESS = {
  // Initial setup phase
  SETUP_START: 0,
  SETUP_END: 5,
  
  // Question preparation
  QUESTIONS_START: 5,
  QUESTIONS_END: 15,
  
  // LLM processing phase (main work)
  FANOUT_START: 15,
  FANOUT_END: 55,
  
  // Competitor analysis (previously hidden)
  COMPETITOR_ANALYSIS_START: 55,
  COMPETITOR_ANALYSIS_END: 65,
  
  // Database streaming writes
  STREAM_START: 65,
  STREAM_END: 82,
  
  // Metrics calculation
  METRICS_START: 82,
  METRICS_END: 87,
  
  // Post-completion optimization tasks (first reports)
  OPTIMIZATION_START: 87,
  OPTIMIZATION_END: 97,
  
  // Final completion
  FINAL_START: 97,
  FINAL_END: 100,
} as const;

// Time-based progress estimation weights for different phases
const PHASE_TIME_WEIGHTS = {
  SETUP: 0.05,           // 5% of total time
  QUESTIONS: 0.08,       // 8% of total time  
  FANOUT: 0.40,          // 40% of total time (main LLM work)
  COMPETITOR: 0.10,      // 10% of total time
  STREAMING: 0.17,       // 17% of total time (database writes)
  METRICS: 0.05,         // 5% of total time
  OPTIMIZATION: 0.10,    // 10% of total time (for first reports)
  FINAL: 0.05,           // 5% of total time
} as const;

function mapProgress(localPct: number, start: number, end: number): number {
  if (localPct < 0) localPct = 0;
  if (localPct > 100) localPct = 100;
  return Math.round(start + (end - start) * (localPct / 100));
}

// Enhanced progress update function with time estimation
async function updateProgress(
  prisma: any,
  runId: string,
  phase: string,
  localProgress: number,
  phaseStart: number,
  phaseEnd: number,
  statusMessage?: string,
  forceUpdate: boolean = false
): Promise<void> {
  const globalProgress = mapProgress(localProgress, phaseStart, phaseEnd);
  const defaultMessage = `${phase} (${globalProgress}%)`;
  const message = statusMessage || defaultMessage;
  
  // Update more frequently during critical phases, less during long-running phases
  const shouldUpdate = forceUpdate || 
    globalProgress % (phase.includes('OPTIMIZATION') ? 1 : 2) === 0 || 
    localProgress === 100;
    
  if (shouldUpdate) {
    await prisma.reportRun.update({
      where: { id: runId },
      data: { stepStatus: message },
    });
  }
}

const processJob = async (job: Job) => {
const prisma = await getDbClient();
const jobTimer = new Timer();
    const { runId, company, force } = job.data;
    
    log({ 
        runId, 
        stage: 'JOB_START', 
        step: 'INITIALIZATION',
        metadata: { 
            jobId: job.id, 
            companyId: company.id, 
            companyName: company.name,
            forceMode: force 
        }
    }, `Job ${job.id} started - Report generation for company '${company.name}'`);
    
    // --- Stage 0: Setup ---
    const setupTimer = new Timer();
    log({ runId, stage: 'SETUP', step: 'START' }, 'Initializing and fetching full company data', 'DEBUG');
    
    // Ensure reportRun exists before trying to update it
    const existingReportRun = await prisma.reportRun.findUnique({ where: { id: runId } });
    if (!existingReportRun) {
        log({ runId, stage: 'SETUP', step: 'CREATE_REPORT_RUN' }, 'ReportRun not found, creating it', 'DEBUG');
        await prisma.reportRun.create({
            data: {
                id: runId,
                companyId: company.id,
                status: 'RUNNING',
                stepStatus: 'Creating Report',
                tokensUsed: 0,
            }
        });
    } else {
        await prisma.reportRun.update({ 
            where: { id: runId }, 
            data: { status: 'RUNNING', stepStatus: 'Creating Report' }
        });
    }
    
    // Initial progress update
    await updateProgress(prisma, runId, 'Setting up report generation', 0, PROGRESS.SETUP_START, PROGRESS.SETUP_END, undefined, true);
    
    let fullCompany = await prisma.company.findUnique({ 
        where: { id: company.id },
        include: { 
            competitors: true, 
            benchmarkingQuestions: true,
        }
    });

    if (!fullCompany) {
        log({ 
            runId, 
            stage: 'SETUP', 
            step: 'ERROR',
            error: new Error(`Company with id ${company.id} not found`),
            metadata: { companyId: company.id }
        }, 'Critical error: Company not found', 'ERROR');
        throw new Error(`Could not find company with id ${company.id}`);
    }
    
    const setupDuration = setupTimer.elapsed();
    log({ 
        runId, 
        stage: 'SETUP', 
        step: 'COMPLETE',
        duration: setupDuration,
        metadata: { 
            companyName: fullCompany.name,
            competitorsCount: fullCompany.competitors.length,
            benchmarkQuestionsCount: fullCompany.benchmarkingQuestions.length
        }
    }, `Company data loaded: ${fullCompany.competitors.length} competitors, ${fullCompany.benchmarkingQuestions.length} benchmark questions`);

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalUsdCost = 0;
    let optimizationCost = 0;

    // --- Stage 1: Data Gathering (Network-Intensive) ---
    const dataGatheringTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'START' }, 'STARTING DATA GATHERING PHASE - Identifying questions, competitors, and responses', 'STAGE');
    // All LLM calls are done here, before any major DB transactions.

    // --- Skip AI competitor generation - competitors will be discovered from responses ---
    log({ runId, stage: 'DATA_GATHERING', step: 'COMPETITORS_SKIP' }, 'Skipping AI competitor generation - will discover competitors from responses');

    // --- Stage 1.2: Generate Fanout Questions ---
    const fanoutGenTimer = new Timer();
    await updateProgress(prisma, runId, 'Preparing Questions', 0, PROGRESS.QUESTIONS_START, PROGRESS.QUESTIONS_END, 'Expanding "Fan-Out" Questions', true);
    log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_GENERATION_START' }, 'STARTING FANOUT GENERATION');
    
    const userBenchmarkQuestions = fullCompany.benchmarkingQuestions || [];

    if (userBenchmarkQuestions.length === 0) {
        log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_QUESTIONS_SKIP' }, 'No user benchmarking questions found, skipping fanout generation.');
    } else {
            log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_QUESTIONS_FOUND', metadata: { count: userBenchmarkQuestions.length } }, `Found ${userBenchmarkQuestions.length} user benchmarking questions for fanout generation`);
            
            const shouldGenerateFanout = async (baseQuestionId: string, companyId: string): Promise<{ generate: boolean, needed: number }> => {
                const existingFanoutQuestions = await prisma.fanoutQuestion.count({
                    where: {
                        baseQuestionId: baseQuestionId,
                        companyId: companyId,
                    },
                });
        
                if (existingFanoutQuestions >= LLM_CONFIG.FANOUT_GENERATION_THRESHOLD) {
                    return { generate: false, needed: 0 };
                }
        
                const needed = Math.max(0, LLM_CONFIG.FANOUT_TOTAL_TARGET - existingFanoutQuestions);
                return { generate: true, needed };
            };

            // Display labels and descriptions (migrated from legacy fanoutService)
            const FANOUT_DISPLAY_LABELS = {
                'paraphrase': 'Paraphrase',
                'comparison': 'Comparison',
                'temporal': 'Time-based',
                'topical': 'Related Topics',
                'entity_broader': 'Broader Category',
                'entity_narrower': 'Specific Focus',
                'session_context': 'Context',
                'user_profile': 'Personalized',
                'vertical': 'Media Search',
                'safety_probe': 'Safety Check'
            } as const;

            const FANOUT_DESCRIPTIONS = {
                'paraphrase': 'Rewording of the original question',
                'comparison': 'Direct comparisons between options',
                'temporal': 'Time-specific or trending questions',
                'topical': 'Related subject areas',
                'entity_broader': 'Broader category questions',
                'entity_narrower': 'More specific focused questions',
                'session_context': 'Contextual follow-up questions',
                'user_profile': 'Questions tailored to user preferences',
                'vertical': 'Questions seeking images, videos, or documents',
                'safety_probe': 'Questions checking for policy compliance'
            } as const;
            
            // Import PydanticAI service for modern LLM operations
            const { pydanticLlmService } = await import('../services/pydanticLlmService');
            const { z } = await import('zod');

            // Get models for fanout generation 
            const models = getModelsByTask(ModelTask.QUESTION_ANSWERING);

            // Generate fanout for each benchmarking question that needs it
            const fanoutGenerationPromises = userBenchmarkQuestions.map(async (question, index) => {
                try {
                    log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_GENERATION_CHECK_QUESTION', metadata: { questionId: question.id, questionText: question.text, questionIndex: index + 1, totalQuestions: userBenchmarkQuestions.length } }, `Checking fanout variations for question: "${question.text}"`);

                    const { generate, needed } = await shouldGenerateFanout(question.id, fullCompany.id);

                    if (!generate) {
                        log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_GENERATION_SKIP_QUESTION', metadata: { questionId: question.id } }, `Skipping fanout generation for "${question.text}" - existing questions meet threshold.`);
                        return { questionId: question.id, success: true, queriesGenerated: 0, skipped: true };
                    }

                    log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_GENERATION_START_QUESTION', metadata: { questionId: question.id, needed } }, `Generating ${needed} new fanout variations for question: "${question.text}"`);

                    const modelForFanout = models[0];

                    log({ runId, stage: 'DATA_GATHERING', step: 'PYDANTIC_FANOUT_CALL', metadata: { questionId: question.id, modelId: modelForFanout.id } }, `Using PydanticAI fanout agent for question: "${question.text}"`);
                    
                    const fanoutAgentInput = {
                        company_name: fullCompany.name,
                        industry: fullCompany.industry || 'Technology',
                        base_question: question.text,
                        context: `Generate strategic fanout queries for ${fullCompany.name} analysis`,
                        competitors: [] 
                    };

                    const pydanticResult = await pydanticLlmService.executeAgent(
                        'fanout_agent.py',
                        fanoutAgentInput,
                        null, 
                        {
                            temperature: 0.8,
                            maxTokens: 2000,
                            timeout: 45000
                        }
                    );

                    const fanoutResponse = pydanticResult.data as any; 
                    
                    if (!fanoutResponse) {
                        throw new Error('PydanticAI returned empty response data');
                    }
                    const fanoutData = {
                        baseQuery: question.text,
                        modelGenerations: [{ 
                            modelId: modelForFanout.id,
                            modelEngine: modelForFanout.engine,
                            fanoutQueries: {
                                paraphrase: fanoutResponse.queries?.filter((q: any) => q && q.type === 'paraphrase' && q.query).map((q: any) => q.query) || [],
                                comparison: fanoutResponse.queries?.filter((q: any) => q && q.type === 'comparison' && q.query).map((q: any) => q.query) || [],
                                temporal: fanoutResponse.queries?.filter((q: any) => q && q.type === 'temporal' && q.query).map((q: any) => q.query) || [],
                                topical: fanoutResponse.queries?.filter((q: any) => q && q.type === 'topical' && q.query).map((q: any) => q.query) || [],
                                entity_broader: fanoutResponse.queries?.filter((q: any) => q && q.type === 'entity_broader' && q.query).map((q: any) => q.query) || [],
                                entity_narrower: fanoutResponse.queries?.filter((q: any) => q && q.type === 'entity_narrower' && q.query).map((q: any) => q.query) || [],
                                session_context: fanoutResponse.queries?.filter((q: any) => q && q.type === 'session_context' && q.query).map((q: any) => q.query) || [],
                                user_profile: fanoutResponse.queries?.filter((q: any) => q && q.type === 'user_profile' && q.query).map((q: any) => q.query) || [],
                                vertical: fanoutResponse.queries?.filter((q: any) => q && q.type === 'vertical' && q.query).map((q: any) => q.query) || [],
                                safety_probe: fanoutResponse.queries?.filter((q: any) => q && q.type === 'safety_probe' && q.query).map((q: any) => q.query) || [],
                            },
                            tokenUsage: {
                                promptTokens: Math.floor((pydanticResult.metadata?.tokensUsed || 0) * 0.7),
                                completionTokens: Math.floor((pydanticResult.metadata?.tokensUsed || 0) * 0.3),
                                totalTokens: pydanticResult.metadata?.tokensUsed || 0
                            }
                        }],
                        totalTokenUsage: {
                            promptTokens: Math.floor((pydanticResult.metadata?.tokensUsed || 0) * 0.7),
                            completionTokens: Math.floor((pydanticResult.metadata?.tokensUsed || 0) * 0.3),
                            totalTokens: pydanticResult.metadata?.tokensUsed || 0
                        },
                        generatedAt: new Date()
                    };
                    
                    totalPromptTokens += fanoutData.totalTokenUsage.promptTokens;
                    totalCompletionTokens += fanoutData.totalTokenUsage.completionTokens;
                    totalUsdCost += addCostFromUsage(pydanticResult.metadata.modelUsed, fanoutData.totalTokenUsage.promptTokens, fanoutData.totalTokenUsage.completionTokens);

                    const flattenedQueries: Array<{
                        id: string;
                        text: string;
                        type: string;
                        sourceModel: string;
                        displayLabel: string;
                        description: string;
                    }> = [];

                    let queryId = 1;
                    
                    fanoutData.modelGenerations.forEach(generation => {
                        (Object.keys(generation.fanoutQueries) as Array<keyof typeof generation.fanoutQueries>).forEach(type => {
                            generation.fanoutQueries[type].forEach((queryText: string) => {
                                if (queryText) { 
                                    flattenedQueries.push({
                                        id: `fanout_${queryId++}`,
                                        text: queryText,
                                        type,
                                        sourceModel: generation.modelId,
                                        displayLabel: FANOUT_DISPLAY_LABELS[type as keyof typeof FANOUT_DISPLAY_LABELS] || 'General',
                                        description: FANOUT_DESCRIPTIONS[type as keyof typeof FANOUT_DESCRIPTIONS] || 'A generated question variation.'
                                    });
                                }
                            });
                        });
                    });
                    
                    const newQueriesToSave = flattenedQueries.slice(0, needed);
                    
                    if (newQueriesToSave.length > 0) {
                        await prisma.fanoutQuestion.createMany({
                            data: newQueriesToSave.map(query => ({
                                baseQuestionId: question.id,
                                text: query.text,
                                type: query.type,
                                sourceModel: modelForFanout.id, 
                                companyId: fullCompany.id
                            })),
                            skipDuplicates: true
                        });

                        log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_QUESTIONS_SAVED', metadata: { questionId: question.id, generatedCount: newQueriesToSave.length, tokenUsage: fanoutData.totalTokenUsage } }, `Saved ${newQueriesToSave.length} new fanout questions for "${question.text}"`);
                    }

                    const currentFanoutData = await prisma.reportRun.findUnique({
                        where: { id: runId },
                        select: { fanoutData: true }
                    });

                    const existingFanoutData = currentFanoutData?.fanoutData as any || {};
                    existingFanoutData[question.id] = fanoutData;

                    await prisma.reportRun.update({
                        where: { id: runId },
                        data: { fanoutData: existingFanoutData }
                    });

                    return { questionId: question.id, success: true, queriesGenerated: newQueriesToSave.length, skipped: false };
                } catch (error) {
                    log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_GENERATION_ERROR', error, metadata: { questionId: question.id, questionText: question.text } }, `Failed to generate fanout for question: "${question.text}"`, 'ERROR');
                    return { questionId: question.id, success: false, error, skipped: false };
                }
            });

            const fanoutResults = await Promise.all(fanoutGenerationPromises);
            const successfulGenerations = fanoutResults.filter(r => r.success);
            const skippedGenerations = fanoutResults.filter(r => r.success && r.skipped);
            const totalFanoutQueries = successfulGenerations.reduce((sum, r) => sum + (r.queriesGenerated || 0), 0);

            log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_GENERATION_COMPLETE', duration: fanoutGenTimer.elapsed(), metadata: { successfulQuestions: successfulGenerations.length, skippedQuestions: skippedGenerations.length, totalQuestions: userBenchmarkQuestions.length, totalFanoutQueries } }, `Generated ${totalFanoutQueries} new fanout questions from ${successfulGenerations.length}/${userBenchmarkQuestions.length} benchmarking questions (${skippedGenerations.length} skipped - already complete)`);
    }

    // 1.2: Generate Sentiment Scores
    const sentimentTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'SENTIMENT_START' }, 'Generating sentiment scores');
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Analyzing Sentiment' } });
    
    const sentimentModels = getModelsByTask(ModelTask.SENTIMENT);
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'SENTIMENT_MODELS_LOADED',
        metadata: { 
            modelCount: sentimentModels.length,
            models: sentimentModels.map(m => m.id)
        }
    }, `Loaded ${sentimentModels.length} sentiment models`, 'DEBUG');
    
    const sentimentPromises = sentimentModels.map(model => 
        limit(() => generateSentimentScores(fullCompany.name!, fullCompany.industry!, model))
    );
    const sentimentResults = await Promise.allSettled(sentimentPromises);
    
    // Generate sentiment summary immediately after getting individual results
    const allSentiments: SentimentScores[] = [];
    for (let i = 0; i < sentimentResults.length; i++) {
        const result = sentimentResults[i];
        if (result.status === 'fulfilled') {
            const { data, usage, modelUsed } = result.value;
            allSentiments.push(data);
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
            totalUsdCost += addCostFromUsage(modelUsed, usage.promptTokens, usage.completionTokens);
        }
    }
    
    let sentimentSummary: ChatCompletionResponse<SentimentScores> | null = null;
    if (allSentiments.length > 0) {
        try {
            sentimentSummary = await generateOverallSentimentSummary(fullCompany.name, allSentiments);
            totalPromptTokens += sentimentSummary?.usage?.promptTokens || 0;
            totalCompletionTokens += sentimentSummary?.usage?.completionTokens || 0;
            totalUsdCost += addCostFromUsage(sentimentSummary?.modelUsed, sentimentSummary?.usage?.promptTokens || 0, sentimentSummary?.usage?.completionTokens || 0);
            log({ runId, stage: 'DATA_GATHERING', step: 'SENTIMENT_SUMMARY_GENERATED' }, 'Generated sentiment summary during data gathering');
        } catch (error) {
            log({ runId, stage: 'DATA_GATHERING', step: 'SENTIMENT_SUMMARY_ERROR', error }, 'Failed to generate sentiment summary during data gathering', 'ERROR');
        }
    }
    
    const sentimentDuration = sentimentTimer.elapsed();
    const successfulSentiments = sentimentResults.filter(r => r.status === 'fulfilled').length;
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'SENTIMENT_COMPLETE',
        duration: sentimentDuration,
        metadata: { 
            successfulModels: successfulSentiments,
            totalModels: sentimentModels.length,
            failedModels: sentimentModels.length - successfulSentiments,
            hasSummary: !!sentimentSummary
        }
    }, `Sentiment score generation completed: ${successfulSentiments}/${sentimentModels.length} models succeeded`);
    
    // 1.3: Generate Fanout Responses  
    const responseGenerationTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'RESPONSE_GENERATION_START' }, 'Generating responses for fanout questions');
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: `Analyzing Visibility Questions (${PROGRESS.FANOUT_START}%)` } });
    
    // Get all fanout questions generated for this company
    const fanoutQuestions = await prisma.fanoutQuestion.findMany({
        where: { companyId: fullCompany.id },
        include: { baseQuestion: true }
    });
    
    // Also include the original user benchmarking questions
    const allQuestions: Question[] = [
        ...fullCompany.benchmarkingQuestions.map(q => ({ id: q.id, text: q.text, type: 'benchmark' as const })),
        ...fanoutQuestions.map(q => ({ id: q.id, text: q.text, type: 'fanout' as const, fanoutType: q.type, sourceModel: q.sourceModel }))
    ];
    
    const totalQuestionsToProcess = allQuestions.length;
    let questionsProcessed = 0;
    
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'QUESTIONS_COLLECTED', 
        metadata: {
            totalQuestions: totalQuestionsToProcess,
            benchmarkCount: fullCompany.benchmarkingQuestions.length,
            fanoutCount: fanoutQuestions.length,
            fanoutByType: fanoutQuestions.reduce((acc, q) => {
                acc[q.type] = (acc[q.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        }
    }, `Collected a total of ${totalQuestionsToProcess} questions to be answered (${fullCompany.benchmarkingQuestions.length} original + ${fanoutQuestions.length} fanout).`);

    const models = getModelsByTask(ModelTask.QUESTION_ANSWERING);

    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'MODELS_LOADED',
        metadata: { 
            modelCount: models.length,
            models: models.map(m => m.id)
        }
    }, `Loaded ${models.length} models for question answering`, 'DEBUG');

    // Create a specialized concurrency limiter for question processing
    const questionLimit = pLimit(LLM_CONFIG.QUESTION_ANSWERING_CONCURRENCY);

    // Create individual question-model combinations for parallel processing
    const questionModelCombinations = allQuestions.flatMap(question => {
        if (question.type === 'fanout') {
            // Fanout questions should only be answered by the model that generated them
            const availableModels = models.filter(model => model.id === question.sourceModel);
            if (availableModels.length === 0) {
                log({ runId, stage: 'DATA_GATHERING', step: 'FANOUT_MODEL_UNAVAILABLE', metadata: { questionId: question.id, sourceModel: question.sourceModel, availableModels: models.map(m => m.id) } }, `Skipping fanout question ${question.id} - source model ${question.sourceModel} not available`, 'WARN');
                return [];
            }
            return availableModels.map(model => ({ question, model }));
        } else {
            // Benchmark questions are answered by all models
            return models.map(model => ({ question, model }));
        }
    });

    // Calculate expected combinations for new fanout system
    const benchmarkQuestionCount = fullCompany.benchmarkingQuestions.length;
    const fanoutQuestionCount = fanoutQuestions.length;
    const expectedBenchmarkCombinations = benchmarkQuestionCount * models.length;
    const expectedFanoutCombinations = fanoutQuestionCount; // 1:1 with source model
    const expectedTotal = expectedBenchmarkCombinations + expectedFanoutCombinations;

    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'PARALLEL_SETUP',
        metadata: { 
            actualCombinations: questionModelCombinations.length,
            expectedCombinations: expectedTotal,
            benchmarkCombinations: expectedBenchmarkCombinations,
            fanoutCombinations: expectedFanoutCombinations,
            questionsCount: allQuestions.length,
            modelsCount: models.length,
            concurrency: LLM_CONFIG.QUESTION_ANSWERING_CONCURRENCY
        }
    }, `Prepared ${questionModelCombinations.length} question-model combinations (${expectedBenchmarkCombinations} benchmark + ${questionModelCombinations.length - expectedBenchmarkCombinations} fanout) for streaming parallel processing`);

    // Track completed responses for progress calculation
    let completedResponses = 0;

    // Initialize competitor enrichment pipeline (runs in background, no progress display)
    const competitorPipeline = new CompetitorEnrichmentPipeline(
        runId,
        fullCompany.id,
        fullCompany,
        async (processed: number, total: number) => {
            // Competitor enrichment runs in background - no progress updates to avoid UI clutter
            // Progress is implicitly covered by the extended FANOUT phase (0-55%)
        }
    );

    // Process all question-model combinations in parallel with streaming brand extraction
    const questionProcessingPromises = questionModelCombinations.map(async ({ question, model }) => {
        const questionInput: QuestionInput = { 
            id: question.id, 
            text: question.text,
            systemPrompt: undefined // NOTE: Brand tagging now handled by PydanticAI agents
        };
        const startTime = Date.now();
        
        try {
            const { data: answer, usage, modelUsed } = await questionLimit(() => generateQuestionResponse(questionInput, model));
            
            // Handle case where answer is undefined or empty
            if (!answer) {
                throw new Error(`Question agent returned empty answer for question ${question.id}`);
            }
            
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
            totalUsdCost += addCostFromUsage(modelUsed, usage.promptTokens, usage.completionTokens);

            // Extract brands from answer and stream to pipeline immediately
            const brandRegex = /<brand>(.*?)<\/brand>/gi;
            let match;
            while ((match = brandRegex.exec(answer)) !== null) {
                const brandName = match[1].trim();
                if (brandName) {
                    // Stream brand to pipeline for immediate processing
                    await competitorPipeline.addBrand(brandName);
                }
            }

            // Defer saving of all responses; StreamingDatabaseWriter will persist them in bulk to avoid duplicates
            log({ 
                runId, 
                stage: 'DATA_GATHERING', 
                step: 'RESPONSE_SAVE_DEFERRED', 
                metadata: { questionId: question.id, modelId: model.id, questionType: question.type } 
            }, `Deferred save for ${question.type} question ${question.id}`, 'DEBUG');

            // Create response data structure for processing
            const responseData = {
                questionId: question.id,
                questionType: question.type,
                fanoutType: question.fanoutType,
                sourceModel: question.sourceModel,
                answer,
                modelId: model.id,
            };

            // Update progress tracking
            completedResponses++;
            const localFanoutPct = Math.round((completedResponses / questionModelCombinations.length) * 100);
            
            // Use new enhanced progress tracking
            await updateProgress(
                prisma, 
                runId, 
                'Analyzing Visibility Questions', 
                localFanoutPct, 
                PROGRESS.FANOUT_START, 
                PROGRESS.FANOUT_END
            );

            const duration = Date.now() - startTime;
            log({
                runId,
                stage: 'DATA_GATHERING',
                step: 'FANOUT_RESPONSE_SAVED',
                duration,
                progress: mapProgress(localFanoutPct, PROGRESS.FANOUT_START, PROGRESS.FANOUT_END),
                tokenUsage: { prompt: usage.promptTokens, completion: usage.completionTokens, total: usage.totalTokens },
                metadata: {
                    questionId: question.id,
                    modelId: model.id,
                    questionType: question.type,
                    fanoutType: question.fanoutType,
                    sourceModel: question.sourceModel,
                    success: true,
                    answerLength: answer.length,
                    completedCombinations: completedResponses,
                    totalExpected: questionModelCombinations.length
                },
            }, `Successfully processed fanout response ${question.id} with ${model.id} (${mapProgress(localFanoutPct, PROGRESS.FANOUT_START, PROGRESS.FANOUT_END)}% complete)`);

            return { response: responseData, success: true };
        } catch (error) {
            const duration = Date.now() - startTime;
            log({
                runId,
                stage: 'DATA_GATHERING',
                step: 'FANOUT_RESPONSE_ERROR',
                duration,
                error,
                metadata: {
                    questionId: question.id,
                    modelId: model.id,
                    questionType: question.type,
                    success: false
                },
            }, `Failed to process fanout response ${question.id} with ${model.id}`, 'ERROR');
            
            return { response: null, success: false };
        }
    });

    // Process all combinations with streaming database writes
    const allResults = await Promise.allSettled(questionProcessingPromises);
    
    // --- Step 2.1: Finalize competitor enrichment pipeline ---
    await updateProgress(prisma, runId, 'Analyzing Competitors', 0, PROGRESS.COMPETITOR_ANALYSIS_START, PROGRESS.COMPETITOR_ANALYSIS_END, undefined, true);
    
    const collectedResponses = allResults
        .filter((result): result is PromiseFulfilledResult<{ response: any; success: true; }> => 
            result.status === 'fulfilled' && result.value.success && !!result.value.response)
        .map(result => result.value.response);

    // Finalize the competitor enrichment pipeline
    const pipelineResults = await competitorPipeline.finalize();
    
    totalPromptTokens += pipelineResults.totalPromptTokens;
    totalCompletionTokens += pipelineResults.totalCompletionTokens;
    totalUsdCost += pipelineResults.totalUsdCost;
    
    log({
        runId,
        stage: 'BRAND_DISCOVERY',
        step: 'PIPELINE_COMPLETE',
        metadata: {
            enrichedCount: pipelineResults.enrichedCompetitors.length,
            sample: pipelineResults.enrichedCompetitors.slice(0, 10).map(c => ({ name: c.name, website: c.website }))
        }
    }, `Pipeline completed: ${pipelineResults.enrichedCompetitors.length} competitors enriched`);

    // --- Step 2.2: Save enriched competitors to database ---
    if (pipelineResults.enrichedCompetitors.length > 0) {
        // Competitor saving happens in background, no status update needed
        
        try {
            const standardizeWebsite = (website: string | null | undefined): string => {
                if (!website) return '';
                return website.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
            };

            // Deduplicate enriched competitors
            const uniqueNewCompetitorsMap = new Map<string, CompetitorInfo>();
            for (const competitor of pipelineResults.enrichedCompetitors) {
                const standardizedWebsite = standardizeWebsite(competitor.website);
                if (standardizedWebsite && !uniqueNewCompetitorsMap.has(standardizedWebsite)) {
                    uniqueNewCompetitorsMap.set(standardizedWebsite, {
                        ...competitor,
                        website: standardizedWebsite,
                    });
                }
            }

            // Filter out existing competitors
            const existingCompetitorNames = new Set(fullCompany.competitors.map(c => normalizeNameForDeduplication(c.name)));
            const existingCompetitorWebsites = new Set(fullCompany.competitors.map(c => standardizeWebsite(c.website)));
            existingCompetitorNames.add(normalizeNameForDeduplication(fullCompany.name));
            existingCompetitorWebsites.add(standardizeWebsite(fullCompany.website));

            const newCompetitorsToSave = Array.from(uniqueNewCompetitorsMap.values()).filter(
                (newComp: CompetitorInfo) => {
                    const normalizedNewName = normalizeNameForDeduplication(newComp.name);
                    const websiteExists = existingCompetitorWebsites.has(newComp.website);
                    const nameExists = existingCompetitorNames.has(normalizedNewName);
                    return !(websiteExists || nameExists);
                }
            );

            if (newCompetitorsToSave.length > 0) {
                await prisma.competitor.createMany({
                    data: newCompetitorsToSave.map((c: CompetitorInfo) => ({
                        name: c.name,
                        website: c.website,
                        companyId: fullCompany.id,
                        isGenerated: true,
                    })),
                    skipDuplicates: true,
                });
                
                log({
                    runId,
                    stage: 'BRAND_DISCOVERY',
                    step: 'COMPETITORS_SAVED',
                    metadata: {
                        savedCount: newCompetitorsToSave.length,
                        totalEnriched: pipelineResults.enrichedCompetitors.length,
                        duplicatesFiltered: pipelineResults.enrichedCompetitors.length - newCompetitorsToSave.length
                    }
                }, `Saved ${newCompetitorsToSave.length} new competitors to database`);
            }
        } catch (error) {
            log({ runId, stage: 'BRAND_DISCOVERY', step: 'COMPETITOR_SAVE_ERROR', error }, 'Failed to save enriched competitors', 'ERROR');
        }
    }

    // --- Step 2.4: Use optimized StreamingDatabaseWriter for batch operations ---
    await updateProgress(prisma, runId, 'Streaming to Database', 0, PROGRESS.STREAM_START, PROGRESS.STREAM_END, undefined, true);
    
    log({ runId, stage: 'DATABASE_WRITE', step: 'BATCH_WRITE_START' }, `Starting optimized batch-write for ${collectedResponses.length} responses.`);
    
    // REFETCH company data to include all competitors for the final write
    const finalCompanyData = await prisma.company.findUnique({
        where: { id: company.id },
        include: { competitors: true }
    });
    if (!finalCompanyData) throw new Error("Could not refetch company data after competitor enrichment.");
    
    const allKnownEntities = [
        { id: finalCompanyData.id, name: finalCompanyData.name, isUserCompany: true },
        ...finalCompanyData.competitors.map(c => ({ id: c.id, name: c.name, isUserCompany: false }))
    ];
    const entityMap = new Map(allKnownEntities.map(e => [e.name.toLowerCase(), e]));

    // initial write phase already set to 55 %

    // Initialize StreamingDatabaseWriter with proper configuration
    const streamWriter = new StreamingDatabaseWriter(
        prisma,
        runId,
        finalCompanyData.id,
        allKnownEntities,
        {
            maxBatchSize: 50,
            flushIntervalMs: 1000,
            maxConcurrentWrites: 3,
            useParallelMentionWrites: true
        }
    );

    // Convert responses to StreamingDatabaseWriter format and stream them with progress tracking
    let processedStreamingResponses = 0;
    for (const response of collectedResponses) {
        // Create properly formatted StreamedResponse
        const streamedResponse = {
            questionId: response.questionId,
            answer: response.answer,
            modelId: response.modelId,
            engine: response.modelId, // engine = modelId for consistency
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, // Token usage already tracked
            questionType: response.questionType as 'visibility' | 'benchmark' | 'personal'
        };

        // Stream the response (mentions will be automatically detected by StreamingDatabaseWriter)
        await streamWriter.streamResponse(streamedResponse);
        
        processedStreamingResponses++;
        const localStreamPct = Math.round((processedStreamingResponses / collectedResponses.length) * 100);
        
        // Use enhanced progress tracking for streaming
        await updateProgress(
            prisma, 
            runId, 
            'Streaming to Database', 
            localStreamPct, 
            PROGRESS.STREAM_START, 
            PROGRESS.STREAM_END
        );
    }

    // Move to metrics calculation phase
    await updateProgress(prisma, runId, 'Calculating Metrics', 0, PROGRESS.METRICS_START, PROGRESS.METRICS_END, undefined, true);
    
    const writeStats = await streamWriter.finalize();
    log({ 
        runId, 
        stage: 'DATABASE_WRITE', 
        step: 'BATCH_WRITE_COMPLETE',
        metadata: { 
            responsesWritten: writeStats.responsesWritten,
            mentionsWritten: writeStats.mentionsWritten,
            batchesProcessed: writeStats.batchesProcessed,
            avgBatchTime: writeStats.avgBatchTime
        }
    }, `Optimized batch-write completed: ${writeStats.responsesWritten} responses, ${writeStats.mentionsWritten} mentions in ${writeStats.batchesProcessed} batches`);

    // Collect successful responses for final statistics
    let successfulResponses = 0;
    let failedResponses = 0;
    
    for (const result of allResults) {
        if (result.status === 'fulfilled' && result.value.success && result.value.response) {
            successfulResponses++;
        } else {
            failedResponses++;
        }
    }

    // Update progress to end of fanout phase after all processing is complete
    questionsProcessed = allQuestions.length;
    const fanoutCompleteProgress = PROGRESS.FANOUT_END;
    
    log({
        runId,
        stage: 'DATA_GATHERING',
        step: 'PARALLEL_PROCESSING_COMPLETE',
        progress: fanoutCompleteProgress,
        metadata: {
            totalCombinations: questionModelCombinations.length,
            successfulResponses,
            failedResponses,
            successRate: Math.round((successfulResponses / questionModelCombinations.length) * 100),
            questionsProcessed: allQuestions.length,
            modelsUsed: models.length
        },
    }, `Parallel processing complete: ${successfulResponses}/${questionModelCombinations.length} successful responses (${Math.round((successfulResponses / questionModelCombinations.length) * 100)}% success rate)`);
    
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: `Analyzing Visibility Questions (${fanoutCompleteProgress}%)` } });
    
    log({ runId, stage: 'DATA_GATHERING', step: 'ANALYSIS_COMPLETE' }, 'Finished answering all questions.');

    const dataGatheringDuration = dataGatheringTimer.elapsed();
    
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'RESPONSE_GENERATION_COMPLETE',
        duration: responseGenerationTimer.elapsed(),
        metadata: { 
            successfulResponses: successfulResponses,
            totalExpectedResponses: allQuestions.length,
            questionsProcessed: allQuestions.length,
            modelsUsed: models.length
        }
    }, `Response generation completed: ${successfulResponses} successful responses`);
    
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'COMPLETE',
        duration: dataGatheringDuration,
        tokenUsage: { 
            prompt: totalPromptTokens, 
            completion: totalCompletionTokens, 
            total: totalPromptTokens + totalCompletionTokens 
        },
        metadata: { 
            sentimentModelsSucceeded: successfulSentiments,
            visibilityResponsesSucceeded: successfulResponses
        }
    }, 'Data gathering phase completed');

    // --- Stage 2: Finalize Streaming Writes + Write Metadata ---
    const dbTransactionTimer = new Timer();
    log({ runId, stage: 'DATABASE_WRITE', step: 'START' }, 'FINALIZING STREAMING WRITES & SAVING METADATA');
    await prisma.reportRun.update({
        where: { id: runId },
        data: { stepStatus: 'Finalizing Dashboard' },
    });

    // This is now handled by the StreamingDatabaseWriter above

    // --- Transaction 1: Write Sentiment Scores and Summary ---
    await prisma.$transaction(async (tx) => {
        log({ runId, stage: 'DATABASE_WRITE', step: 'SENTIMENTS_START'}, 'Writing sentiment scores.', 'DEBUG');
        for (let i = 0; i < sentimentResults.length; i++) {
            const result = sentimentResults[i];
            const model = sentimentModels[i];
            if (result.status === 'fulfilled') {
                const { data, usage } = result.value;
                await tx.sentimentScore.create({
                    data: { runId, name: 'Detailed Sentiment Scores', value: data as any, engine: model.id }
                });
            } else {
                log({runId, stage: 'DATABASE_WRITE', step: 'SENTIMENT_MODEL_FAILURE', metadata: { model: model.id, reason: result.reason }}, `Failed to get sentiment from ${model.id}`, 'WARN');
            }
        }
        if (sentimentSummary) {
            try {
                await tx.sentimentScore.create({
                    data: {
                        runId,
                        name: 'Detailed Sentiment Scores',
                        value: sentimentSummary.data as unknown as Prisma.InputJsonValue,
                        engine: 'serplexity-summary',
                    }
                });
                log({runId, stage: 'DATABASE_WRITE', step: 'SENTIMENT_SUMMARY_COMPLETE'}, 'Successfully saved overall sentiment summary.');
            } catch (error) {
                log({runId, stage: 'DATABASE_WRITE', step: 'SENTIMENT_SUMMARY_ERROR', error }, `Error generating sentiment summary: ${error}`, 'ERROR');
            }
        }
    });
    
    const dbTransactionDuration = dbTransactionTimer.elapsed();
    log({ 
        runId, 
        stage: 'DATABASE_WRITE', 
        step: 'COMPLETE',
        duration: dbTransactionDuration,
        tokenUsage: { 
            prompt: totalPromptTokens, 
            completion: totalCompletionTokens, 
            total: totalPromptTokens + totalCompletionTokens 
        }
    }, 'All database writes completed successfully');

    // --- Data aggregation completed ---
    log({ 
        runId, 
        stage: 'FINALIZATION', 
        step: 'AGGREGATION_COMPLETE'
    }, 'Data aggregation completed - dashboard data will be calculated on-demand');

    // ===== Prepare overall usage & timing metrics =====
    const finalTokenUsage = totalPromptTokens + totalCompletionTokens;
    const totalJobDuration = jobTimer.elapsed();

    // Move to post-completion optimization phase
    await updateProgress(prisma, runId, 'Generating Optimization Tasks', 0, PROGRESS.OPTIMIZATION_START, PROGRESS.OPTIMIZATION_END, undefined, true);

    // ────────────────────────────────────────────────────────────────
    // Post-processing (metrics + optimisation + summary)
    // ────────────────────────────────────────────────────────────────
    try {
        // 1️⃣  Compute and persist dashboard metrics (quick step)
        try {
            log({ runId, stage: 'POST_COMPLETION', step: 'METRICS_START' }, 'Computing and persisting dashboard metrics…');
            await computeAndPersistMetrics(runId, company.id);
            await updateProgress(prisma, runId, 'Generating Optimization Tasks', 25, PROGRESS.OPTIMIZATION_START, PROGRESS.OPTIMIZATION_END, 'Computed dashboard metrics');
            log({ runId, stage: 'POST_COMPLETION', step: 'METRICS_SUCCESS' }, 'Successfully computed and persisted dashboard metrics');
        } catch (metricsError) {
            log({ 
                runId, 
                stage: 'POST_COMPLETION', 
                step: 'METRICS_ERROR',
                error: metricsError,
                metadata: { errorType: metricsError instanceof Error ? metricsError.name : 'Unknown' }
            }, 'Error computing and persisting metrics (report still continuing)', 'ERROR');
        }

        // 2️⃣  Generate optimisation tasks + visibility summary (first report only)
        try {
            log({ runId, stage: 'POST_COMPLETION', step: 'OPTIMIZATION_START' }, 'Generating optimisation tasks and AI visibility summary…');
            await updateProgress(prisma, runId, 'Generating Optimization Tasks', 30, PROGRESS.OPTIMIZATION_START, PROGRESS.OPTIMIZATION_END, 'Starting task generation');

            // Import only the persistence function from legacy service
            const { persistOptimizationTasks } = await import('../services/optimizationTaskService');
            
            await updateProgress(prisma, runId, 'Generating Optimization Tasks', 50, PROGRESS.OPTIMIZATION_START, PROGRESS.OPTIMIZATION_END, 'Processing with AI models');
            
            // Call PydanticAI optimization agent directly (modern approach)
            log({ runId, stage: 'POST_COMPLETION', step: 'PYDANTIC_OPTIMIZATION_CALL' }, 'Using PydanticAI optimization agent');
            
            // Import PydanticAI service for optimization tasks
            const { pydanticLlmService } = await import('../services/pydanticLlmService');
            const optimizationAgentInput = {
                company_name: company.name,
                industry: company.industry || 'Technology',
                context: 'Generate optimization tasks based on AI visibility metrics',
                categories: ["content", "technical", "brand", "visibility", "performance"],
                max_tasks: 10,
                priority_focus: 'high_impact'
            };

            // Trust PydanticAI structured output - no validation bottleneck
            const pydanticOptimizationResult = await pydanticLlmService.executeAgent(
                'optimization_agent.py',
                optimizationAgentInput,
                null, // No Zod validation
                {
                    temperature: 0.7,
                    maxTokens: 2500,
                    timeout: 45000
                }
            );

            // Convert PydanticAI result to legacy format for compatibility with persistence
            type LegacyCategory = 'Technical SEO' | 'Content & Messaging' | 'Brand Positioning' | 'Link Building' | 'Local SEO';
            type LegacyImpactMetric = 'visibility' | 'averagePosition' | 'inclusionRate';

            const categoryMapping: Record<string, LegacyCategory> = {
                'content': 'Content & Messaging',
                'technical': 'Technical SEO',
                'brand': 'Brand Positioning',
                'visibility': 'Technical SEO',
                'performance': 'Technical SEO'
            };

            const impactMetricMapping: Record<string, LegacyImpactMetric> = {
                'content': 'visibility',
                'technical': 'inclusionRate',
                'brand': 'averagePosition',
                'visibility': 'averagePosition',
                'performance': 'inclusionRate'
            };

            // Trust PydanticAI structured output
            const optimizationResponse = pydanticOptimizationResult.data as any;
            const optimisationResult = {
                tasks: (optimizationResponse.tasks || []).map((task: any, index: number) => ({
                    id: `T${String(index + 1).padStart(2, '0')}`,
                    title: String(task.title || 'Optimization Task'),
                    description: String(task.description || 'No description available'),
                    category: categoryMapping[task.category] || 'Technical SEO',
                    priority: (task.priority === 1 ? 'High' : task.priority <= 3 ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
                    impact_metric: impactMetricMapping[task.category] || 'visibility'
                })),
                summary: `Generated ${optimizationResponse.totalTasks || 0} optimization tasks using PydanticAI. Focus areas include ${(optimizationResponse.tasks || []).map((t: any) => t.category).slice(0, 3).join(', ') || 'general optimization'}.`,
                tokenUsage: {
                    promptTokens: Math.floor(pydanticOptimizationResult.metadata.tokensUsed * 0.7),
                    completionTokens: Math.floor(pydanticOptimizationResult.metadata.tokensUsed * 0.3),
                    totalTokens: pydanticOptimizationResult.metadata.tokensUsed
                }
            };
            await updateProgress(prisma, runId, 'Generating Optimization Tasks', 90, PROGRESS.OPTIMIZATION_START, PROGRESS.OPTIMIZATION_END, 'Tasks generated');

            if (optimisationResult.tasks.length > 0) {
                await persistOptimizationTasks(optimisationResult.tasks, runId, company.id, prisma);
                await updateProgress(prisma, runId, 'Generating Optimization Tasks', 95, PROGRESS.OPTIMIZATION_START, PROGRESS.OPTIMIZATION_END, 'Tasks saved');
                log({ 
                    runId, 
                    stage: 'POST_COMPLETION', 
                    step: 'OPTIMIZATION_TASKS_PERSISTED',
                    metadata: { tasksCount: optimisationResult.tasks.length }
                }, `Persisted ${optimisationResult.tasks.length} optimisation tasks`);
            }

            // Store the AI-visibility summary on the run
            await prisma.reportRun.update({
                where: { id: runId },
                data: { aiVisibilitySummary: optimisationResult.summary }
            });

            // Calculate optimization cost
            optimizationCost = addCostFromUsage(
                pydanticOptimizationResult.metadata.modelUsed,
                optimisationResult.tokenUsage.promptTokens,
                optimisationResult.tokenUsage.completionTokens
            );
            
            // Update token usage and USD cost
            await prisma.reportRun.update({
                where: { id: runId },
                data: { 
                    tokensUsed: finalTokenUsage + optimisationResult.tokenUsage.totalTokens,
                    usdCost: totalUsdCost + optimizationCost
                }
            });

            await updateProgress(prisma, runId, 'Generating Optimization Tasks', 100, PROGRESS.OPTIMIZATION_START, PROGRESS.OPTIMIZATION_END, 'Optimization complete');
            
            log({ 
                runId, 
                stage: 'POST_COMPLETION', 
                step: 'OPTIMIZATION_SUCCESS',
                tokenUsage: { 
                    prompt: optimisationResult.tokenUsage.promptTokens, 
                    completion: optimisationResult.tokenUsage.completionTokens, 
                    total: optimisationResult.tokenUsage.totalTokens 
                },
                metadata: { 
                    tasksGenerated: optimisationResult.tasks.length > 0,
                    summaryGenerated: true
                }
            }, 'Optimisation tasks and summary generation complete');
        } catch (optimisationError) {
            log({ 
                runId, 
                stage: 'POST_COMPLETION', 
                step: 'OPTIMIZATION_ERROR',
                error: optimisationError,
                metadata: { errorType: optimisationError instanceof Error ? optimisationError.name : 'Unknown' }
            }, 'Error generating optimisation tasks / summary (report still continuing)', 'ERROR');
        }

    } catch (postError) {
        log({ 
            runId, 
            stage: 'POST_COMPLETION', 
            step: 'ERROR',
            error: postError,
            metadata: { errorType: postError instanceof Error ? postError.name : 'Unknown' }
        }, 'Unexpected error during post-processing', 'ERROR');
    }

    // 3️⃣  Schedule archive job (non-blocking)
    try {
        log({ runId, stage: 'POST_COMPLETION', step: 'ARCHIVE_SCHEDULE' }, 'Scheduling archive job for old responses…');
        await archiveQueue.add('archive-old-responses', { companyId: company.id }, {
            removeOnComplete: true,
            removeOnFail: 5,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30000 }
        });
        log({ runId, stage: 'POST_COMPLETION', step: 'ARCHIVE_SCHEDULED' }, 'Archive job scheduled');
    } catch (archiveError) {
        log({ 
            runId, 
            stage: 'POST_COMPLETION', 
            step: 'ARCHIVE_ERROR',
            error: archiveError,
            metadata: { errorType: archiveError instanceof Error ? archiveError.name : 'Unknown' }
        }, 'Error scheduling archive job (report still completing)', 'ERROR');
    }

    // ────────────────────────────────────────────────────────────────
    // FINAL: hit 100 % and mark COMPLETED
    // ────────────────────────────────────────────────────────────────
    await updateProgress(prisma, runId, 'Finalizing Report', 100, PROGRESS.FINAL_START, PROGRESS.FINAL_END, 'Report Complete', true);

    await prisma.reportRun.update({
        where: { id: runId },
        data: {
            status: 'COMPLETED',
            stepStatus: 'COMPLETED'
        }
    });
    
    log({ 
        runId, 
        stage: 'JOB_COMPLETE', 
        step: 'SUCCESS',
        duration: totalJobDuration,
        tokenUsage: { 
            prompt: totalPromptTokens, 
            completion: totalCompletionTokens, 
            total: finalTokenUsage 
        },
        metadata: { 
            jobId: job.id,
            companyName: company.name,
            forceMode: force
        }
    }, `Report generation completed successfully - Total time: ${(totalJobDuration / 1000).toFixed(2)}s, Tokens used: ${finalTokenUsage}, Total USD cost: $${(totalUsdCost + optimizationCost).toFixed(4)}`);
};

let worker: Worker | null = null;

if (env.NODE_ENV !== 'test') {
  worker = new Worker('report-generation', processJob, {
    connection: getBullMQConnection(),
    prefix: env.BULLMQ_QUEUE_PREFIX, // 🔧 FIX: Add missing prefix to match queue
    concurrency: LLM_CONFIG.WORKER_CONCURRENCY,
    lockDuration: 1000 * 60 * 15, // 15 minutes
    limiter: {
        max: LLM_CONFIG.WORKER_RATE_LIMIT.max,
        duration: LLM_CONFIG.WORKER_RATE_LIMIT.duration,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
});

worker.on('completed', (job: Job, returnvalue: any) => {
    if (job?.data?.runId) {
        const { runId, company } = job.data;
        log({ 
            runId, 
            stage: 'WORKER_EVENT', 
            step: 'JOB_COMPLETED',
            metadata: { 
                jobId: job.id,
                companyName: company?.name,
                queueName: 'report-generation'
            }
        }, `Worker event: Job ${job.id} completed successfully`);
    }
});

worker.on('failed', async (job, err) => {
    const prisma = await getDbClient();
    const { runId, company } = job?.data || {};
    if (runId) {
        log({ 
            runId, 
            stage: 'WORKER_EVENT', 
            step: 'JOB_FAILED',
            error: err,
            metadata: { 
                jobId: job?.id,
                companyName: company?.name,
                errorType: err.name,
                queueName: 'report-generation'
            }
        }, `Job ${job?.id} failed`, 'ERROR');
        
        try {
            // Check if reportRun exists before trying to update it
            const existingReportRun = await prisma.reportRun.findUnique({ where: { id: runId } });
            if (existingReportRun) {
                await prisma.reportRun.update({
                    where: { id: runId },
                    data: { 
                        status: 'FAILED',
                        stepStatus: `FAILED: ${err.message.substring(0, 200)}`,
                    },
                });
                
                // Send alert for failed report
                await alertingService.alertReportFailure({
                    runId,
                    companyId: company?.id || 'unknown',
                    companyName: company?.name || 'Unknown Company',
                    stage: existingReportRun.stepStatus || 'UNKNOWN_STAGE',
                    errorMessage: err.message,
                    progress: 0, // ReportRun doesn't have progress field
                    timestamp: new Date(),
                    attemptNumber: job?.attemptsMade || 1
                }).catch(alertError => {
                    console.error('[ReportWorker] Failed to send failure alert:', alertError);
                });
                
                log({ 
                    runId, 
                    stage: 'WORKER_EVENT', 
                    step: 'DB_STATUS_UPDATE',
                    metadata: { 
                        status: 'FAILED',
                        errorMessage: err.message.substring(0, 200)
                    }
                }, 'Updated report run status to FAILED in database', 'DEBUG');
            } else {
                log({ 
                    runId, 
                    stage: 'WORKER_EVENT', 
                    step: 'REPORT_RUN_NOT_FOUND',
                    metadata: { 
                        runId,
                        errorMessage: err.message.substring(0, 200)
                    }
                }, 'ReportRun not found when trying to update status to FAILED', 'WARN');
            }
        } catch (dbError) {
            log({ 
                runId, 
                stage: 'WORKER_EVENT', 
                step: 'DB_UPDATE_ERROR',
                error: dbError,
                metadata: { 
                    originalError: err.message,
                    dbErrorType: dbError instanceof Error ? dbError.name : 'Unknown'
                }
            }, 'CRITICAL: Failed to update job status to FAILED in database', 'ERROR');
        }
    } else {
        console.error('[ReportWorker][WORKER_EVENT][CRITICAL] A job failed but had no runId. This is a critical error.', {
            jobId: job?.id,
            jobName: job?.name,
            error: err,
            timestamp: new Date().toISOString()
        });
    }
});

console.log('Report worker process started...');
}

export default worker;