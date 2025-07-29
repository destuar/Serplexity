/**
 * @file metricsService.ts
 * @description This file is responsible for computing and persisting various performance metrics for reports,
 * both overall and per AI model. It calculates metrics like Share of Voice, Average Inclusion Rate, Average Position,
 * and Top Rankings, and stores them in the `ReportMetric` table. It also integrates with `dashboardService` to save
 * historical data points. This is a crucial component for providing comprehensive analytics and insights to users.
 *
 * @dependencies
 * - ../config/db: The singleton Prisma client instance.
 * - @prisma/client: Prisma client types.
 * - ./dashboardService: Service for calculating dashboard data and saving historical points.
 *
 * @exports
 * - computeAndPersistMetrics: Computes and persists all relevant metrics for a given report.
 * - getFullReportMetrics: Retrieves all pre-computed metrics for dashboard display.
 */
import { getDbClient, getReadDbClient } from "../config/database";
import { ReportMetric, Prisma } from "@prisma/client";
import {
  calculateTopQuestions,
  calculateCompetitorRankings,
  calculateCitationRankings,
  saveSentimentOverTimePoint,
  saveShareOfVoiceHistoryPoint,
  saveInclusionRateHistoryPoint,
} from "./dashboardService";

// Type definitions for metrics data structures
interface SentimentRating {
  ratings: Array<{
    quality: number;
    priceValue: number;
    brandReputation: number;
    brandTrust: number;
    customerService: number;
    summaryDescription: string;
  }>;
}

interface CompetitorData {
  id: string;
  shareOfVoice: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'stable';
}

interface CompetitorRankings {
  chartCompetitors: CompetitorData[];
  citationRankings?: unknown;
}

interface MentionRecord {
  id: string;
  entityId: string;
  entityType: string;
  position: number;
  response?: {
    id: string;
    model: string;
  };
}

// Type guards for JSON data
function isSentimentRating(value: unknown): value is SentimentRating {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ratings' in value &&
    Array.isArray((value as { ratings?: unknown }).ratings)
  );
}

function isCompetitorRankings(value: unknown): value is CompetitorRankings {
  return (
    typeof value === 'object' &&
    value !== null &&
    'chartCompetitors' in value &&
    Array.isArray((value as { chartCompetitors?: unknown }).chartCompetitors)
  );
}

// ===== UTILITY HELPERS FOR NEW FAN-OUT MODEL =====

// Count distinct models used in a report
async function getModelsUsedInReport(runId: string): Promise<string[]> {
  const prismaReadReplica = await getReadDbClient();
  const models = await prismaReadReplica.response.findMany({
    where: { runId },
    select: { model: true },
    distinct: ["model"],
  });
  return models.map((m) => m.model);
}

// Count mentions for a specific entity (company or competitor)
async function getMentions(
  runId: string,
  filters?: { aiModel?: string; companyId?: string; competitorId?: string },
): Promise<MentionRecord[]> {
  const prismaReadReplica = await getReadDbClient();
  
  // CRITICAL FIX: Handle Perplexity model name variations
  let modelFilter = {};
  if (filters?.aiModel && filters.aiModel !== "all") {
    // Handle both "perplexity" and "sonar" model names
    if (filters.aiModel === "perplexity") {
      modelFilter = { model: { in: ["perplexity", "sonar"] } };
    } else if (filters.aiModel === "sonar") {
      modelFilter = { model: { in: ["sonar", "perplexity"] } };
    } else {
      modelFilter = { model: filters.aiModel };
    }
  }

  console.log(`🔍 [METRICS DEBUG] getMentions - runId: ${runId}, aiModel: ${filters?.aiModel || "all"}, modelFilter:`, modelFilter);

  const mentions = await prismaReadReplica.mention.findMany({
    where: {
      response: {
        runId,
        ...modelFilter,
      },
      ...(filters?.companyId ? { companyId: filters.companyId } : {}),
      ...(filters?.competitorId ? { competitorId: filters.competitorId } : {}),
    },
    include: {
      response: {
        select: { model: true, engine: true }
      }
    }
  });

  console.log(`🔍 [METRICS DEBUG] Found ${mentions.length} mentions for runId: ${runId}, aiModel: ${filters?.aiModel || "all"}`);
  
  // Debug: Log model distribution in mentions
  const modelCounts = mentions.reduce((acc, mention) => {
    const model = mention.response?.model || 'unknown';
    acc[model] = (acc[model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`🔍 [METRICS DEBUG] Model distribution in mentions:`, modelCounts);

  return mentions.map(m => ({
    id: m.id,
    entityId: m.companyId || m.competitorId || '',
    entityType: m.companyId ? 'company' : 'competitor',
    position: m.position,
    response: m.response ? { id: m.response.model, model: m.response.model } : undefined
  }));
}

// Helper to fetch previous report metric for change calculations
async function getPreviousReportMetric(
  companyId: string,
  currentRunId: string,
  aiModel: string,
): Promise<ReportMetric | null> {
  const prismaReadReplica = await getReadDbClient();
  return await prismaReadReplica.reportMetric.findFirst({
    where: {
      companyId,
      reportId: { not: currentRunId },
      aiModel,
    },
    orderBy: { createdAt: "desc" },
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
  sentimentScore: SentimentRating | null;
  sentimentChange: number | null;
  topRankingsCount: number | null;
  rankingsChange: number | null;
  competitorRankings: CompetitorRankings;
  citationRankings: unknown;
  topQuestions: unknown;
  sentimentOverTime: unknown;
  shareOfVoiceHistory: unknown;
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

// The following helper computes Share of Voice and related metrics directly from FanoutMention
async function calculateBrandShareOfVoice(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string },
): Promise<{ shareOfVoice: number; change: number | null }> {
  console.log(`📊 [SOV DEBUG] Calculating share of voice - runId: ${runId}, companyId: ${companyId}, aiModel: ${filters?.aiModel || "all"}`);
  
  const mentions = await getMentions(runId, filters);
  const total = mentions.length;
  const companyMentions = mentions.filter(
    (m) => m.entityType === 'company' && m.entityId === companyId,
  ).length;
  const competitorMentions = mentions.filter(
    (m) => m.entityType === 'competitor',
  ).length;
  
  const shareOfVoice = total === 0 ? 0 : (companyMentions / total) * 100;

  console.log(`📊 [SOV DEBUG] Results - Total mentions: ${total}, Company mentions: ${companyMentions}, Competitor mentions: ${competitorMentions}, Share of Voice: ${shareOfVoice.toFixed(2)}%`);

  const aiModel = filters?.aiModel ?? "all";
  const previousMetric = await getPreviousReportMetric(
    companyId,
    runId,
    aiModel,
  );
  const change = previousMetric
    ? shareOfVoice - previousMetric.shareOfVoice
    : null;

  console.log(`📊 [SOV DEBUG] Previous metric: ${previousMetric?.shareOfVoice || "none"}, Change: ${change || "none"}`);

  return { shareOfVoice, change };
}

// Average Inclusion Rate: how often company is mentioned across all responses
async function calculateAverageInclusionRate(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string },
): Promise<{ rate: number; change: number | null }> {
  const prismaReadReplica = await getReadDbClient();
  const responses = await prismaReadReplica.response.findMany({
    where: {
      runId,
      ...(filters?.aiModel && filters.aiModel !== "all"
        ? { model: filters.aiModel }
        : {}),
    },
    include: {
      mentions: {
        where: { companyId },
      },
    },
  });

  const total = responses.length;
  const responsesWithMentions = responses.filter(
    (r) => r.mentions.length > 0,
  ).length;
  const rate = total === 0 ? 0 : (responsesWithMentions / total) * 100;

  const aiModel = filters?.aiModel ?? "all";
  const previousMetric = await getPreviousReportMetric(
    companyId,
    runId,
    aiModel,
  );
  const change = previousMetric
    ? rate - previousMetric.averageInclusionRate
    : null;

  return { rate, change };
}

// Average Position: average ranking when mentioned
async function calculateAveragePosition(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string },
): Promise<{ position: number; change: number | null }> {
  const mentions = await getMentions(runId, { ...filters, companyId });
  const positions = mentions.map((m) => m.position).filter((p) => p != null);
  const position =
    positions.length === 0
      ? 0
      : positions.reduce((a, b) => a + b, 0) / positions.length;

  const aiModel = filters?.aiModel ?? "all";
  const previousMetric = await getPreviousReportMetric(
    companyId,
    runId,
    aiModel,
  );
  const change = previousMetric
    ? position - previousMetric.averagePosition
    : null;

  return { position, change };
}

// Top Rankings: count of #1 positions
async function calculateTopRankings(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string },
): Promise<{ count: number; change: number | null }> {
  const mentions = await getMentions(runId, { ...filters, companyId });
  const count = mentions.filter((m) => m.position === 1).length;

  const aiModel = filters?.aiModel ?? "all";
  const previousMetric = await getPreviousReportMetric(
    companyId,
    runId,
    aiModel,
  );
  const change = previousMetric
    ? count - (previousMetric.topRankingsCount ?? 0)
    : null;

  return { count, change };
}

function getAverage(sentimentRating: SentimentRating): number | null {
  if (
    !sentimentRating ||
    !sentimentRating.ratings ||
    !Array.isArray(sentimentRating.ratings) ||
    sentimentRating.ratings.length === 0
  ) {
    return null;
  }

  const rating = sentimentRating.ratings[0];
  if (!rating) return null;

  const values = [
    rating.quality,
    rating.priceValue,
    rating.brandReputation,
    rating.brandTrust,
    rating.customerService,
  ].filter((v) => typeof v === "number" && !isNaN(v));

  return values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

export async function computeAndPersistMetrics(
  reportId: string,
  companyId: string,
  userTimezone?: string,
): Promise<void> {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();

  try {
    // Get user timezone from company if not provided
    let timezone = userTimezone;
    if (!timezone) {
      // For now, default to UTC. Later we can add timezone to user profile
      timezone = 'UTC';
    }

    console.log(
      `[METRICS] Starting computation for report ${reportId}, company ${companyId}, timezone: ${timezone}`,
    );

    // ====== Get all models used in this report ======
    const models = await getModelsUsedInReport(reportId);
    console.log(`[METRICS] Found models: ${models.join(", ")}`);

    // ====== Fetch previous metrics for change calculations ======
    const previousOverallMetric = await getPreviousReportMetric(
      companyId,
      reportId,
      "all",
    );

    console.log(
      `[METRICS] Previous overall metric: ${previousOverallMetric ? "found" : "not found"}`,
    );

    // ====== Retrieve sentiment scores for overall sentiment calculation ======
    const rawSentiments = await prismaReadReplica.sentimentScore.findMany({
      where: {
        runId: reportId,
        name: "Detailed Sentiment Scores",
      },
      select: {
        engine: true,
        value: true,
        name: true,
      },
    });

    console.log(`[METRICS] Found ${rawSentiments.length} sentiment scores`);

    /******************************
     * Overall metrics (all models)
     ******************************/

    const [
      { shareOfVoice: allSoV, change: allSoVChange },
      { rate: allInclusionRate, change: allInclusionChange },
      { position: allAvgPos, change: allAvgPosChange },
      { count: allTopRankings, change: allRankingsChange },
    ] = await Promise.all([
      calculateBrandShareOfVoice(reportId, companyId, { aiModel: "all" }),
      calculateAverageInclusionRate(reportId, companyId, { aiModel: "all" }),
      calculateAveragePosition(reportId, companyId, { aiModel: "all" }),
      calculateTopRankings(reportId, companyId, { aiModel: "all" }),
    ]);

    // ====== Compute and Enrich Competitor Rankings ======
    console.log("[METRICS] Computing and enriching competitor rankings...");
    const competitorRankings = await calculateCompetitorRankings(
      reportId,
      companyId,
      { aiModel: "all" },
    );

    // Enrich with change metric
    if (
      previousOverallMetric?.competitorRankings &&
      isCompetitorRankings(previousOverallMetric.competitorRankings)
    ) {
      const previousCompetitors = previousOverallMetric.competitorRankings.chartCompetitors;

      if (isCompetitorRankings(competitorRankings)) {
        for (const competitor of competitorRankings.chartCompetitors) {
          const prevCompData = previousCompetitors.find(
            (pc: CompetitorData) => pc.id === competitor.id,
          );
          if (prevCompData) {
            competitor.change =
              competitor.shareOfVoice - prevCompData.shareOfVoice;
            competitor.changeType =
              competitor.change > 0
                ? "increase"
                : competitor.change < 0
                  ? "decrease"
                  : "stable";
          } else {
            competitor.change = 0; // Or null if you prefer to show no change for new competitors
            competitor.changeType = "stable";
          }
        }
      }
    }

    // ====== Compute Citation Rankings ======
    console.log("[METRICS] Computing citation rankings...");
    const citationRankings = await calculateCitationRankings(
      reportId,
      companyId,
      { aiModel: "all" },
    );

    // Add citation rankings to competitor rankings object for storage
    const enhancedCompetitorRankings = isCompetitorRankings(competitorRankings) ? {
      ...competitorRankings,
      citationRankings,
    } : {
      chartCompetitors: [],
      citationRankings,
    };

    // ====== Compute Top Questions for "all" models ======
    const topQuestions = await calculateTopQuestions(reportId, companyId, {
      aiModel: "all",
    });

    // Compute overall sentimentScore using the summary engine if available, otherwise first entry
    let overallSentimentScore: SentimentRating | null = null;
    let overallSentimentChange: number | null = null;

    // Look for summary engine first
    const summaryEngineData = rawSentiments.find(
      (s) => s.engine === "serplexity-summary",
    );
    if (summaryEngineData && isSentimentRating(summaryEngineData.value)) {
      overallSentimentScore = summaryEngineData.value;
    } else if (rawSentiments.length > 0 && isSentimentRating(rawSentiments[0].value)) {
      // Fallback to first available engine
      overallSentimentScore = rawSentiments[0].value;
    }

    // Calculate sentiment change based on average values for comparison
    if (
      overallSentimentScore !== null &&
      previousOverallMetric?.sentimentScore &&
      isSentimentRating(previousOverallMetric.sentimentScore)
    ) {
      const currentAvg = getAverage(overallSentimentScore);
      const previousAvg = getAverage(previousOverallMetric.sentimentScore);
      if (currentAvg !== null && previousAvg !== null) {
        overallSentimentChange = currentAvg - previousAvg;
      }
    }

    // Transform sentiment details for storage
    const sentimentDetails = rawSentiments.map((s) => ({
      name: s.name,
      engine: s.engine || "",
      value: s.value,
    }));

    await prisma.reportMetric.upsert({
      where: { reportId_aiModel: { reportId, aiModel: "all" } },
      update: {
        shareOfVoice: allSoV,
        shareOfVoiceChange: allSoVChange,
        averageInclusionRate: allInclusionRate,
        averageInclusionChange: allInclusionChange,
        averagePosition: allAvgPos,
        averagePositionChange: allAvgPosChange,
        topRankingsCount: allTopRankings,
        rankingsChange: allRankingsChange,
        sentimentScore: overallSentimentScore as Prisma.InputJsonValue,
        sentimentChange: overallSentimentChange,
        competitorRankings: JSON.parse(JSON.stringify(enhancedCompetitorRankings)) as Prisma.InputJsonValue,
        topQuestions: topQuestions.questions,
        sentimentDetails: sentimentDetails,
      },
      create: {
        reportId,
        companyId,
        aiModel: "all",
        shareOfVoice: allSoV,
        shareOfVoiceChange: allSoVChange,
        averageInclusionRate: allInclusionRate,
        averageInclusionChange: allInclusionChange,
        averagePosition: allAvgPos,
        averagePositionChange: allAvgPosChange,
        topRankingsCount: allTopRankings,
        rankingsChange: allRankingsChange,
        sentimentScore: overallSentimentScore as Prisma.InputJsonValue,
        sentimentChange: overallSentimentChange,
        competitorRankings: JSON.parse(JSON.stringify(enhancedCompetitorRankings)) as Prisma.InputJsonValue,
        topQuestions: topQuestions.questions,
        sentimentDetails: sentimentDetails,
      },
    });

    // Save sentiment over time point for overall if we have a score (use average for historical tracking)
    if (overallSentimentScore !== null) {
      const avgSentiment = getAverage(overallSentimentScore);
      if (avgSentiment !== null) {
        await saveSentimentOverTimePoint(
          companyId,
          new Date(),
          "all",
          avgSentiment,
          reportId,
          timezone,
        );
      }
    }

    // Save share of voice history point for overall
    await saveShareOfVoiceHistoryPoint(
      companyId,
      new Date(),
      "all",
      allSoV,
      reportId,
      timezone,
    );

    // Save inclusion rate history point for overall
    await saveInclusionRateHistoryPoint(
      companyId,
      new Date(),
      "all",
      allInclusionRate,
      reportId,
      timezone,
    );

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

      const modelSentimentData = rawSentiments.find(
        (s) => s.engine === model,
      )?.value;
      const modelSentiment = modelSentimentData || null;
      const previousModelMetric = await getPreviousReportMetric(
        companyId,
        reportId,
        model,
      );

      // Calculate sentiment change based on average values for comparison
      let modelSentimentChange: number | null = null;
      if (modelSentiment && previousModelMetric?.sentimentScore && isSentimentRating(modelSentiment) && isSentimentRating(previousModelMetric.sentimentScore)) {
        const currentAvg = getAverage(modelSentiment);
        const previousAvg = getAverage(previousModelMetric.sentimentScore);
        if (currentAvg !== null && previousAvg !== null) {
          modelSentimentChange = currentAvg - previousAvg;
        }
      }

      // Build model-specific sentiment details
      const modelSentimentDetails = rawSentiments
        .filter((s) => s.engine === model)
        .map((s) => ({
          name: s.name,
          engine: s.engine || "",
          value: s.value,
        }));

      // Also compute and enrich competitor rankings for the specific model
      const compRankModel = await calculateCompetitorRankings(
        reportId,
        companyId,
        { aiModel: model },
      );
      if (
        previousModelMetric?.competitorRankings &&
        isCompetitorRankings(previousModelMetric.competitorRankings)
      ) {
        const previousCompetitors = previousModelMetric.competitorRankings.chartCompetitors;
        if (isCompetitorRankings(compRankModel)) {
          for (const competitor of compRankModel.chartCompetitors) {
            const prevCompData = previousCompetitors.find(
              (pc: CompetitorData) => pc.id === competitor.id,
            );
            if (prevCompData) {
              competitor.change =
                competitor.shareOfVoice - prevCompData.shareOfVoice;
              competitor.changeType =
                competitor.change > 0
                  ? "increase"
                  : competitor.change < 0
                    ? "decrease"
                    : "stable";
            } else {
              competitor.change = 0;
              competitor.changeType = "stable";
            }
          }
        }
      }

      // Compute citation rankings for the specific model
      const citationRankingsModel = await calculateCitationRankings(
        reportId,
        companyId,
        { aiModel: model },
      );

      // Add citation rankings to competitor rankings object for storage
      const enhancedCompRankModel = isCompetitorRankings(compRankModel) ? {
        ...compRankModel,
        citationRankings: citationRankingsModel,
      } : {
        chartCompetitors: [],
        citationRankings: citationRankingsModel,
      };

      const topQuestionsModel = await calculateTopQuestions(
        reportId,
        companyId,
        { aiModel: model },
      );

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
          sentimentScore: modelSentiment ?? undefined,
          sentimentChange: modelSentimentChange,
          competitorRankings: JSON.parse(JSON.stringify(enhancedCompRankModel)) as Prisma.InputJsonValue,
          topQuestions: topQuestionsModel.questions,
          sentimentDetails: modelSentimentDetails,
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
          sentimentScore: modelSentiment ?? undefined,
          sentimentChange: modelSentimentChange,
          competitorRankings: JSON.parse(JSON.stringify(enhancedCompRankModel)) as Prisma.InputJsonValue,
          topQuestions: topQuestionsModel.questions,
          sentimentDetails: modelSentimentDetails,
        },
      });

      if (modelSentiment !== null && isSentimentRating(modelSentiment)) {
        const avgModelSentiment = getAverage(modelSentiment);
        if (avgModelSentiment !== null) {
          await saveSentimentOverTimePoint(
            companyId,
            new Date(),
            model,
            avgModelSentiment,
            reportId,
            timezone,
          );
        }
      }

      // Save share of voice history point for this model
      await saveShareOfVoiceHistoryPoint(
        companyId,
        new Date(),
        model,
        shareOfVoice,
        reportId,
        timezone,
      );

      // Save inclusion rate history point for this model
      await saveInclusionRateHistoryPoint(
        companyId,
        new Date(),
        model,
        rate,
        reportId,
        timezone,
      );
    }
  } catch (error) {
    console.error(
      `[METRICS] Failed to compute and persist metrics for report ${reportId}:`,
      error,
    );
    // Optionally re-throw or handle as needed, for now just logging
    // Re-throwing would cause the worker to see the error immediately
    throw error;
  }
}

/**
 * Retrieves all pre-computed metrics for a report run for display on dashboard.
 * Returns null if no metrics found.
 */
export async function getFullReportMetrics(
  reportId: string,
  aiModel: string = "all",
): Promise<DashboardMetrics | null> {
  const prismaReadReplica = await getReadDbClient();
  const metric = await prismaReadReplica.reportMetric.findFirst({
    where: { reportId, aiModel },
  });

  if (!metric) return null;

  const citationRankings =
    metric.competitorRankings &&
    isCompetitorRankings(metric.competitorRankings) &&
    metric.competitorRankings.citationRankings
      ? metric.competitorRankings.citationRankings
      : null;

  return {
    shareOfVoice: metric.shareOfVoice,
    shareOfVoiceChange: metric.shareOfVoiceChange,
    averageInclusionRate: metric.averageInclusionRate,
    averageInclusionChange: metric.averageInclusionChange,
    averagePosition: metric.averagePosition,
    averagePositionChange: metric.averagePositionChange,
    sentimentScore: isSentimentRating(metric.sentimentScore) ? metric.sentimentScore : null,
    sentimentChange: metric.sentimentChange,
    topRankingsCount: metric.topRankingsCount,
    rankingsChange: metric.rankingsChange,
    competitorRankings: isCompetitorRankings(metric.competitorRankings) ? metric.competitorRankings : { chartCompetitors: [] },
    citationRankings: citationRankings,
    topQuestions: metric.topQuestions,
    sentimentOverTime: null, // Historical data fetched separately
    shareOfVoiceHistory: null, // Historical data fetched separately
    sentimentDetails: metric.sentimentDetails,
  };
}
