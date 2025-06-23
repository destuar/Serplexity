import { Worker, Job } from 'bullmq';
import env from '../config/env';
import prisma from '../config/db';
import { Prisma, PrismaClient } from '.prisma/client';
import { 
    generateSentimentScores, 
    generateOverallSentimentSummary, 
    generateVisibilityQuestions,
    generateCompetitors,
    generateVisibilityResponse,
    generateBenchmarkQuestionVariations,
    SentimentScores,
    CompetitorInfo
} from '../services/llmService';
import { getModelsByTask, ModelTask, LLM_CONFIG } from '../config/models';
import { z } from 'zod';

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
    const variations = new Set<string>([name]);
    const lowerCaseName = name.toLowerCase();

    // Handle corporate suffixes
    const suffixes = ['llc', 'inc', 'corp', 'corporation', 'ltd', 'company', 'co'];
    for (const suffix of suffixes) {
        if (lowerCaseName.endsWith(` ${suffix}`) || lowerCaseName.endsWith(` ${suffix}.`)) {
            const regex = new RegExp(`\\s*,?\\s*${suffix}\\.?$`, 'i');
            variations.add(name.replace(regex, '').trim());
            break; 
        }
    }

    // Handle locations like "of Los Angeles"
    if (lowerCaseName.includes(' of ')) {
        const parts = name.split(/\s+of\s+/i);
        if (parts.length > 1) {
            variations.add(parts[0].trim());
        }
    }
    
    // Create a snapshot to iterate over, while adding to the main set
    const baseVariations = new Set(variations);
    for(const base of baseVariations){
        if (base.includes('&')) variations.add(base.replace(/&/g, 'and'));
        if (base.includes('.') || base.includes('-')) {
            variations.add(base.replace(/\./g, '').replace(/-/g, ' '));
        }
    }

    return variations;
}

function findMentions(text: string, entities: { id: string; name: string }[]): { id: string; position: number }[] {
    const allPossibleMentions: {
        id: string;
        originalName: string;
        matchedName: string;
        index: number;
    }[] = [];

    for (const entity of entities) {
        if (!entity.name || entity.name.length < 2) continue;

        const variations = generateNameVariations(entity.name);

        for (const variation of variations) {
            const trimmedVariation = variation.trim();
            if (trimmedVariation.length < 2) continue;

            try {
                const regex = new RegExp(`\\b${escapeRegex(trimmedVariation)}\\b`, 'gi');
                let match;
                while ((match = regex.exec(text))) {
                  if (match !== null) {
                    allPossibleMentions.push({
                        id: entity.id,
                        originalName: entity.name,
                        matchedName: match[0],
                        index: match.index,
                    });
                  }
                }
            } catch (e) {
                console.error(`Error creating regex for variation: "${variation}"`, e);
            }
        }
    }

    const resolvedMentions: { id: string; name: string; index: number }[] = [];
    
    const mentionsByLocation = new Map<string, (typeof allPossibleMentions)[0][]>();
    for (const mention of allPossibleMentions) {
        const key = `${mention.index}-${mention.matchedName.toLowerCase()}`;
        if (!mentionsByLocation.has(key)) {
            mentionsByLocation.set(key, []);
        }
        mentionsByLocation.get(key)!.push(mention);
    }

    for (const candidates of mentionsByLocation.values()) {
        if (candidates.length === 1) {
            resolvedMentions.push({ id: candidates[0].id, name: candidates[0].matchedName, index: candidates[0].index });
        } else {
            candidates.sort((a, b) => b.originalName.length - a.originalName.length);
            const bestMatch = candidates[0];
            resolvedMentions.push({ id: bestMatch.id, name: bestMatch.matchedName, index: bestMatch.index });
        }
    }
    
    resolvedMentions.sort((a,b) => b.name.length - a.name.length);

    const finalMentions: typeof resolvedMentions = [];
    for(const mention of resolvedMentions) {
        const isOverlapped = finalMentions.some(
            final => mention.index >= final.index && (mention.index + mention.name.length) <= (final.index + final.name.length) && mention.name !== final.name
        );
        if(!isOverlapped) {
            finalMentions.push(mention);
        }
    }

    finalMentions.sort((a, b) => a.index - b.index);

    const uniqueMentions: { id: string; position: number }[] = [];
    const seenIds = new Set<string>();

    for (const mention of finalMentions) {
        if (!seenIds.has(mention.id)) {
            uniqueMentions.push({
                id: mention.id,
                position: uniqueMentions.length + 1,
            });
            seenIds.add(mention.id);
        }
    }

    return uniqueMentions;
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
            data: { stepStatus: 'CALCULATING_SENTIMENTS (Skipped: No industry specified)' },
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

            await tx.metric.create({
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
        data: { stepStatus: `CALCULATING_SENTIMENTS (${allSentiments.length}/${sentimentModels.length} models completed)` },
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

            await tx.metric.create({
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

async function calculateAndStoreDashboardData(runId: string, companyId: string, tx: PrismaTransactionClient) {
    const timer = new Timer();
    
    log({ 
        runId, 
        stage: 'DASHBOARD_AGGREGATION', 
        step: 'START',
        metadata: { companyId }
    }, 'Starting dashboard data calculation and storage');
    
    await tx.reportRun.update({
        where: { id: runId },
        data: { stepStatus: 'AGGREGATING_DATA' },
    });

    try {
        // Fetch company and related data
        timer.reset();
        const companyWithCompetitors = await tx.company.findUnique({
            where: { id: companyId },
            include: { competitors: true }
        });

        if (!companyWithCompetitors) {
            throw new Error(`Company with ID ${companyId} not found.`);
        }
        
        const dataFetchDuration = timer.elapsed();
        log({ 
            runId, 
            stage: 'DASHBOARD_AGGREGATION', 
            step: 'COMPANY_DATA_FETCHED',
            duration: dataFetchDuration,
            metadata: { 
                companyName: companyWithCompetitors.name,
                competitorCount: companyWithCompetitors.competitors.length
            }
        }, `Fetched company data and ${companyWithCompetitors.competitors.length} competitors`, 'DEBUG');

        // Fetch all metrics, mentions, and questions for this run
        timer.reset();
        const [
            allMetricsForRun, 
            allVisibilityMentions, 
            allBenchmarkMentions,
            allVisibilityQuestions,
            allBenchmarkQuestions,
        ] = await Promise.all([
            tx.metric.findMany({ where: { runId } }),
            tx.visibilityMention.findMany({
                where: { visibilityResponse: { runId } },
                include: { competitor: true, company: true }
            }),
            tx.benchmarkMention.findMany({
                where: { benchmarkResponse: { runId } },
                include: { competitor: true, company: true }
            }),
            tx.visibilityQuestion.findMany({
                where: { responses: { some: { runId } } },
                include: { responses: { where: { runId } } }
            }),
            tx.benchmarkingQuestion.findMany({
              where: { benchmarkResponses: { some: { runId } } },
              include: { benchmarkResponses: { where: { runId } } }
            })
        ]);

        const allMentionsForRun = [...allVisibilityMentions, ...allBenchmarkMentions];
        
        const aggregateDataFetchDuration = timer.elapsed();
        log({ 
            runId, 
            stage: 'DASHBOARD_AGGREGATION', 
            step: 'AGGREGATE_DATA_FETCHED',
            duration: aggregateDataFetchDuration,
            metadata: { 
                metricsCount: allMetricsForRun.length,
                mentionsCount: allMentionsForRun.length,
                questionsCount: allVisibilityQuestions.length + allBenchmarkQuestions.length
            }
        }, `Fetched aggregation data: ${allMetricsForRun.length} metrics, ${allMentionsForRun.length} mentions, ${allVisibilityQuestions.length + allBenchmarkQuestions.length} questions`, 'DEBUG');

        // 1. Calculate Sentiment Over Time
        timer.reset();
        const sentimentMetrics = allMetricsForRun.filter(m => m.name === 'Detailed Sentiment Scores');
        const dataByDate: { [date: string]: { scores: number[], count: number } } = {};
        
        let processedSentimentMetrics = 0;
        sentimentMetrics.forEach(metric => {
            const value = metric.value as any;
            if (!value?.ratings?.[0]) return;
            const rating = value.ratings[0];
            const categoryScores = Object.values(rating).filter(v => typeof v === 'number') as number[];
            if (categoryScores.length === 0) return;
            
            const averageScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
            const date = new Date(metric.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            if (!dataByDate[date]) {
                dataByDate[date] = { scores: [], count: 0 };
            }
            dataByDate[date].scores.push(averageScore);
            dataByDate[date].count++;
            processedSentimentMetrics++;
        });
        
        const sentimentOverTime = Object.entries(dataByDate).map(([date, data]) => ({
            date,
            score: data.scores.reduce((sum, score) => sum + score, 0) / data.count,
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const sentimentCalculationDuration = timer.elapsed();
        log({ 
            runId, 
            stage: 'DASHBOARD_AGGREGATION', 
            step: 'SENTIMENT_CALCULATED',
            duration: sentimentCalculationDuration,
            metadata: { 
                totalSentimentMetrics: sentimentMetrics.length,
                processedSentimentMetrics,
                sentimentDataPoints: sentimentOverTime.length
            }
        }, `Calculated sentiment over time with ${sentimentOverTime.length} data points from ${processedSentimentMetrics} metrics`, 'DEBUG');

        // 2. Calculate Share of Voice & Competitor Rankings
        timer.reset();
        const totalMentions = allMentionsForRun.length;
        const companyMentions = allMentionsForRun.filter(m => m.companyId === companyId).length;
        const brandShareOfVoice = totalMentions > 0 ? (companyMentions / totalMentions) * 100 : 0;
        
        log({ 
            runId, 
            stage: 'DASHBOARD_AGGREGATION', 
            step: 'SHARE_OF_VOICE_CALCULATED',
            metadata: { 
                totalMentions,
                companyMentions,
                shareOfVoice: brandShareOfVoice.toFixed(2)
            }
        }, `Calculated brand share of voice: ${brandShareOfVoice.toFixed(2)}% (${companyMentions}/${totalMentions} mentions)`, 'DEBUG');

        const competitorMentionCounts = companyWithCompetitors.competitors.map(c => ({
            id: c.id,
            name: c.name,
            website: c.website,
            mentionCount: allMentionsForRun.filter(m => m.competitorId === c.id).length,
            isUserCompany: false,
        }));
        
        const allEntities = [
            { id: companyId, name: companyWithCompetitors.name, website: companyWithCompetitors.website, mentionCount: companyMentions, isUserCompany: true },
            ...competitorMentionCounts
        ];

        // --- Reusable Interfaces for Data Structures ---
        interface CompetitorRankingInfo {
            id: string;
            name: string;
            website: string | null;
            mentionCount: number;
            isUserCompany: boolean;
            shareOfVoice: number;
            rank: number;
            change: number;
            changeType: 'up' | 'down' | 'stable';
        }

        interface TopQuestionInfo {
            id: string;
            question: string;
            position: number;
            responseCount: number;
            type: 'visibility' | 'benchmark';
        }

        const competitorRankings: {
            industryRanking: number;
            competitors: CompetitorRankingInfo[];
            chartCompetitors: CompetitorRankingInfo[];
        } = {
            industryRanking: 0,
            competitors: [],
            chartCompetitors: [],
        };

        const sortedCompetitors = allEntities
            .map(e => ({ ...e, shareOfVoice: totalMentions > 0 ? (e.mentionCount / totalMentions) * 100 : 0 }))
            .sort((a, b) => b.shareOfVoice - a.shareOfVoice);

        const rankedCompetitors: CompetitorRankingInfo[] = sortedCompetitors.map((c, index) => ({
            ...c,
            rank: index + 1,
            change: 0, // Change calculation would require historical data
            changeType: 'stable'
        }));

        competitorRankings.competitors = rankedCompetitors;
        const companyRank = rankedCompetitors.findIndex(c => c.isUserCompany) + 1;
        competitorRankings.industryRanking = companyRank > 0 ? companyRank : rankedCompetitors.length + 1;
        competitorRankings.chartCompetitors = rankedCompetitors.slice(0, 12);
        
        const competitorRankingDuration = timer.elapsed();
        log({ 
            runId, 
            stage: 'DASHBOARD_AGGREGATION', 
            step: 'COMPETITOR_RANKINGS_CALCULATED',
            duration: competitorRankingDuration,
            metadata: { 
                companyRank: competitorRankings.industryRanking,
                totalCompetitors: rankedCompetitors.length,
                chartCompetitors: competitorRankings.chartCompetitors.length
            }
        }, `Calculated competitor rankings - company rank: ${competitorRankings.industryRanking}/${rankedCompetitors.length}`, 'DEBUG');

        // 3. Calculate Top Questions
        timer.reset();
        
        const visibilityTopQuestions = allVisibilityQuestions.map(q => {
            const mentions = allVisibilityMentions.filter(m => q.responses.some(r => r.id === m.visibilityResponseId));
            const companyMention = mentions.find(m => m.companyId === companyId);
            return {
                id: q.id,
                question: q.question,
                position: companyMention ? companyMention.position : null,
                responseCount: q.responses.length,
                type: 'visibility' as const
            };
        });

        const benchmarkTopQuestions = allBenchmarkQuestions.map(q => {
            const mentions = allBenchmarkMentions.filter(m => q.benchmarkResponses.some(r => r.id === m.benchmarkResponseId));
            const companyMention = mentions.find(m => m.companyId === companyId);
            return {
                id: q.id,
                question: q.text,
                position: companyMention ? companyMention.position : null,
                responseCount: q.benchmarkResponses.length,
                type: 'benchmark' as const
            };
        });

        const topQuestions: TopQuestionInfo[] = [...visibilityTopQuestions, ...benchmarkTopQuestions]
            .filter((q): q is Omit<typeof q, 'position'> & { position: number } => q.position !== null)
            .sort((a, b) => a.position - b.position)
            .slice(0, 10);
        
        const topQuestionsCalculationDuration = timer.elapsed();
        log({ 
            runId, 
            stage: 'DASHBOARD_AGGREGATION', 
            step: 'TOP_QUESTIONS_CALCULATED',
            duration: topQuestionsCalculationDuration,
            metadata: { 
                totalQuestions: allVisibilityQuestions.length + allBenchmarkQuestions.length,
                topQuestionsCount: topQuestions.length
            }
        }, `Identified top ${topQuestions.length} questions from ${allVisibilityQuestions.length + allBenchmarkQuestions.length} total questions`, 'DEBUG');
        
        // 4. Store dashboard data
        timer.reset();
        const shareOfVoiceHistory = {};
        const averagePosition = {};
        const averageInclusionRate = {};

        await tx.dashboardData.create({
            data: {
                runId: runId,
                companyId: companyId,
                brandShareOfVoice: { shareOfVoice: brandShareOfVoice },
                shareOfVoiceHistory,
                averagePosition,
                averageInclusionRate,
                competitorRankings: competitorRankings as unknown as Prisma.InputJsonValue,
                topQuestions: topQuestions as unknown as Prisma.InputJsonValue,
                sentimentOverTime: sentimentOverTime as unknown as Prisma.InputJsonValue,
            },
        });

        const dashboardStorageDuration = timer.elapsed();
        const totalDuration = dataFetchDuration + aggregateDataFetchDuration + sentimentCalculationDuration + 
                            competitorRankingDuration + topQuestionsCalculationDuration + dashboardStorageDuration;

        log({ 
            runId, 
            stage: 'DASHBOARD_AGGREGATION', 
            step: 'COMPLETE',
            duration: totalDuration,
            metadata: { 
                shareOfVoice: brandShareOfVoice.toFixed(2),
                companyRank: competitorRankings.industryRanking,
                topQuestionsCount: topQuestions.length,
                sentimentDataPoints: sentimentOverTime.length
            }
        }, "Successfully calculated and stored all dashboard data");

    } catch (error) {
        const errorDuration = timer.elapsed();
        log({ 
            runId, 
            stage: 'DASHBOARD_AGGREGATION', 
            step: 'ERROR',
            duration: errorDuration,
            error,
            metadata: { companyId }
        }, 'Failed to calculate and store dashboard data', 'ERROR');
        
        await tx.reportRun.update({
            where: { id: runId },
            data: { stepStatus: 'FAILED_AGGREGATION' },
        });
        // This will be caught by the job's error handler
        throw error;
    }
}

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
    
    await prisma.reportRun.update({ 
        where: { id: runId }, 
        data: { status: 'RUNNING', stepStatus: 'INITIALIZING' }
    });
    
    let fullCompany = await prisma.company.findUnique({ 
        where: { id: company.id },
        include: { 
            competitors: true, 
            products: { include: { visibilityQuestions: true } }, 
            benchmarkingQuestions: true 
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
            benchmarkQuestionsCount: fullCompany.benchmarkingQuestions.length
        }
    }, `Company data loaded: ${fullCompany.competitors.length} competitors, ${fullCompany.products.length} products, ${fullCompany.products.flatMap(p => p.visibilityQuestions).length} visibility, ${fullCompany.benchmarkingQuestions.length} benchmark questions`);

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // --- Stage 1: Data Gathering (Network-Intensive) ---
    const dataGatheringTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'START' }, 'STARTING DATA GATHERING PHASE - Generating questions, competitors, and responses', 'STAGE');
    // All LLM calls are done here, before any major DB transactions.

    // --- Stage 1.1: Generate Missing Questions ---
    const questionGenTimer = new Timer();
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'GENERATING_QUESTIONS' } });
    log({ runId, stage: 'DATA_GATHERING', step: 'QUESTION_GENERATION_START' }, 'Checking for and generating missing questions');

    // Generate visibility questions for products that don't have any
    for (const product of fullCompany.products) {
        if (product.visibilityQuestions.length === 0) {
            log({ runId, stage: 'DATA_GATHERING', step: 'VISIBILITY_QUESTION_GEN', metadata: { productId: product.id, productName: product.name } }, `Generating visibility questions for product: ${product.name}`);
            try {
                const { data: questions, usage } = await generateVisibilityQuestions(product.name, fullCompany.industry || '');
                totalPromptTokens += usage.promptTokens;
                totalCompletionTokens += usage.completionTokens;

                if (questions && questions.length > 0) {
                    await prisma.visibilityQuestion.createMany({
                        data: questions.map(q => ({ question: q, productId: product.id }))
                    });
                    log({ runId, stage: 'DATA_GATHERING', step: 'VISIBILITY_QUESTION_CREATED', metadata: { count: questions.length, productName: product.name, generatedQuestions: questions } }, `Created ${questions.length} new visibility questions for ${product.name}`, 'CONTENT');
                }
            } catch (error) {
                log({ runId, stage: 'DATA_GATHERING', step: 'VISIBILITY_QUESTION_GEN_ERROR', error, metadata: { productName: product.name } }, `Failed to generate visibility questions for ${product.name}`, 'ERROR');
            }
        }
    }

    // Generate variations for benchmark questions that don't have any
    const originalBenchmarkQuestions = fullCompany.benchmarkingQuestions.filter(q => !q.originalQuestionId);
    for (const bq of originalBenchmarkQuestions) {
        const variationCount = fullCompany.benchmarkingQuestions.filter(q => q.originalQuestionId === bq.id).length;
        if (variationCount === 0) {
            log({ runId, stage: 'DATA_GATHERING', step: 'BENCHMARK_VARIATION_GEN', metadata: { questionId: bq.id, questionText: bq.text } }, `Generating variations for benchmark question: "${bq.text}"`);
            try {
                const contextName = fullCompany.products[0]?.name || fullCompany.name;
                const { data: questions, usage } = await generateBenchmarkQuestionVariations(bq.text, fullCompany.industry || '', contextName);
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
                    log({ runId, stage: 'DATA_GATHERING', step: 'BENCHMARK_VARIATION_CREATED', metadata: { count: questions.length, originalQuestion: bq.text, generatedQuestions: questions } }, `Created ${questions.length} variations for benchmark question`);
                }
            } catch (error) {
                log({ runId, stage: 'DATA_GATHERING', step: 'BENCHMARK_VARIATION_GEN_ERROR', error, metadata: { questionId: bq.id } }, `Failed to generate variations for benchmark question ${bq.id}`, 'ERROR');
            }
        }
    }

    // Refetch company data to include newly generated questions for the run
    const refreshedCompany = await prisma.company.findUnique({
        where: { id: company.id },
        include: {
            competitors: true,
            products: { include: { visibilityQuestions: true } },
            benchmarkingQuestions: true
        }
    });

    if (!refreshedCompany) {
        log({ runId, stage: 'DATA_GATHERING', step: 'CRITICAL_ERROR' }, 'Company data disappeared after question generation.', 'ERROR');
        throw new Error(`Could not re-find company with id ${company.id}`);
    }
    fullCompany = refreshedCompany; // Use the refreshed data for the rest of the job
    log({ runId, stage: 'DATA_GATHERING', step: 'QUESTION_GENERATION_COMPLETE', duration: questionGenTimer.elapsed() }, 'Finished question generation phase');

    // 1.1: Generate AI Competitors
    const competitorTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'COMPETITORS_START' }, 'Generating AI competitors');
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'GENERATING_COMPETITORS' } });
    
    const exampleCompetitor = fullCompany.competitors.length > 0 ? fullCompany.competitors[0].name : "A known competitor";
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'COMPETITORS_API_CALL',
        metadata: { 
            companyName: fullCompany.name,
            exampleCompetitor,
            industry: fullCompany.industry,
            existingCompetitorsCount: fullCompany.competitors.length
        }
    }, `Making API call to generate competitors using example: '${exampleCompetitor}'`, 'DEBUG');
    
    const { data: generatedCompetitors, usage: competitorUsage } = await generateCompetitors(fullCompany.name, exampleCompetitor, fullCompany.industry);
    totalPromptTokens += competitorUsage.promptTokens;
    totalCompletionTokens += competitorUsage.completionTokens;
    
    const competitorDuration = competitorTimer.elapsed();
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'COMPETITORS_COMPLETE',
        duration: competitorDuration,
        tokenUsage: { 
            prompt: competitorUsage.promptTokens, 
            completion: competitorUsage.completionTokens, 
            total: competitorUsage.totalTokens 
        },
        metadata: { 
            generatedCount: generatedCompetitors.length,
            generatedCompetitors: generatedCompetitors
        }
    }, `Generated ${generatedCompetitors.length} new potential competitors`);

    // 1.2: Generate Sentiment Scores
    const sentimentTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'SENTIMENT_START' }, 'Generating sentiment scores');
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'CALCULATING_SENTIMENTS' } });
    
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
    
    const sentimentPromises = sentimentModels.map(model => generateSentimentScores(fullCompany.name!, fullCompany.industry!, model));
    const sentimentResults = await Promise.allSettled(sentimentPromises);
    
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
            failedModels: sentimentModels.length - successfulSentiments
        }
    }, `Sentiment score generation completed: ${successfulSentiments}/${sentimentModels.length} models succeeded`);
    
    // 1.3: Generate Visibility Responses
    const visibilityTimer = new Timer();
    log({ runId, stage: 'DATA_GATHERING', step: 'VISIBILITY_START' }, 'Generating visibility responses');
    await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'ASSESSING_VISIBILITY (0%)' } });
    
    const allQuestions = [
        ...fullCompany.products.flatMap(p => p.visibilityQuestions.map(q => ({ ...q, type: 'visibility' as const }))),
        ...fullCompany.benchmarkingQuestions.map(q => ({ ...q, type: 'benchmark' as const }))
    ];
    
    const visibilityQuestionsCount = fullCompany.products.flatMap(p => p.visibilityQuestions).length;
    const benchmarkQuestionsCount = fullCompany.benchmarkingQuestions.length;
    
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'QUESTIONS_LOADED',
        metadata: { 
            totalQuestions: allQuestions.length,
            visibilityQuestions: visibilityQuestionsCount,
            benchmarkQuestions: benchmarkQuestionsCount
        }
    }, `Loaded ${allQuestions.length} questions (${visibilityQuestionsCount} visibility, ${benchmarkQuestionsCount} benchmark})`, 'DEBUG');
    
    const visibilityModels = getModelsByTask(ModelTask.VISIBILITY);
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'VISIBILITY_MODELS_LOADED',
        metadata: { 
            modelCount: visibilityModels.length,
            models: visibilityModels.map(m => m.id)
        }
    }, `Loaded ${visibilityModels.length} visibility models`, 'DEBUG');
    
    const visibilityResults: PromiseSettledResult<{
        questionId: string;
        questionType: "visibility" | "benchmark";
        model: any;
        response: any;
    }>[] = [];

    for (let i = 0; i < allQuestions.length; i++) {
        const question = allQuestions[i];
        const questionText = question.type === 'visibility' ? question.question : question.text;
        
        // Update progress for the user and for our logs
        const progress = Math.round(((i + 1) / allQuestions.length) * 100);
        const shortQuestion = questionText.substring(0, 50);
        const statusMessage = `ASSESSING_VISIBILITY (${progress}%) - Q${i+1}: ${shortQuestion}...`;
        
        log({ 
            runId, 
            stage: 'DATA_GATHERING', 
            step: 'VISIBILITY_QUESTION_PROCESSING',
            progress,
            metadata: { 
                questionIndex: i + 1,
                totalQuestions: allQuestions.length,
                questionType: question.type,
                questionId: question.id,
                questionText: questionText
            }
        }, `Processing question ${i + 1}/${allQuestions.length}`, 'INFO');
        
        await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: statusMessage } });

        const responsePromises = visibilityModels.map(model => 
            generateVisibilityResponse(questionText, model).then(response => ({
                questionId: question.id,
                questionType: question.type,
                model,
                response
            }))
        );
        const resultsForThisQuestion = await Promise.allSettled(responsePromises);
        visibilityResults.push(...resultsForThisQuestion);
    }
    const visibilityDuration = visibilityTimer.elapsed();
    const dataGatheringDuration = dataGatheringTimer.elapsed();
    const successfulVisibilityResponses = visibilityResults.filter(r => r.status === 'fulfilled').length;
    
    log({ 
        runId, 
        stage: 'DATA_GATHERING', 
        step: 'VISIBILITY_COMPLETE',
        duration: visibilityDuration,
        metadata: { 
            successfulResponses: successfulVisibilityResponses,
            totalExpectedResponses: allQuestions.length * visibilityModels.length,
            questionsProcessed: allQuestions.length,
            modelsUsed: visibilityModels.length
        }
    }, `Visibility responses completed: ${successfulVisibilityResponses} successful responses`);
    
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
            competitorsGenerated: generatedCompetitors.length,
            sentimentModelsSucceeded: successfulSentiments,
            visibilityResponsesSucceeded: successfulVisibilityResponses
        }
    }, 'Data gathering phase completed');

    // --- Stage 2: Data Writing (Database-Intensive) ---
    // A single, long-running transaction to write all gathered data.
    const dbTransactionTimer = new Timer();
    log({ runId, stage: 'DATABASE_WRITE', step: 'START' }, 'STARTING DATABASE WRITE PHASE - Saving all generated content');
    await prisma.$transaction(async (tx) => {
        // 2.1: Write Competitors
        const competitorWriteTimer = new Timer();
        log({ runId, stage: 'DATABASE_WRITE', step: 'COMPETITORS_START' }, 'Processing and writing competitors', 'DEBUG');
        
        // Use a normalized name for the key to catch variations like "Company Inc." vs "Company".
        const normalizedExistingCompetitors = new Map(
            fullCompany.competitors.map(c => [normalizeNameForDeduplication(c.name), c])
        );
        const normalizedCompanyName = normalizeNameForDeduplication(fullCompany.name);

        const filteredCompetitors = generatedCompetitors.filter(c => {
            if (!c.website || !c.name) return false;

            const normalizedGeneratedName = normalizeNameForDeduplication(c.name);
            
            // Skip if name is empty, a duplicate of the user's company, or a duplicate of an existing competitor.
            return normalizedGeneratedName &&
                   normalizedGeneratedName !== normalizedCompanyName &&
                   !normalizedExistingCompetitors.has(normalizedGeneratedName);
        });

        // Filter out duplicates within the newly generated list itself.
        const uniqueNewCompetitors: CompetitorInfo[] = [];
        const seenNewCompetitorNames = new Set<string>();

        for (const competitor of filteredCompetitors) {
            const normalized = normalizeNameForDeduplication(competitor.name);
            if (!seenNewCompetitorNames.has(normalized)) {
                uniqueNewCompetitors.push(competitor);
                seenNewCompetitorNames.add(normalized);
            }
        }
        
        log({ 
            runId, 
            stage: 'DATABASE_WRITE', 
            step: 'COMPETITORS_FILTERED',
            metadata: { 
                generatedCount: generatedCompetitors.length,
                existingCount: fullCompany.competitors.length,
                newUniqueCount: uniqueNewCompetitors.length,
                filteredOut: generatedCompetitors.length - uniqueNewCompetitors.length
            }
        }, `Filtered competitors: ${uniqueNewCompetitors.length} new unique out of ${generatedCompetitors.length} generated`, 'DEBUG');
        
        if (uniqueNewCompetitors.length > 0) {
            await tx.competitor.createMany({
                data: uniqueNewCompetitors.map(c => ({
                    name: c.name,
                    website: c.website!,
                    companyId: fullCompany!.id,
                    isGenerated: true,
                })),
                skipDuplicates: true // Still useful as a final safeguard
            });
            
            const competitorWriteDuration = competitorWriteTimer.elapsed();
            log({ 
                runId, 
                stage: 'DATABASE_WRITE', 
                step: 'COMPETITORS_WRITTEN',
                duration: competitorWriteDuration,
                metadata: { 
                    writtenCount: uniqueNewCompetitors.length,
                    competitors: uniqueNewCompetitors.map(c => ({ name: c.name, website: c.website }))
                }
            }, `Successfully wrote ${uniqueNewCompetitors.length} new competitors to database`);
        } else {
            log({ 
                runId, 
                stage: 'DATABASE_WRITE', 
                step: 'COMPETITORS_SKIPPED',
                duration: competitorWriteTimer.elapsed()
            }, 'No new unique competitors to write - all were duplicates or invalid', 'DEBUG');
        }

        // 2.2: Write Sentiment Scores and Summary
        log({ runId, stage: 'DATABASE_WRITE', step: 'SENTIMENTS_START'}, 'Writing sentiment scores.', 'DEBUG');
        const allSentiments: SentimentScores[] = [];
        for (let i = 0; i < sentimentResults.length; i++) {
            const result = sentimentResults[i];
            const model = sentimentModels[i];
            if (result.status === 'fulfilled') {
                const { data, usage } = result.value;
                allSentiments.push(data);
                totalPromptTokens += usage.promptTokens;
                totalCompletionTokens += usage.completionTokens;
                await tx.metric.create({
                    data: { runId, name: 'Detailed Sentiment Scores', value: data as any, engine: model.id }
                });
            } else {
                log({runId, stage: 'DATABASE_WRITE', step: 'SENTIMENT_MODEL_FAILURE', metadata: { model: model.id, reason: result.reason }}, `Failed to get sentiment from ${model.id}`, 'WARN');
            }
        }
        log({runId, stage: 'DATABASE_WRITE', step: 'SENTIMENTS_COMPLETE', metadata: { count: allSentiments.length}}, `Wrote ${allSentiments.length} sentiment score metrics.`, 'DEBUG');
        if (allSentiments.length > 0) {
            try {
                log({runId, stage: 'DATABASE_WRITE', step: 'SENTIMENT_SUMMARY_START'}, 'Generating overall sentiment summary.', 'DEBUG');
                const { data: summarySentiment, usage } = await generateOverallSentimentSummary(fullCompany.name, allSentiments);
                totalPromptTokens += usage.promptTokens;
                totalCompletionTokens += usage.completionTokens;
                await tx.metric.create({
                    data: {
                        runId,
                        name: 'Detailed Sentiment Scores',
                        value: summarySentiment as unknown as Prisma.InputJsonValue,
                        engine: 'serplexity-summary',
                    }
                });
                log({runId, stage: 'DATABASE_WRITE', step: 'SENTIMENT_SUMMARY_COMPLETE'}, 'Successfully saved overall sentiment summary.', 'DEBUG');
            } catch (error) {
                log({runId, stage: 'DATABASE_WRITE', step: 'SENTIMENT_SUMMARY_ERROR', error }, `Error generating sentiment summary: ${error}`, 'ERROR');
            }
        }

        // 2.3: Write Visibility Responses and Mentions
        log({runId, stage: 'DATABASE_WRITE', step: 'VISIBILITY_WRITE_START'}, 'Writing visibility responses and mentions.', 'DEBUG');
        let successfulVisibilityResponses = 0;
        let successfulBenchmarkResponses = 0;
        let totalMentionsCreated = 0;
        
        const freshCompanyAndCompetitors = await tx.company.findUnique({
            where: { id: fullCompany!.id },
            include: { competitors: true }
        });

        if (!freshCompanyAndCompetitors) {
            log({runId, stage: 'DATABASE_WRITE', step: 'CRITICAL_ERROR' }, `CRITICAL: Company disappeared mid-transaction. Aborting.`, 'ERROR');
            throw new Error(`Company ${fullCompany!.id} not found mid-transaction`);
        }
        
        const allEntities = [
            { id: freshCompanyAndCompetitors.id, name: freshCompanyAndCompetitors.name, isCompany: true, isGenerated: false },
            ...freshCompanyAndCompetitors.competitors.map(c => ({ id: c.id, name: c.name, isCompany: false, isGenerated: c.isGenerated }))
        ];
        const entityIdMap = new Map(allEntities.map(e => [e.name.toLowerCase(), e.id]));

        for (const result of visibilityResults) {
            if (result.status === 'fulfilled') {
                const { questionId, questionType, model, response } = result.value;
                const { data: responseData, usage } = response;
                totalPromptTokens += usage.promptTokens;
                totalCompletionTokens += usage.completionTokens;
                
                const entitiesForMention = allEntities.map(e => ({ id: e.id, name: e.name }));
                const mentions = findMentions(responseData, entitiesForMention);

                if (questionType === 'benchmark') {
                    const dbResponse = await tx.benchmarkResponse.create({
                        data: {
                            runId,
                            benchmarkQuestionId: questionId,
                            engine: model.id,
                            model: model.id,
                            content: responseData,
                        }
                    });
                    successfulBenchmarkResponses++;
                    
                    // Log the actual response content
                    log({runId, stage: 'DATABASE_WRITE', step: 'BENCHMARK_RESPONSE_SAVED', metadata: { 
                        questionId, model: model.id, responseContent: responseData 
                    }}, `Saved benchmark response from ${model.id}`, 'DEBUG');
                    
                    if (mentions.length > 0) {
                        await tx.benchmarkMention.createMany({
                            data: mentions.map(mention => ({
                                benchmarkResponseId: dbResponse.id,
                                companyId: mention.id === freshCompanyAndCompetitors.id ? freshCompanyAndCompetitors.id : null,
                                competitorId: mention.id !== freshCompanyAndCompetitors.id ? mention.id : null,
                                position: mention.position,
                            }))
                        });
                        totalMentionsCreated += mentions.length;
                    }
                } else { // 'visibility'
                    const dbResponse = await tx.visibilityResponse.create({
                        data: {
                            runId,
                            visibilityQuestionId: questionId,
                            engine: model.id,
                            model: model.id,
                            content: responseData,
                        }
                    });
                    successfulVisibilityResponses++;
                    
                    // Log the actual response content
                    log({runId, stage: 'DATABASE_WRITE', step: 'VISIBILITY_RESPONSE_SAVED', metadata: { 
                        questionId, model: model.id, responseContent: responseData 
                    }}, `Saved visibility response from ${model.id}`, 'DEBUG');
                    
                    if (mentions.length > 0) {
                        await tx.visibilityMention.createMany({
                            data: mentions.map(mention => ({
                                visibilityResponseId: dbResponse.id,
                                companyId: mention.id === freshCompanyAndCompetitors.id ? freshCompanyAndCompetitors.id : null,
                                competitorId: mention.id !== freshCompanyAndCompetitors.id ? mention.id : null,
                                position: mention.position,
                            }))
                        });
                        totalMentionsCreated += mentions.length;
                    }
                }
            } else {
                log({runId, stage: 'DATABASE_WRITE', step: 'VISIBILITY_RESPONSE_FAILURE', metadata: { reason: result.reason }}, `Skipping failed visibility response`, 'WARN');
            }
        }
        log(
            {runId, stage: 'DATABASE_WRITE', step: 'VISIBILITY_WRITE_COMPLETE', metadata: { successfulVisibilityResponses, successfulBenchmarkResponses, totalMentionsCreated }}, 
            `Wrote ${successfulVisibilityResponses} visibility, ${successfulBenchmarkResponses} benchmark responses, and ${totalMentionsCreated} mentions.`,
            'DEBUG'
        );

    }, {
        maxWait: LLM_CONFIG.TIMEOUTS.TRANSACTION_MAX_WAIT,
        timeout: LLM_CONFIG.TIMEOUTS.TRANSACTION_TIMEOUT,
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
    }, 'Database transaction completed successfully');

    // --- Stage 3: Data Aggregation & Finalization ---
    const aggregationTimer = new Timer();
    log({ runId, stage: 'FINALIZATION', step: 'AGGREGATION_START' }, 'STARTING FINALIZATION PHASE - Calculating dashboard metrics and completing report');
    
    await calculateAndStoreDashboardData(runId, company.id, prisma);
    
    const aggregationDuration = aggregationTimer.elapsed();
    log({ 
        runId, 
        stage: 'FINALIZATION', 
        step: 'AGGREGATION_COMPLETE',
        duration: aggregationDuration
    }, 'Data aggregation and dashboard calculation completed');

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

const worker = new Worker('report-generation', processJob, {
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

export default worker;