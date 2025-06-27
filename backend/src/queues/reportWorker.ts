import { Worker, Job } from 'bullmq';
import pLimit from 'p-limit';
import env from '../config/env';
import prisma from '../config/db';
import { Prisma, PrismaClient } from '.prisma/client';
import { 
    generateSentimentScores, 
    generateOverallSentimentSummary, 
    generateVisibilityQuestions,
    generatePersonalQuestionsFromWebsite,
    generateQuestionResponse,
    generateBenchmarkQuestionVariations,
    generateWebsiteForCompetitors,
    SentimentScores,
    CompetitorInfo,
    QuestionInput,
    TokenUsage
} from '../services/llmService';
import { getModelsByTask, ModelTask, LLM_CONFIG } from '../config/models';
import { z } from 'zod';
import { Question } from '../types/reports';
import { StreamingDatabaseWriter } from './streaming-db-writer';
import { computeAndPersistMetrics } from '../services/metricsService';
import { archiveQueue } from './archiveWorker';

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
async function generateAndSaveSentiments(runId: string, company: { id: string; name: string; industry: string | null }, tx: PrismaTransactionClient): Promise<{ promptTokens: number, completionTokens: number }> {
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
        return { promptTokens: 0, completionTokens: 0 };
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

    // Process results and save to database
    timer.reset();
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const model = sentimentModels[i];

        if (result.status === 'fulfilled') {
            const { data, usage } = result.value;
            allSentiments.push(data);
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;

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
            
            const { data: summarySentiment, usage } = await generateOverallSentimentSummary(company.name, allSentiments);
            
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;

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

    return { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens };
}

// Note: The calculateAndStoreDashboardData function has been removed
// Dashboard data is now calculated dynamically in the API controller using raw database queries
// This provides better flexibility for filtering and real-time data access

const processJob = async (job: Job) => {
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
    
    let fullCompany = await prisma.company.findUnique({ 
        where: { id: company.id },
        include: { 
            competitors: true, 
            products: { include: { visibilityQuestions: true } }, 
            benchmarkingQuestions: true,
            personalQuestions: true,
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
            productsCount: fullCompany.products.length,
            visibilityQuestionsCount: fullCompany.products.flatMap(p => p.visibilityQuestions).length,
            benchmarkQuestionsCount: fullCompany.benchmarkingQuestions.length,
            personalQuestionsCount: fullCompany.personalQuestions.length
        }
    }, `Company data loaded: ${fullCompany.competitors.length} competitors, ${fullCompany.products.length} products, ${fullCompany.products.flatMap(p => p.visibilityQuestions).length} visibility, ${fullCompany.benchmarkingQuestions.length} benchmark questions`);

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // --- Stage 1: Data Gathering (Network-Intensive) ---
    const dataGatheringTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'START' }, 'STARTING DATA GATHERING PHASE - Generating questions, competitors, and responses', 'STAGE');
    // All LLM calls are done here, before any major DB transactions.

    // --- Skip AI competitor generation - competitors will be discovered from responses ---
    log({ runId, stage: 'DATA_GATHERING', step: 'COMPETITORS_SKIP' }, 'Skipping AI competitor generation - will discover competitors from responses');

    // --- Stage 1.2: Generate Missing Questions ---
    const questionGenTimer = new Timer();
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Preparing Questions' } });
    log({ runId, stage: 'DATA_GATHERING', step: 'QUESTION_GENERATION_START' }, 'Checking for and generating missing questions');

    const questionGenerationPromises: Promise<any>[] = [];

    // --- Prepare Visibility Question Generation ---
    for (const product of fullCompany.products) {
        const currentCount = product.visibilityQuestions.length;
        const targetCount = LLM_CONFIG.VISIBILITY_QUESTIONS_COUNT;
        
        if (currentCount < targetCount) {
            const neededCount = targetCount - currentCount;
            log({ runId, stage: 'DATA_GATHERING', step: 'VISIBILITY_QUESTION_GEN_PREPARE', metadata: { productName: product.name, neededCount } }, `Preparing to generate ${neededCount} questions for ${product.name}`);
            
            const promise = generateVisibilityQuestions(product.name, fullCompany.industry || '', neededCount)
                .then(async ({ data: questions, usage }) => {
                    totalPromptTokens += usage.promptTokens;
                    totalCompletionTokens += usage.completionTokens;
                    if (questions && questions.length > 0) {
                        await prisma.visibilityQuestion.createMany({
                            data: questions.map(q => ({ question: q, productId: product.id }))
                        });
                        log({ runId, stage: 'DATA_GATHERING', step: 'VISIBILITY_QUESTION_CREATED', metadata: { count: questions.length, productName: product.name } }, `Created ${questions.length} new visibility questions for ${product.name}`);
                    }
                })
                .catch(error => {
                    log({ runId, stage: 'DATA_GATHERING', step: 'VISIBILITY_QUESTION_GEN_ERROR', error, metadata: { productName: product.name } }, `Failed to generate visibility questions for ${product.name}`, 'ERROR');
                });
            questionGenerationPromises.push(promise);
        }
    }

    // --- Prepare Benchmark Variation Generation ---
    const originalBenchmarkQuestions = fullCompany.benchmarkingQuestions.filter(q => !q.originalQuestionId);
    for (const bq of originalBenchmarkQuestions) {
        const currentVariationCount = fullCompany.benchmarkingQuestions.filter(q => q.originalQuestionId === bq.id).length;
        const targetVariationCount = LLM_CONFIG.BENCHMARK_VARIATIONS_COUNT;
        
        if (currentVariationCount < targetVariationCount) {
            const neededVariationCount = targetVariationCount - currentVariationCount;
            log({ runId, stage: 'DATA_GATHERING', step: 'BENCHMARK_VARIATION_GEN_PREPARE', metadata: { questionText: bq.text, neededVariationCount } }, `Preparing to generate ${neededVariationCount} variations for "${bq.text}"`);

            const promise = generateBenchmarkQuestionVariations(bq.text, fullCompany.industry || '', fullCompany.products[0]?.name || fullCompany.name, neededVariationCount)
                .then(async ({ data: questions, usage }) => {
                    totalPromptTokens += usage.promptTokens;
                    totalCompletionTokens += usage.completionTokens;
                    if (questions && questions.length > 0) {
                        await prisma.benchmarkingQuestion.createMany({
                            data: questions.map(q => ({
                                text: q,
                                companyId: fullCompany!.id,
                                isGenerated: true,
                                originalQuestionId: bq.id,
                            })),
                        });
                        log({ runId, stage: 'DATA_GATHERING', step: 'BENCHMARK_VARIATION_CREATED', metadata: { count: questions.length, originalQuestion: bq.text } }, `Created ${questions.length} variations for benchmark question`);
                    }
                })
                .catch(error => {
                    log({ runId, stage: 'DATA_GATHERING', step: 'BENCHMARK_VARIATION_GEN_ERROR', error, metadata: { questionId: bq.id } }, `Failed to generate variations for benchmark question ${bq.id}`, 'ERROR');
                });
            questionGenerationPromises.push(promise);
        }
    }

    // --- Prepare Personal Question Generation ---
    const existingPersonalQuestionsCount = fullCompany.personalQuestions.length;
    const targetPersonalCount = LLM_CONFIG.PERSONAL_QUESTIONS_COUNT;
    if (existingPersonalQuestionsCount < targetPersonalCount) {
        const neededCount = targetPersonalCount - existingPersonalQuestionsCount;
        log({ runId, stage: 'DATA_GATHERING', step: 'PERSONAL_QUESTION_GEN_PREPARE', metadata: { companyName: fullCompany.name, neededCount } }, `Preparing to generate ${neededCount} personal questions for ${fullCompany.name}`);
        
        const companyId = fullCompany.id; // Capture the ID to avoid null reference issues in async callbacks
        const companyName = fullCompany.name; // Capture the name for logging
        const promise = generatePersonalQuestionsFromWebsite(fullCompany.name, fullCompany.website, neededCount)
            .then(async ({ data: questions, usage }) => {
                totalPromptTokens += usage.promptTokens;
                totalCompletionTokens += usage.completionTokens;
                if (questions && questions.length > 0) {
                    await prisma.personalQuestion.createMany({
                        data: questions.map(q => ({ question: q, companyId: companyId }))
                    });
                    log({ runId, stage: 'DATA_GATHERING', step: 'PERSONAL_QUESTION_CREATED', metadata: { count: questions.length, companyName } }, `Created ${questions.length} new personal questions for ${companyName}`);
                }
            })
            .catch(error => {
                log({ runId, stage: 'DATA_GATHERING', step: 'PERSONAL_QUESTION_GEN_ERROR', error, metadata: { companyName } }, `Failed to generate personal questions for ${companyName}`, 'ERROR');
            });
        questionGenerationPromises.push(promise);
    }

    // --- Execute all question generation in parallel ---
    if (questionGenerationPromises.length > 0) {
        log({ runId, stage: 'DATA_GATHERING', step: 'QUESTION_GENERATION_EXECUTE', metadata: { count: questionGenerationPromises.length } }, `Executing ${questionGenerationPromises.length} question generation tasks in parallel.`);
        await Promise.all(questionGenerationPromises);
    } else {
        log({ runId, stage: 'DATA_GATHERING', step: 'QUESTION_GENERATION_SKIP' }, 'All products and questions already have sufficient data. No new questions needed.');
    }

    // Refetch company data to include newly generated questions for the run
    const refreshedCompany = await prisma.company.findUnique({
        where: { id: company.id },
        include: {
            competitors: true,
            products: { include: { visibilityQuestions: true } },
            benchmarkingQuestions: true,
            personalQuestions: true
        }
    });

    if (!refreshedCompany) {
        log({ runId, stage: 'DATA_GATHERING', step: 'CRITICAL_ERROR' }, 'Company data disappeared after question generation.', 'ERROR');
        throw new Error(`Could not re-find company with id ${company.id}`);
    }
    fullCompany = refreshedCompany; // Use the refreshed data for the rest of the job
    log({ runId, stage: 'DATA_GATHERING', step: 'QUESTION_GENERATION_COMPLETE', duration: questionGenTimer.elapsed() }, 'Finished question generation phase');

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
            const { data, usage } = result.value;
            allSentiments.push(data);
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;
        }
    }
    
    let sentimentSummary: { data: SentimentScores; usage: TokenUsage } | null = null;
    if (allSentiments.length > 0) {
        try {
            sentimentSummary = await generateOverallSentimentSummary(fullCompany.name, allSentiments);
            totalPromptTokens += sentimentSummary.usage.promptTokens;
            totalCompletionTokens += sentimentSummary.usage.completionTokens;
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
    
    // 1.3: Generate Visibility & Benchmark Responses
    const responseGenerationTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'RESPONSE_GENERATION_START' }, 'Generating visibility and benchmark responses');
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Running Visibility Analysis' } });
    
    const allQuestions: Question[] = [
        ...fullCompany.products.flatMap(p => p.visibilityQuestions.map(q => ({ id: q.id, text: q.question, type: 'visibility' as const }))),
        ...fullCompany.benchmarkingQuestions.map(q => ({ id: q.id, text: q.text, type: 'benchmark' as const })),
        ...fullCompany.personalQuestions.map(q => ({ id: q.id, text: q.question, type: 'personal' as const }))
    ];
    
    const totalQuestionsToProcess = allQuestions.length;
    let questionsProcessed = 0;
    
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'QUESTIONS_COLLECTED', 
        metadata: {
            totalQuestions: totalQuestionsToProcess,
            visibilityCount: fullCompany.products.flatMap(p => p.visibilityQuestions).length,
            benchmarkCount: fullCompany.benchmarkingQuestions.length,
            personalCount: fullCompany.personalQuestions.length,
        }
    }, `Collected a total of ${totalQuestionsToProcess} questions to be answered.`);

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
    const questionModelCombinations = allQuestions.flatMap(question => 
        models.map(model => ({ question, model }))
    );

    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'PARALLEL_SETUP',
        metadata: { 
            totalCombinations: questionModelCombinations.length,
            questionsCount: allQuestions.length,
            modelsCount: models.length,
            concurrency: LLM_CONFIG.QUESTION_ANSWERING_CONCURRENCY
        }
    }, `Prepared ${questionModelCombinations.length} question-model combinations for streaming parallel processing`);

    // Track completed responses for progress calculation
    let completedResponses = 0;

    // Process all question-model combinations in parallel with streaming writes
    const questionProcessingPromises = questionModelCombinations.map(async ({ question, model }) => {
        const questionInput: QuestionInput = { id: question.id, text: question.text };
        const startTime = Date.now();
        
        try {
            const { data: answer, usage } = await questionLimit(() => generateQuestionResponse(questionInput, model));
            
            totalPromptTokens += usage.promptTokens;
            totalCompletionTokens += usage.completionTokens;

            // Determine question type for streaming
            let questionType: 'visibility' | 'benchmark' | 'personal';
            const originalQuestion = allQuestions.find(q => q.id === question.id);
            if (originalQuestion) {
                questionType = originalQuestion.type;
            } else {
                // Fallback logic
                if (fullCompany.products.some(p => p.visibilityQuestions.some(vq => vq.id === question.id))) {
                    questionType = 'visibility';
                } else if (fullCompany.benchmarkingQuestions.some(bq => bq.id === question.id)) {
                    questionType = 'benchmark';
                } else {
                    questionType = 'personal';
                }
            }

            // Create response data structure
            const responseData = {
                questionId: question.id,
                questionType,
                answer,
                modelId: model.id,
            };

            // Update progress tracking
            completedResponses++;
            const currentProgress = Math.round((completedResponses / questionModelCombinations.length) * 100);
            
            // Update progress every 5% or on significant milestones
            if (currentProgress % 5 === 0 || completedResponses === questionModelCombinations.length) {
                await prisma.reportRun.update({ 
                    where: { id: runId }, 
                    data: { stepStatus: `Analyzing Visibility (${currentProgress}%)` } 
                });
            }

            const duration = Date.now() - startTime;
            log({
                runId,
                stage: 'DATA_GATHERING',
                step: 'QUESTION_STREAMED',
                duration,
                progress: currentProgress,
                tokenUsage: { prompt: usage.promptTokens, completion: usage.completionTokens, total: usage.totalTokens },
                metadata: {
                    questionId: question.id,
                    modelId: model.id,
                    questionType,
                    success: true,
                    answerLength: answer.length,
                    completedCombinations: completedResponses,
                    totalExpected: questionModelCombinations.length
                },
            }, `Successfully processed and streamed question ${question.id} with ${model.id} (${currentProgress}% complete)`);

            return { response: responseData, success: true };
        } catch (error) {
            const duration = Date.now() - startTime;
            log({
                runId,
                stage: 'DATA_GATHERING',
                step: 'QUESTION_ERROR',
                duration,
                error,
                metadata: {
                    questionId: question.id,
                    modelId: model.id,
                    success: false
                },
            }, `Failed to process question ${question.id} with ${model.id}`, 'ERROR');
            
            return { response: null, success: false };
        }
    });

    // Process all combinations with streaming database writes
    const allResults = await Promise.allSettled(questionProcessingPromises);
    
    // --- Step 2.1: Extract discovered brands from all responses ---
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Analyzing Competitors (0%)' } });
    await job.updateProgress(70); // Start competitor analysis at 70%
    
    const collectedResponses = allResults
        .filter((result): result is PromiseFulfilledResult<{ response: any; success: true; }> => 
            result.status === 'fulfilled' && result.value.success)
        .map(result => result.value.response);

    const brandNameSet = new Set<string>();
    const brandRegex = /<brand>(.*?)<\/brand>/gi;

    // Process responses with progress tracking
    let processedResponses = 0;
    for (const response of collectedResponses) {
        let match;
        while ((match = brandRegex.exec(response.answer)) !== null) {
            const brandName = match[1].trim();
            if (brandName) {
                brandNameSet.add(brandName);
            }
        }
        
        processedResponses++;
        const extractionProgress = Math.round((processedResponses / collectedResponses.length) * 25); // 0-25% of this phase
        if (extractionProgress % 5 === 0 || processedResponses === collectedResponses.length) {
            await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: `Analyzing Competitors (${extractionProgress}%)` } });
        }
    }
    
    const discoveredBrands = Array.from(brandNameSet);
    log({
        runId,
        stage: 'BRAND_DISCOVERY',
        step: 'EXTRACTION_COMPLETE',
        metadata: {
            discoveredCount: discoveredBrands.length,
            sample: discoveredBrands.slice(0, 10)
        }
    }, `Extracted ${discoveredBrands.length} unique brand names from responses.`);

    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Analyzing Competitors (25%)' } });

    // --- Step 2.2: Enrich discovered brands with websites (if any were found) ---
    if (discoveredBrands.length > 0) {
        log({ runId, stage: 'BRAND_DISCOVERY', step: 'WEBSITE_ENRICHMENT_START' }, 'Enriching discovered brands with website data...');
        await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Analyzing Competitors (30%)' } });
        
        try {
            const { data: enrichedCompetitors, usage: websiteUsage } = await generateWebsiteForCompetitors(discoveredBrands);
            totalPromptTokens += websiteUsage.promptTokens;
            totalCompletionTokens += websiteUsage.completionTokens;

            log({
                runId,
                stage: 'BRAND_DISCOVERY',
                step: 'WEBSITE_ENRICHMENT_COMPLETE',
                tokenUsage: {
                    prompt: websiteUsage.promptTokens,
                    completion: websiteUsage.completionTokens,
                    total: websiteUsage.totalTokens
                },
                metadata: {
                    enrichedCount: enrichedCompetitors.length,
                    sample: enrichedCompetitors.slice(0, 5)
                }
            }, `Successfully enriched ${enrichedCompetitors.length} brands with websites.`);

            await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Analyzing Competitors (75%)' } });

            // --- Step 2.3: Save new competitors to the database ---
            const standardizeWebsite = (website: string | null | undefined): string => {
                if (!website) return '';
                // Normalize to lowercase, remove protocol and www., and remove any path.
                return website.toLowerCase()
                    .replace(/^https?:\/\//, '')
                    .replace(/^www\./, '')
                    .split('/')[0];
            };

            const newCompetitorsToSave = enrichedCompetitors.filter(
                (newComp: CompetitorInfo) => {
                    const standardizedNewCompWebsite = standardizeWebsite(newComp.website);

                    // Check if the discovered competitor is the user's own company
                    const isUserCompanyByName = fullCompany.name.toLowerCase() === newComp.name.toLowerCase();
                    const isUserCompanyByWebsite = standardizedNewCompWebsite &&
                        standardizeWebsite(fullCompany.website) === standardizedNewCompWebsite;

                    if (isUserCompanyByName || isUserCompanyByWebsite) {
                        log({
                            runId,
                            stage: 'BRAND_DISCOVERY',
                            step: 'SELF_AS_COMPETITOR_SKIPPED',
                            metadata: { companyName: newComp.name, companyWebsite: newComp.website }
                        }, `Skipping adding user's own company '${newComp.name}' as a competitor.`);
                        return false; // Prevent user's company from being added as a competitor
                    }
                    
                    // Check for name duplicates (existing logic)
                    const nameExists = fullCompany.competitors.some(
                        (existing) => existing.name.toLowerCase() === newComp.name.toLowerCase()
                    );
                    
                    // Check for website duplicates (new logic)
                    const websiteExists = standardizedNewCompWebsite && fullCompany.competitors.some(
                        (existing) => standardizeWebsite(existing.website) === standardizedNewCompWebsite
                    );
                    
                    // Only add if neither name nor website exists
                    return !nameExists && !websiteExists;
                }
            );

            if (newCompetitorsToSave.length > 0) {
                try {
                    await prisma.competitor.createMany({
                        data: newCompetitorsToSave.map((c: CompetitorInfo) => ({
                            name: c.name,
                            website: c.website,
                            companyId: fullCompany.id,
                            isGenerated: true,
                        })),
                        skipDuplicates: true,
                    });
                    log({ runId, stage: 'BRAND_DISCOVERY', step: 'NEW_COMPETITORS_SAVED', metadata: { count: newCompetitorsToSave.length } }, `Saved ${newCompetitorsToSave.length} newly discovered competitors.`);
                } catch (error) {
                    // Handle unique constraint violations gracefully - this can happen if competitors are discovered 
                    // with websites that already exist for this company
                    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
                        log({ runId, stage: 'BRAND_DISCOVERY', step: 'DUPLICATE_COMPETITORS_SKIPPED', 
                              metadata: { attemptedCount: newCompetitorsToSave.length } }, 
                              'Some discovered competitors were skipped due to duplicate websites.', 'WARN');
                    } else {
                        // Re-throw other errors
                        throw error;
                    }
                }
            }
        } catch (error) {
            log({ runId, stage: 'BRAND_DISCOVERY', step: 'WEBSITE_ENRICHMENT_ERROR', error }, 'Failed to enrich brands with websites.', 'ERROR');
        }
    }

    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Analyzing Competitors (100%)' } });

    // --- Step 2.4: Use optimized StreamingDatabaseWriter for batch operations ---
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Preparing Dashboard (0%)' } });
    
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

    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Preparing Dashboard (15%)' } });

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
        const streamingProgress = Math.round((processedStreamingResponses / collectedResponses.length) * 50) + 15; // 15-65% range
        if (streamingProgress % 10 === 0 || processedStreamingResponses === collectedResponses.length) {
            await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: `Preparing Dashboard (${streamingProgress}%)` } });
        }
    }

    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Preparing Dashboard (70%)' } });

    // Finalize all batch writes
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Preparing Dashboard (80%)' } });
    
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

    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Preparing Dashboard (90%)' } });

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

    // Update progress to 100% after all processing is complete
    questionsProcessed = allQuestions.length;
    const finalProgress = 100;
    
    log({
        runId,
        stage: 'DATA_GATHERING',
        step: 'PARALLEL_PROCESSING_COMPLETE',
        progress: finalProgress,
        metadata: {
            totalCombinations: questionModelCombinations.length,
            successfulResponses,
            failedResponses,
            successRate: Math.round((successfulResponses / questionModelCombinations.length) * 100),
            questionsProcessed: allQuestions.length,
            modelsUsed: models.length
        },
    }, `Parallel processing complete: ${successfulResponses}/${questionModelCombinations.length} successful responses (${Math.round((successfulResponses / questionModelCombinations.length) * 100)}% success rate)`);
    
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: `Analyzing Visibility (${finalProgress}%)` } });
    
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

    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'Preparing Dashboard (100%)' } });

    // --- Stage 3: Data Aggregation & Finalization ---
    const aggregationTimer = new Timer();
    log({ runId, stage: 'FINALIZATION', step: 'AGGREGATION_START' }, 'STARTING FINALIZATION PHASE - Calculating dashboard metrics and completing report');
    
    // Note: Dashboard data is now calculated dynamically in the API controller
    // No need to pre-calculate and store dashboard data anymore
    
    const aggregationDuration = aggregationTimer.elapsed();
    log({ 
        runId, 
        stage: 'FINALIZATION', 
        step: 'AGGREGATION_COMPLETE',
        duration: aggregationDuration
    }, 'Data aggregation completed - dashboard data will be calculated on-demand');

    // --- Finalization ---
    const finalTokenUsage = totalPromptTokens + totalCompletionTokens;
    const totalJobDuration = jobTimer.elapsed();
    
    await prisma.reportRun.update({
        where: { id: runId },
        data: { 
            status: 'COMPLETED',
            stepStatus: 'COMPLETED',
            tokensUsed: finalTokenUsage,
        },
    });
    
    // --- Post-completion processing ---
    try {
        // Compute and persist dashboard metrics
        log({ runId, stage: 'POST_COMPLETION', step: 'METRICS_START' }, 'Computing and persisting dashboard metrics...');
        await computeAndPersistMetrics(runId, company.id);
        log({ runId, stage: 'POST_COMPLETION', step: 'METRICS_SUCCESS' }, 'Successfully computed and persisted dashboard metrics');
        
        // Schedule archive job for old responses
        log({ runId, stage: 'POST_COMPLETION', step: 'ARCHIVE_SCHEDULE' }, 'Scheduling archive job for old responses...');
        await archiveQueue.add('archive-old-responses', { companyId: company.id }, {
            removeOnComplete: true,
            removeOnFail: 5,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30000 }
        });
        log({ runId, stage: 'POST_COMPLETION', step: 'ARCHIVE_SCHEDULED' }, 'Successfully scheduled archive job');
        
    } catch (error) {
        log({ 
            runId, 
            stage: 'POST_COMPLETION', 
            step: 'ERROR',
            error,
            metadata: { errorType: error instanceof Error ? error.name : 'Unknown' }
        }, 'Error in post-completion processing (report still marked as completed)', 'ERROR');
        // Note: We don't re-throw here because the report itself completed successfully
        // The metrics computation and archiving are supplementary processes
    }
    
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
    }, `Report generation completed successfully - Total time: ${(totalJobDuration / 1000).toFixed(2)}s, Tokens used: ${finalTokenUsage}`);
};

let worker: Worker | null = null;

if (env.NODE_ENV !== 'test') {
  worker = new Worker('report-generation', processJob, {
    connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
    },
    concurrency: LLM_CONFIG.WORKER_CONCURRENCY,
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