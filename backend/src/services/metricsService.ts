import prisma, { prismaReadReplica } from '../config/db';
import { Prisma } from '@prisma/client';
import { calculateTopQuestions, calculateCompetitorRankings, saveSentimentOverTimePoint, saveShareOfVoiceHistoryPoint, calculateTopResponses } from './dashboardService';

// ===== UTILITY HELPERS FOR NEW FAN-OUT MODEL =====

// Count distinct models used in a report
async function getModelsUsedInReport(runId: string): Promise<string[]> {
  const models = await prismaReadReplica.fanoutResponse.findMany({
    where: { runId },
    select: { model: true },
    distinct: ['model'],
  });
  return models.map(m => m.model);
}

// Fetch all mentions for a run (optionally filter by model)
async function getMentions(
  runId: string,
  filters?: { aiModel?: string }
): Promise<Prisma.FanoutMentionGetPayload<{ include: { fanoutResponse: true } }>[]> {
  return prismaReadReplica.fanoutMention.findMany({
    where: {
      fanoutResponse: {
        runId,
        ...(filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {}),
      },
    },
    include: { fanoutResponse: true },
  });
}

// ====== METRIC CALCULATIONS (SIMPLIFIED) ======

export interface DashboardMetrics {
  shareOfVoice: number;
  shareOfVoiceChange: number | null;
  averageInclusionRate: number;
  averageInclusionChange: number | null;
  averagePosition: number;
  averagePositionChange: number | null;
  sentimentScore: number | null;
  sentimentChange: number | null;
  topRankingsCount: number | null;
  rankingsChange: number | null;
  competitorRankings: any;
  topQuestions: any;
  sentimentOverTime: any;
  shareOfVoiceHistory: any;
  sentimentDetails?: Array<{
    name: string;
    engine: string;
    value: {
      ratings: Array<{
        quality: number;
        priceValue: number;
        brandReputation: number;
        brandTrust: number;
        customerService: number;
        summaryDescription: string;
      }>;
    };
  }>;
}

// Placeholder: until sentiment pipeline is refactored we return nulls
async function calculateSentimentScore(): Promise<{ score: null; change: null }> {
  return { score: null, change: null };
}

// The following helper computes Share of Voice and related metrics directly from FanoutMention
async function calculateBrandShareOfVoice(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ shareOfVoice: number; change: number | null }> {
  const mentions = await getMentions(runId, filters);
  const total = mentions.length;
  const companyMentions = mentions.filter(m => m.companyId === companyId).length;
  const shareOfVoice = total === 0 ? 0 : (companyMentions / total) * 100;
  return { shareOfVoice, change: null }; // historical change calculation removed for now
}

// --- NEW METRIC CALCULATIONS --------------------------------------------------

async function calculateAverageInclusionRate(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ rate: number; change: null }> {
  // Fetch all responses for this run / model
  const responses = await prismaReadReplica.fanoutResponse.findMany({
    where: {
      runId,
      ...(filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {}),
    },
    select: {
      fanoutQuestionId: true,
      id: true,
      mentions: {
        where: { companyId },
        select: { id: true },
      },
    },
  });

  if (responses.length === 0) return { rate: 0, change: null };

  const totalQuestions = new Set<string>();
  const includedQuestions = new Set<string>();

  for (const r of responses) {
    totalQuestions.add(r.fanoutQuestionId);
    if (r.mentions.length > 0) {
      includedQuestions.add(r.fanoutQuestionId);
    }
  }

  const rate = (includedQuestions.size / totalQuestions.size) * 100;
  return { rate, change: null };
}

async function calculateAveragePosition(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ position: number; change: null }> {
  const mentions = await getMentions(runId, filters);
  const companyPositions = mentions
    .filter(m => m.companyId === companyId)
    .map(m => m.position);

  if (companyPositions.length === 0) return { position: 0, change: null };

  const avgPos = companyPositions.reduce((a, b) => a + b, 0) / companyPositions.length;
  return { position: avgPos, change: null };
}

async function calculateTopRankings(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ count: number; change: null }> {
  // Group mentions by question -> min position
  const mentions = await getMentions(runId, filters);
  const questionBestPos = new Map<string, number>();
  for (const m of mentions) {
    if (m.companyId !== companyId) continue;
    const qId = m.fanoutResponse.fanoutQuestionId;
    const prev = questionBestPos.get(qId);
    if (prev === undefined || m.position < prev) {
      questionBestPos.set(qId, m.position);
    }
  }
  let count = 0;
  for (const pos of questionBestPos.values()) {
    if (pos === 1) count++;
  }
  return { count, change: null };
}

export async function computeAndPersistMetrics(reportId: string, companyId: string): Promise<void> {
  console.log(`[METRICS] Computing metrics for report ${reportId}`);

  /******************************
   * NEW: Fetch sentiment scores
   ******************************/
  const rawSentiments = await prismaReadReplica.sentimentScore.findMany({
    where: { runId: reportId, name: 'Detailed Sentiment Scores' },
    select: {
      engine: true,
      value: true,
      name: true,
    },
  });

  // Helper to compute average numeric score (0-10) from a sentiment value
  const getAverage = (val: any): number => {
    if (!val?.ratings?.length) return 0;
    const r = val.ratings[0];
    const nums = [r.quality, r.priceValue, r.brandReputation, r.brandTrust, r.customerService].filter((n: any) => typeof n === 'number');
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  // Build sentimentDetails array (same structure the frontend expects)
  const sentimentDetails = rawSentiments.map(s => ({
    name: s.name,
    engine: s.engine || '',
    value: s.value as any,
  }));

  // Compute overall sentimentScore using the summary engine if available, otherwise first entry
  let overallSentimentScore: number | null = null;
  const summary = rawSentiments.find(s => s.engine === 'serplexity-summary');
  if (summary) {
    overallSentimentScore = getAverage(summary.value as any);
  } else if (rawSentiments.length > 0) {
    overallSentimentScore = getAverage(rawSentiments[0].value as any);
  }

  // Also index by engine for easy lookup later
  const sentimentByEngine = new Map<string, number>();
  rawSentiments.forEach(s => sentimentByEngine.set(s.engine || '', getAverage(s.value as any)));

  /******************************
   * EXISTING METRICS LOGIC
   ******************************/
  const models = await getModelsUsedInReport(reportId);

  // Compute metrics for overall ('all')
  const overall = await calculateBrandShareOfVoice(reportId, companyId);
  const inclusionOverall = await calculateAverageInclusionRate(reportId, companyId);
  const positionOverall = await calculateAveragePosition(reportId, companyId);
  const topOverall = await calculateTopRankings(reportId, companyId);

  // Compute complex objects once (overall only)
  const competitorRankings = await calculateCompetitorRankings(reportId, companyId, { aiModel: 'all' });
  const topQ = await calculateTopResponses(reportId, companyId, { aiModel: 'all' }, 1000, 0);

  await prisma.reportMetric.upsert({
    where: { reportId_aiModel: { reportId, aiModel: 'all' } },
    update: {
      shareOfVoice: overall.shareOfVoice,
      shareOfVoiceChange: overall.change,
      averageInclusionRate: inclusionOverall.rate,
      averagePosition: positionOverall.position,
      topRankingsCount: topOverall.count,
      competitorRankings: competitorRankings,
      topQuestions: (topQ as any).responses ?? [],
      // NEW fields
      sentimentDetails: sentimentDetails,
      sentimentScore: overallSentimentScore,
    },
    create: {
      reportId,
      companyId,
      aiModel: 'all',
      shareOfVoice: overall.shareOfVoice,
      shareOfVoiceChange: overall.change,
      averageInclusionRate: inclusionOverall.rate,
      averagePosition: positionOverall.position,
      topRankingsCount: topOverall.count,
      competitorRankings: competitorRankings,
      topQuestions: (topQ as any).responses ?? [],
      // NEW fields
      sentimentDetails: sentimentDetails,
      sentimentScore: overallSentimentScore,
    },
  });

  // Save sentiment over time point for overall if we have a score
  if (overallSentimentScore !== null) {
    await saveSentimentOverTimePoint(companyId, new Date(), 'all', overallSentimentScore, reportId);
  }

  // Save share of voice history point for overall
  await saveShareOfVoiceHistoryPoint(companyId, new Date(), 'all', overall.shareOfVoice, reportId);

  /******************************
   * Per-model metrics
   ******************************/
  for (const model of models) {
    const sv = await calculateBrandShareOfVoice(reportId, companyId, { aiModel: model });
    const inc = await calculateAverageInclusionRate(reportId, companyId, { aiModel: model });
    const pos = await calculateAveragePosition(reportId, companyId, { aiModel: model });
    const top = await calculateTopRankings(reportId, companyId, { aiModel: model });

    const compRankModel = await calculateCompetitorRankings(reportId, companyId, { aiModel: model });
    const topQModel = await calculateTopResponses(reportId, companyId, { aiModel: model }, 1000, 0);

    const modelSentimentScore = sentimentByEngine.get(model) ?? null;
    const modelSentimentDetails = sentimentDetails.filter(d => d.engine === model);

    await prisma.reportMetric.upsert({
      where: { reportId_aiModel: { reportId, aiModel: model } },
      update: {
        shareOfVoice: sv.shareOfVoice,
        shareOfVoiceChange: sv.change,
        averageInclusionRate: inc.rate,
        averagePosition: pos.position,
        topRankingsCount: top.count,
        competitorRankings: compRankModel,
        topQuestions: (topQModel as any).responses ?? [],
        // NEW fields
        sentimentDetails: modelSentimentDetails,
        sentimentScore: modelSentimentScore,
      },
      create: {
        reportId,
        companyId,
        aiModel: model,
        shareOfVoice: sv.shareOfVoice,
        shareOfVoiceChange: sv.change,
        averageInclusionRate: inc.rate,
        averagePosition: pos.position,
        topRankingsCount: top.count,
        competitorRankings: compRankModel,
        topQuestions: (topQModel as any).responses ?? [],
        // NEW fields
        sentimentDetails: modelSentimentDetails,
        sentimentScore: modelSentimentScore,
      },
    });

    if (modelSentimentScore !== null) {
      await saveSentimentOverTimePoint(companyId, new Date(), model, modelSentimentScore, reportId);
    }

    // Save share of voice history point for this model
    await saveShareOfVoiceHistoryPoint(companyId, new Date(), model, sv.shareOfVoice, reportId);
  }
}

/**
 * Retrieve all pre-computed metrics for dashboard display, including complex objects.
 */
export async function getFullReportMetrics(
  reportId: string,
  aiModel: string = 'all'
): Promise<DashboardMetrics | null> {
  const metric = await prismaReadReplica.reportMetric.findUnique({
    where: { reportId_aiModel: { reportId, aiModel } }
    // No `select` needed, so all scalar and JSON fields are returned by default
  });

  if (!metric) return null;

  // The 'metric' object now contains all fields from the ReportMetric model,
  // including the JSON fields. We can cast it to our DashboardMetrics type.
  // Note: This assumes the JSON structures in the DB match what DashboardMetrics expects.
  return metric as unknown as DashboardMetrics;
} 