import prisma, { prismaReadReplica } from '../config/db';
import { Prisma, ReportMetric } from '@prisma/client';
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

async function getPreviousReportMetric(
  companyId: string,
  currentReportId: string,
  aiModel: string
): Promise<ReportMetric | null> {
  const previousReportRun = await prismaReadReplica.reportRun.findFirst({
    where: {
      companyId,
      id: { not: currentReportId },
      status: 'COMPLETED',
      reportMetrics: {
        some: {
          aiModel,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  if (!previousReportRun) {
    return null;
  }

  return prismaReadReplica.reportMetric.findUnique({
    where: {
      reportId_aiModel: {
        reportId: previousReportRun.id,
        aiModel,
      },
    },
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

  const aiModel = filters?.aiModel ?? 'all';
  const previousMetric = await getPreviousReportMetric(companyId, runId, aiModel);
  const change = previousMetric ? shareOfVoice - previousMetric.shareOfVoice : null;

  return { shareOfVoice, change };
}

// --- NEW METRIC CALCULATIONS --------------------------------------------------

async function calculateAverageInclusionRate(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ rate: number; change: number | null }> {
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

  const rate = totalQuestions.size > 0 ? (includedQuestions.size / totalQuestions.size) * 100 : 0;

  const aiModel = filters?.aiModel ?? 'all';
  const previousMetric = await getPreviousReportMetric(companyId, runId, aiModel);
  const change = previousMetric ? rate - previousMetric.averageInclusionRate : null;

  return { rate, change };
}

async function calculateAveragePosition(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ position: number; change: number | null }> {
  const mentions = await getMentions(runId, filters);
  const companyPositions = mentions
    .filter(m => m.companyId === companyId)
    .map(m => m.position);

  if (companyPositions.length === 0) return { position: 0, change: null };

  const avgPos = companyPositions.reduce((a, b) => a + b, 0) / companyPositions.length;

  const aiModel = filters?.aiModel ?? 'all';
  const previousMetric = await getPreviousReportMetric(companyId, runId, aiModel);
  let change: number | null = null;
  if (previousMetric && previousMetric.averagePosition && previousMetric.averagePosition > 0) {
    change = avgPos - previousMetric.averagePosition;
  }

  return { position: avgPos, change };
}

async function calculateTopRankings(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ count: number; change: number | null }> {
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
  const aiModel = filters?.aiModel ?? 'all';
  const previousMetric = await getPreviousReportMetric(companyId, runId, aiModel);
  const change = previousMetric && previousMetric.topRankingsCount !== null ? count - previousMetric.topRankingsCount : null;

  return { count, change };
}

export async function computeAndPersistMetrics(reportId: string, companyId: string): Promise<void> {
  try {
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
      value: s.value,
    }));

    // ====== Fetch Previous Report Metrics ======
    const previousOverallMetric = await getPreviousReportMetric(companyId, reportId, 'all');

    // ====== Compute Metrics for "all" models ======
    console.log('[METRICS] Computing for "all" models...');

    const [
      { shareOfVoice: allSoV, change: allSoVChange },
      { rate: allInclusionRate, change: allInclusionChange },
      { position: allAvgPos, change: allAvgPosChange },
      { count: allTopRankings, change: allRankingsChange },
    ] = await Promise.all([
      calculateBrandShareOfVoice(reportId, companyId, { aiModel: 'all' }),
      calculateAverageInclusionRate(reportId, companyId, { aiModel: 'all' }),
      calculateAveragePosition(reportId, companyId, { aiModel: 'all' }),
      calculateTopRankings(reportId, companyId, { aiModel: 'all' }),
    ]);
    
    // ====== Compute and Enrich Competitor Rankings ======
    console.log('[METRICS] Computing and enriching competitor rankings...');
    const competitorRankings = await calculateCompetitorRankings(reportId, companyId, { aiModel: 'all' });
    
    // Enrich with change metric
    if (previousOverallMetric?.competitorRankings && (previousOverallMetric.competitorRankings as any).chartCompetitors) {
      const previousCompetitors = (previousOverallMetric.competitorRankings as any).chartCompetitors;
      
      for (const competitor of competitorRankings.chartCompetitors) {
        const prevCompData = previousCompetitors.find((pc: any) => pc.id === competitor.id);
        if (prevCompData) {
          competitor.change = competitor.shareOfVoice - prevCompData.shareOfVoice;
          competitor.changeType = competitor.change > 0 ? 'increase' : (competitor.change < 0 ? 'decrease' : 'stable');
        } else {
          competitor.change = 0; // Or null if you prefer to show no change for new competitors
          competitor.changeType = 'stable';
        }
      }
    }


    // ====== Compute Top Questions for "all" models ======
    const topQuestions = await calculateTopQuestions(reportId, companyId, { aiModel: 'all' });

    // Compute overall sentimentScore using the summary engine if available, otherwise first entry
    let overallSentimentScore: number | null = null;
    const summary = rawSentiments.find(s => s.engine === 'serplexity-summary');
    if (summary) {
      overallSentimentScore = getAverage(summary.value as any);
    } else if (rawSentiments.length > 0) {
      overallSentimentScore = getAverage(rawSentiments[0].value as any);
    }

    // Calculate sentiment change
    const overallSentimentChange =
      previousOverallMetric && previousOverallMetric.sentimentScore !== null && overallSentimentScore !== null
        ? overallSentimentScore - previousOverallMetric.sentimentScore
        : null;

    // Also index by engine for easy lookup later
    const sentimentByEngine = new Map<string, number>();
    rawSentiments.forEach(s => sentimentByEngine.set(s.engine || '', getAverage(s.value as any)));

    /******************************
     * EXISTING METRICS LOGIC
     ******************************/
    const models = await getModelsUsedInReport(reportId);

    await prisma.reportMetric.upsert({
      where: { reportId_aiModel: { reportId, aiModel: 'all' } },
      update: {
        shareOfVoice: allSoV,
        shareOfVoiceChange: allSoVChange,
        averageInclusionRate: allInclusionRate,
        averageInclusionChange: allInclusionChange,
        averagePosition: allAvgPos,
        averagePositionChange: allAvgPosChange,
        topRankingsCount: allTopRankings,
        rankingsChange: allRankingsChange,
        sentimentScore: overallSentimentScore,
        sentimentChange: overallSentimentChange,
        competitorRankings: competitorRankings,
        topQuestions: topQuestions,
        sentimentDetails: sentimentDetails,
      },
      create: {
        reportId,
        companyId,
        aiModel: 'all',
        shareOfVoice: allSoV,
        shareOfVoiceChange: allSoVChange,
        averageInclusionRate: allInclusionRate,
        averageInclusionChange: allInclusionChange,
        averagePosition: allAvgPos,
        averagePositionChange: allAvgPosChange,
        topRankingsCount: allTopRankings,
        rankingsChange: allRankingsChange,
        sentimentScore: overallSentimentScore,
        sentimentChange: overallSentimentChange,
        competitorRankings: competitorRankings,
        topQuestions: topQuestions,
        sentimentDetails: sentimentDetails,
      },
    });

    // Save sentiment over time point for overall if we have a score
    if (overallSentimentScore !== null) {
      await saveSentimentOverTimePoint(companyId, new Date(), 'all', overallSentimentScore, reportId);
    }

    // Save share of voice history point for overall
    await saveShareOfVoiceHistoryPoint(companyId, new Date(), 'all', allSoV, reportId);

    /******************************
     * Per-model metrics
     ******************************/
    for (const model of models) {
      console.log(`[METRICS] Computing for model "${model}"...`);

      const [
        { shareOfVoice, change: sovChange },
        { rate, change: inclusionChange },
        { position, change: avgPosChange },
        { count, change: rankingsChange },
      ] = await Promise.all([
        calculateBrandShareOfVoice(reportId, companyId, { aiModel: model }),
        calculateAverageInclusionRate(reportId, companyId, { aiModel: model }),
        calculateAveragePosition(reportId, companyId, { aiModel: model }),
        calculateTopRankings(reportId, companyId, { aiModel: model }),
      ]);

      const modelSentiment = getAverage(rawSentiments.find(s => s.engine === model)?.value);
      const previousModelMetric = await getPreviousReportMetric(companyId, reportId, model);
      const modelSentimentChange = previousModelMetric?.sentimentScore ? modelSentiment - previousModelMetric.sentimentScore : null;

      // Also compute and enrich competitor rankings for the specific model
      const compRankModel = await calculateCompetitorRankings(reportId, companyId, { aiModel: model });
      if (previousModelMetric?.competitorRankings && (previousModelMetric.competitorRankings as any).chartCompetitors) {
          const previousCompetitors = (previousModelMetric.competitorRankings as any).chartCompetitors;
          for (const competitor of compRankModel.chartCompetitors) {
              const prevCompData = previousCompetitors.find((pc: any) => pc.id === competitor.id);
              if (prevCompData) {
                  competitor.change = competitor.shareOfVoice - prevCompData.shareOfVoice;
                  competitor.changeType = competitor.change > 0 ? 'increase' : (competitor.change < 0 ? 'decrease' : 'stable');
              } else {
                  competitor.change = 0;
                  competitor.changeType = 'stable';
              }
          }
      }
      
      const topQuestionsModel = await calculateTopQuestions(reportId, companyId, { aiModel: model });

      await prisma.reportMetric.upsert({
        where: { reportId_aiModel: { reportId, aiModel: model } },
        update: {
          shareOfVoice,
          shareOfVoiceChange: sovChange,
          averageInclusionRate: rate,
          averageInclusionChange: inclusionChange,
          averagePosition: position,
          averagePositionChange: avgPosChange,
          topRankingsCount: count,
          rankingsChange,
          sentimentScore: modelSentiment,
          sentimentChange: modelSentimentChange,
          competitorRankings: compRankModel,
          topQuestions: topQuestionsModel,
        },
        create: {
          reportId,
          companyId,
          aiModel: model,
          shareOfVoice,
          shareOfVoiceChange: sovChange,
          averageInclusionRate: rate,
          averageInclusionChange: inclusionChange,
          averagePosition: position,
          averagePositionChange: avgPosChange,
          topRankingsCount: count,
          rankingsChange,
          sentimentScore: modelSentiment,
          sentimentChange: modelSentimentChange,
          competitorRankings: compRankModel,
          topQuestions: topQuestionsModel,
          sentimentDetails: [],
        },
      });

      if (modelSentiment !== null) {
        await saveSentimentOverTimePoint(companyId, new Date(), model, modelSentiment, reportId);
      }

      // Save share of voice history point for this model
      await saveShareOfVoiceHistoryPoint(companyId, new Date(), model, shareOfVoice, reportId);
    }
  } catch (error) {
    console.error(`[METRICS] Failed to compute and persist metrics for report ${reportId}:`, error);
    // Optionally re-throw or handle as needed, for now just logging
    // Re-throwing would cause the worker to see the error immediately
    throw error;
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