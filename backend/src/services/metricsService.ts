import prisma from '../config/db';
import { Prisma } from '@prisma/client';
import {
  calculateCompetitorRankings,
  calculateTopQuestions,
  calculateSentimentOverTime,
  calculateShareOfVoiceHistory,
} from './dashboardService';

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
  sentimentDetails?: any;
}

/**
 * Compute and persist all dashboard metrics for a completed report
 */
export async function computeAndPersistMetrics(
  reportId: string, 
  companyId: string
): Promise<void> {
  console.log(`[METRICS] Computing metrics for report ${reportId}`);

  // Get all AI models used in this report
  const modelsUsed = await getModelsUsedInReport(reportId);
  
  // Compute metrics for "all" models combined
  const allModelsMetrics = await calculateAllMetrics(reportId, companyId, 'all');
  
  // Compute metrics for each individual model
  const modelMetrics = await Promise.all(
    modelsUsed.map(model => calculateAllMetrics(reportId, companyId, model))
  );

  // Persist all metrics in a transaction
  await prisma.$transaction([
    // Insert "all" models metric
    prisma.reportMetric.upsert({
      where: { reportId_aiModel: { reportId, aiModel: 'all' } },
      update: allModelsMetrics,
      create: { reportId, companyId, aiModel: 'all', ...allModelsMetrics },
    }),
    
    // Insert individual model metrics
    ...modelsUsed.map((model, index) => 
      prisma.reportMetric.upsert({
        where: { reportId_aiModel: { reportId, aiModel: model } },
        update: modelMetrics[index],
        create: { reportId, companyId, aiModel: model, ...modelMetrics[index] },
      })
    ),
  ]);

  console.log(`[METRICS] Successfully persisted metrics for report ${reportId} (${modelsUsed.length + 1} metric rows)`);
}

/**
 * Get all AI models used in a specific report
 */
async function getModelsUsedInReport(reportId: string): Promise<string[]> {
  const [visModels, benchModels, personalModels] = await Promise.all([
    prisma.visibilityResponse.findMany({
      where: { runId: reportId },
      select: { model: true },
      distinct: ['model'],
    }),
    prisma.benchmarkResponse.findMany({
      where: { runId: reportId },
      select: { model: true },
      distinct: ['model'],
    }),
    prisma.personalResponse.findMany({
      where: { runId: reportId },
      select: { model: true },
      distinct: ['model'],
    }),
  ]);

  const allModels = new Set([
    ...visModels.map(r => r.model),
    ...benchModels.map(r => r.model),
    ...personalModels.map(r => r.model),
  ]);

  return Array.from(allModels);
}

/**
 * Calculate all dashboard metrics for a specific report and AI model
 */
async function calculateAllMetrics(
  reportId: string, 
  companyId: string, 
  aiModel: string
): Promise<DashboardMetrics> {
  console.log(`[METRICS] Calculating ALL metrics for report ${reportId}, model: ${aiModel}`);

  const modelFilter = aiModel === 'all' ? undefined : aiModel;

  const [
    shareOfVoiceData,
    inclusionRateData, 
    averagePositionData,
    sentimentData,
    rankingsData,
    sentimentDetailsRows,
    competitorRankings,
    topQuestions,
    sentimentOverTime,
    shareOfVoiceHistory
  ] = await Promise.all([
    calculateBrandShareOfVoice(reportId, companyId, { aiModel: modelFilter }),
    calculateAverageInclusionRate(reportId, companyId, { aiModel: modelFilter }),
    calculateAveragePosition(reportId, companyId, { aiModel: modelFilter }),
    calculateSentimentScore(reportId, companyId, { aiModel: modelFilter }),
    calculateTopRankings(reportId, companyId, { aiModel: modelFilter }),
    prisma.sentimentScore.findMany({
      where: {
        runId: reportId,
        name: 'Detailed Sentiment Scores',
        ...(modelFilter ? { engine: modelFilter } : {})
      },
      orderBy: { createdAt: 'asc' },
    }),
    calculateCompetitorRankings(reportId, companyId, { aiModel: modelFilter }),
    calculateTopQuestions(reportId, companyId, { aiModel: modelFilter }),
    calculateSentimentOverTime(reportId, companyId, { aiModel: modelFilter }),
    calculateShareOfVoiceHistory(reportId, companyId, { aiModel: modelFilter }),
  ]);

  return {
    shareOfVoice: shareOfVoiceData.shareOfVoice,
    shareOfVoiceChange: shareOfVoiceData.change,
    averageInclusionRate: inclusionRateData.rate,
    averageInclusionChange: inclusionRateData.change,
    averagePosition: averagePositionData.position,
    averagePositionChange: averagePositionData.change,
    sentimentScore: sentimentData.score,
    sentimentChange: sentimentData.change,
    topRankingsCount: rankingsData.count,
    rankingsChange: rankingsData.change,
    sentimentDetails: sentimentDetailsRows,
    competitorRankings,
    topQuestions,
    sentimentOverTime,
    shareOfVoiceHistory,
  };
}

// TODO: These calculation functions should be extracted from reportController.ts
// For now, we'll implement simplified versions that follow the same patterns

async function calculateBrandShareOfVoice(
  runId: string, 
  companyId: string, 
  filters?: { aiModel?: string }
): Promise<{ shareOfVoice: number; change: number | null }> {
  const modelFilter = filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {};
  
  // Get all mentions for this run across all response types
  const [visibilityMentions, benchmarkMentions, personalMentions] = await Promise.all([
    prisma.visibilityMention.findMany({
      where: {
        visibilityResponse: { runId, ...modelFilter }
      }
    }),
    prisma.benchmarkMention.findMany({
      where: {
        benchmarkResponse: { runId, ...modelFilter }
      }
    }),
    prisma.personalMention.findMany({
      where: {
        personalResponse: { runId, ...modelFilter }
      }
    }),
  ]);

  const allMentions = [...visibilityMentions, ...benchmarkMentions, ...personalMentions];
  const totalMentions = allMentions.length;
  
  const companyMentions = allMentions.filter(m => m.companyId === companyId).length;

  const shareOfVoice = totalMentions > 0 ? (companyMentions / totalMentions) * 100 : 0;

  // Calculate change from previous report's pre-computed metrics
  let change: number | null = null;
  
  const previousRun = await prisma.reportRun.findFirst({
    where: {
      companyId,
      status: 'COMPLETED',
      id: { not: runId }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      reportMetrics: {
        where: {
          aiModel: filters?.aiModel || 'all'
        },
        select: { shareOfVoice: true }
      }
    }
  });

  if (previousRun?.reportMetrics[0]) {
    change = shareOfVoice - previousRun.reportMetrics[0].shareOfVoice;
  }

  return { shareOfVoice, change };
}

async function calculateAverageInclusionRate(
  runId: string, 
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ rate: number; change: number | null }> {
  const modelFilter = filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {};
  
  // Get total questions and questions with company mentions from all response types
  const [
    totalVisibility, totalBenchmark, totalPersonal,
    mentionedVisibility, mentionedBenchmark, mentionedPersonal
  ] = await Promise.all([
    prisma.visibilityResponse.count({ where: { runId, ...modelFilter } }),
    prisma.benchmarkResponse.count({ where: { runId, ...modelFilter } }),
    prisma.personalResponse.count({ where: { runId, ...modelFilter } }),
    prisma.visibilityResponse.count({
      where: { runId, ...modelFilter, mentions: { some: { companyId } } }
    }),
    prisma.benchmarkResponse.count({
      where: { runId, ...modelFilter, benchmarkMentions: { some: { companyId } } }
    }),
    prisma.personalResponse.count({
      where: { runId, ...modelFilter, mentions: { some: { companyId } } }
    }),
  ]);

  const totalQuestions = totalVisibility + totalBenchmark + totalPersonal;
  const questionsWithMentions = mentionedVisibility + mentionedBenchmark + mentionedPersonal;

  const rate = totalQuestions > 0 ? (questionsWithMentions / totalQuestions) * 100 : 0;
  
  // Calculate change from previous report's pre-computed metrics
  let change: number | null = null;
  
  const previousRun = await prisma.reportRun.findFirst({
    where: {
      companyId,
      status: 'COMPLETED',
      id: { not: runId }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      reportMetrics: {
        where: {
          aiModel: filters?.aiModel || 'all'
        },
        select: { averageInclusionRate: true }
      }
    }
  });

  if (previousRun?.reportMetrics[0]) {
    change = rate - previousRun.reportMetrics[0].averageInclusionRate;
  }

  return { rate, change };
}

async function calculateAveragePosition(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ position: number; change: number | null }> {
  const modelFilter = filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {};
  
  // Get all mentions for the company in this run from all response types
  const [visibilityMentions, benchmarkMentions, personalMentions] = await Promise.all([
    prisma.visibilityMention.findMany({
      where: {
        companyId,
        visibilityResponse: { runId, ...modelFilter }
      },
      select: { position: true }
    }),
    prisma.benchmarkMention.findMany({
        where: {
            companyId,
            benchmarkResponse: { runId, ...modelFilter }
        },
        select: { position: true }
    }),
    prisma.personalMention.findMany({
        where: {
            companyId,
            personalResponse: { runId, ...modelFilter }
        },
        select: { position: true }
    })
  ]);

  const mentions = [...visibilityMentions, ...benchmarkMentions, ...personalMentions];
  
  const position = mentions.length > 0 
    ? mentions.reduce((sum, m) => sum + m.position, 0) / mentions.length
    : 0;

  // Calculate change from previous report's pre-computed metrics
  let change: number | null = null;
  
  const previousRun = await prisma.reportRun.findFirst({
    where: {
      companyId,
      status: 'COMPLETED',
      id: { not: runId }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      reportMetrics: {
        where: {
          aiModel: filters?.aiModel || 'all'
        },
        select: { averagePosition: true }
      }
    }
  });

  if (previousRun?.reportMetrics[0]) {
    change = position - previousRun.reportMetrics[0].averagePosition;
  }

  return { position, change };
}

async function calculateSentimentScore(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ score: number | null; change: number | null }> {
  // Retrieve "Detailed Sentiment Scores" metric rows for this run
  const where: Prisma.SentimentScoreWhereInput = {
    runId,
    name: 'Detailed Sentiment Scores',
  };
  if (filters?.aiModel && filters.aiModel !== 'all') {
    where.engine = filters.aiModel; // engine column stores the model id
  }

  const sentimentRows = await prisma.sentimentScore.findMany({ where });

  if (sentimentRows.length === 0) {
    return { score: null, change: null };
  }

  // Extract quality ratings and calculate average (1–10 scale)
  const ratings: number[] = [];
  for (const row of sentimentRows) {
    try {
      const parsed = row.value as any;
      const ratingObjects = Array.isArray(parsed) ? parsed : parsed?.ratings ?? [];
      for (const r of ratingObjects) {
        if (typeof r.quality === 'number') ratings.push(r.quality);
      }
    } catch (err) {
      // Ignore malformed data
    }
  }

  if (ratings.length === 0) {
    return { score: null, change: null };
  }

  const score = ratings.reduce((sum, v) => sum + v, 0) / ratings.length;

  // Calculate change from previous report
  let change: number | null = null;
  const previousRun = await prisma.reportRun.findFirst({
    where: {
      companyId,
      status: 'COMPLETED',
      id: { not: runId },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      reportMetrics: {
        where: {
          aiModel: filters?.aiModel || 'all',
        },
        select: { sentimentScore: true },
      },
    },
  });

  if (previousRun?.reportMetrics[0] && previousRun.reportMetrics[0].sentimentScore !== null) {
    change = score - previousRun.reportMetrics[0].sentimentScore!;
  }

  return { score, change };
}

async function calculateTopRankings(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string }
): Promise<{ count: number | null; change: number | null }> {
  const modelFilter = filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {};

  // Count mentions in top 3 positions
  const [
    topVisibilityMentions,
    topBenchmarkMentions,
    topPersonalMentions,
  ] = await Promise.all([
    prisma.visibilityMention.count({
      where: {
        position: { in: [1, 2, 3] },
        visibilityResponse: { runId, ...modelFilter },
        companyId: companyId,
      }
    }),
    prisma.benchmarkMention.count({
      where: {
        position: { in: [1, 2, 3] },
        benchmarkResponse: { runId, ...modelFilter },
        companyId: companyId,
      }
    }),
    prisma.personalMention.count({
      where: {
        position: { in: [1, 2, 3] },
        personalResponse: { runId, ...modelFilter },
        companyId: companyId,
      }
    }),
  ]);

  const count = topVisibilityMentions + topBenchmarkMentions + topPersonalMentions;

  // Calculate change
  let change: number | null = null;
  const previousRun = await prisma.reportRun.findFirst({
    where: {
      companyId,
      status: 'COMPLETED',
      id: { not: runId }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      reportMetrics: {
        where: {
          aiModel: filters?.aiModel || 'all'
        },
        select: { topRankingsCount: true }
      }
    }
  });

  if (previousRun?.reportMetrics[0]?.topRankingsCount !== null && previousRun?.reportMetrics[0]?.topRankingsCount !== undefined) {
    change = count - previousRun.reportMetrics[0].topRankingsCount;
  }

  return { count, change };
}

/**
 * Retrieve all pre-computed metrics for dashboard display, including complex objects.
 */
export async function getFullReportMetrics(
  reportId: string,
  aiModel: string = 'all'
): Promise<DashboardMetrics | null> {
  const metric = await prisma.reportMetric.findUnique({
    where: { reportId_aiModel: { reportId, aiModel } }
    // No `select` needed, so all scalar and JSON fields are returned by default
  });

  if (!metric) return null;

  // The 'metric' object now contains all fields from the ReportMetric model,
  // including the JSON fields. We can cast it to our DashboardMetrics type.
  // Note: This assumes the JSON structures in the DB match what DashboardMetrics expects.
  return metric as unknown as DashboardMetrics;
} 