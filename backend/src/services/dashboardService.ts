/**
 * Lightweight, fan-out-based dashboard helpers.
 * NOTE: These are intentionally minimal – full analytics are now computed
 *       during the async metrics pipeline and stored in the ReportMetric table.
 */

/**
 * @file dashboardService.ts
 * @description This file provides functions for calculating and retrieving dashboard-related metrics.
 * It includes functions for calculating competitor rankings, top questions, share of voice history, and sentiment over time.
 * It prioritizes fetching pre-computed metrics from the `ReportMetric` table for performance, falling back to on-the-fly
 * calculations from raw data if necessary. It also includes utility functions for saving historical data points.
 *
 * @dependencies
 * - ../config/db: The singleton Prisma client instance.
 *
 * @exports
 * - calculateCompetitorRankings: Calculates competitor rankings based on mentions.
 * - calculateTopQuestions: Calculates top-ranking questions based on company mentions.
 * - calculateTopResponses: Calculates response-level data for questions, including position and mentions.
 * - calculateShareOfVoiceHistory: Retrieves historical share of voice data.
 * - calculateSentimentOverTime: Retrieves historical sentiment data.
 * - saveShareOfVoiceHistoryPoint: Saves a historical share of voice data point.
 * - saveSentimentOverTimePoint: Saves a historical sentiment data point.
 */
import prisma, { prismaReadReplica } from '../config/db';

export async function calculateCompetitorRankings(runId: string, companyId: string, filters?: { aiModel?: string }) {
  // Prefer pre-computed competitorRankings if present
  const metric = await prismaReadReplica.reportMetric.findFirst({
    where: { reportId: runId, aiModel: (filters?.aiModel ?? 'all') },
    select: { competitorRankings: true }
  });

  if (metric?.competitorRankings) {
    return metric.competitorRankings as any;
  }

  // Fallback – compute simple SoV via FanoutMention
  const company = await prismaReadReplica.company.findUnique({
    where: { id: companyId },
    include: { competitors: true },
  });
  if (!company) return { competitors: [], chartCompetitors: [], industryRanking: null, userCompany: null };

  const competitorIds = company.competitors.map(c => c.id);

  const mentions = await prismaReadReplica.fanoutMention.findMany({
    where: {
      fanoutResponse: {
        runId,
        ...(filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {}),
      },
      OR: [{ companyId }, { competitorId: { in: competitorIds } }],
    },
    select: { companyId: true, competitorId: true },
  });

  const counts = new Map<string, number>();
  counts.set(companyId, 0);
  competitorIds.forEach(id => counts.set(id, 0));

  mentions.forEach(m => {
    const id = m.companyId ?? m.competitorId;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;

  const ranked = Array.from(counts.entries())
    .map(([id, cnt]) => {
      const isUserCompany = id === companyId;
      const competitor = company.competitors.find(c => c.id === id);
      return {
        id,
        name: isUserCompany ? company.name : competitor?.name ?? 'Unknown',
        website: isUserCompany ? company.website : competitor?.website,
        shareOfVoice: (cnt / total) * 100,
        isUserCompany,
      };
    })
    .sort((a, b) => b.shareOfVoice - a.shareOfVoice);

  return {
    competitors: ranked.filter(r => !r.isUserCompany),
    chartCompetitors: ranked,
    industryRanking: ranked.findIndex(r => r.isUserCompany) + 1,
    userCompany: ranked.find(r => r.isUserCompany) || null,
  };
}

export async function calculateTopQuestions(runId?: string, companyId?: string, filters?: { aiModel?: string; questionType?: string }, limit: number = 20, skip: number = 0) {
  if (!runId || !companyId) {
    return { questions: [], totalCount: 0 };
  }

  // If metrics were pre-computed into ReportMetric.topQuestions, prefer that first
  const preComputed = await prismaReadReplica.reportMetric.findFirst({
    where: {
      reportId: runId,
      aiModel: filters?.aiModel ?? 'all',
    },
    select: { topQuestions: true },
  });

  if (preComputed?.topQuestions && Array.isArray(preComputed.topQuestions) && preComputed.topQuestions.length > 0) {
    console.log(`[calculateTopQuestions] Using pre-computed data for ${runId}, aiModel: ${filters?.aiModel ?? 'all'}`);
    let questions = preComputed.topQuestions;
    
    // Debug: Check for questions without mentions in pre-computed data
    const questionsWithoutMentions = questions.filter((q: any) => q.bestPosition === null);
    console.log(`[calculateTopQuestions] Pre-computed data: ${questions.length} total, ${questionsWithoutMentions.length} without mentions`);
    if (questionsWithoutMentions.length > 0) {
      console.log(`[calculateTopQuestions] Sample no-mention questions:`, questionsWithoutMentions.slice(0, 3).map((q: any) => ({
        question: q.question?.substring(0, 30),
        bestPosition: q.bestPosition,
        totalMentions: q.totalMentions
      })));
    }
    
    // Apply questionType filter on pre-computed data if provided
    if (filters?.questionType && filters.questionType !== 'all') {
      questions = questions.filter((q: any) => q.type === filters.questionType);
    }
    
    const totalCount = questions.length;
    const sliced = questions.slice(skip, skip + limit);
    console.log(`[calculateTopQuestions] Pre-computed result: ${sliced.length} questions after pagination (skip: ${skip}, limit: ${limit})`);
    return { questions: sliced, totalCount } as any;
  }

  console.log(`[calculateTopQuestions] Using on-the-fly calculation for ${runId}, aiModel: ${filters?.aiModel ?? 'all'}`);

  // On-the-fly calculation from fan-out tables (may be slower but keeps UI functional)

  // Build where clause for fanout questions
  const questionWhere: any = { companyId };
  
  // Apply questionType filter if provided
  if (filters?.questionType && filters.questionType !== 'all') {
    questionWhere.type = filters.questionType;
  }

  // Fetch relevant fanout questions with their responses & company mentions
  const questions = await prismaReadReplica.fanoutQuestion.findMany({
    where: questionWhere,
    select: {
      id: true,
      text: true,
      type: true,
      responses: {
        where: {
          runId,
          ...(filters?.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {}),
        },
        select: {
          id: true,
          model: true,
          content: true,
          createdAt: true,
          mentions: {
            where: { companyId },
            select: { position: true },
          },
        },
      },
    },
  });

  // Transform into TopRankingQuestion shape
  type Q = {
    id: string;
    question: string;
    type: string;
    bestPosition: number | null; // Allow null for questions with no mentions
    totalMentions: number;
    averagePosition: number | null; // Allow null for questions with no mentions
    bestResponse: string;
    bestResponseModel: string;
    productName?: string | null;
    responses: Array<{ model: string; response: string; position?: number | null; createdAt?: string }>;
  };

  const transformed: Q[] = [];

  for (const q of questions) {
    const companyMentionsPerResponse = q.responses.map(r => ({
      response: r,
      positions: r.mentions.map(m => m.position),
    }));

    // Always include the question, even if company was never mentioned
    let bestPos: number | null = null;
    let bestResp: typeof companyMentionsPerResponse[number] | null = null;
    let totalPositions: number[] = [];

    // Find best position among responses that mention the company
    const responsesWithMentions = companyMentionsPerResponse.filter(r => r.positions.length > 0);
    
    if (responsesWithMentions.length > 0) {
      // Company was mentioned - find best position
      for (const { response, positions } of responsesWithMentions) {
        const minPos = Math.min(...positions);
        if (bestPos === null || minPos < bestPos) {
          bestPos = minPos;
          bestResp = { response, positions };
        }
        totalPositions.push(...positions);
      }
    }

    // If no mentions found, use the first response as best response
    if (!bestResp && q.responses.length > 0) {
      bestResp = { response: q.responses[0], positions: [] };
    }

    if (!bestResp) continue; // Skip if no responses at all

    const avgPos = totalPositions.length > 0 ? totalPositions.reduce((a, b) => a + b, 0) / totalPositions.length : null;

    const questionData = {
      id: q.id,
      question: q.text,
      type: q.type,
      bestPosition: bestPos, // Will be null if no mentions
      totalMentions: totalPositions.length,
      averagePosition: avgPos, // Will be null if no mentions
      bestResponse: bestResp.response.content,
      bestResponseModel: bestResp.response.model,
      responses: q.responses.map(r => ({
        model: r.model,
        response: r.content,
        position: r.mentions.find(m => m.position !== undefined)?.position || null, // null if no mention
        createdAt: r.createdAt?.toISOString?.() ?? undefined,
      })),
    };

    // Debug log for questions with suspicious rankings
    if (bestPos === null && totalPositions.length === 0) {
      console.log(`[calculateTopQuestions] Question without mentions: "${q.text.substring(0, 50)}" - bestPosition: ${bestPos}, totalMentions: ${totalPositions.length}`);
    }

    transformed.push(questionData);
  }

  // Sort by best position asc (nulls last), then totalMentions desc
  transformed.sort((a, b) => {
    // Put questions with mentions first, ordered by bestPosition (question-level ranking)
    if (a.bestPosition !== null && b.bestPosition !== null) {
      return a.bestPosition - b.bestPosition;
    }
    if (a.bestPosition !== null && b.bestPosition === null) {
      return -1; // a has mentions, b doesn't - a comes first
    }
    if (a.bestPosition === null && b.bestPosition !== null) {
      return 1; // b has mentions, a doesn't - b comes first
    }
    // Both have no mentions - sort by total mentions count, then alphabetically
    if (a.totalMentions !== b.totalMentions) {
      return b.totalMentions - a.totalMentions;
    }
    return a.question.localeCompare(b.question);
  });

  const totalCount = transformed.length;
  const paginated = transformed.slice(skip, skip + limit);

  console.log(`[calculateTopQuestions] On-the-fly result: ${totalCount} total questions, ${paginated.length} after pagination (skip: ${skip}, limit: ${limit})`);
  
  return { questions: paginated, totalCount };
}

/**
 * NEW 10x APPROACH: Return response-level granularity instead of question-level aggregation
 * This gives the frontend one row per (question, model) combination, enabling:
 * - All 4 responses for benchmark questions
 * - Proper N/A display for questions with no mentions
 * - Accurate limits that aren't artificially capped by question count
 */
export async function calculateTopResponses(
  runId?: string,
  companyId?: string,
  filters: { aiModel?: string; questionType?: string } = {},
  limit: number = 1000,
  skip: number = 0
) {
  if (!runId || !companyId) {
    return { responses: [], totalCount: 0 };
  }

  console.log(`[calculateTopResponses] Computing response-level data for ${runId}, filters:`, filters);

  // Build where clauses
  const whereResponse: any = {
    runId,
    ...(filters.aiModel && filters.aiModel !== 'all' ? { model: filters.aiModel } : {})
  };

  const whereQuestion: any = {
    companyId,
    ...(filters.questionType && filters.questionType !== 'all' ? { type: filters.questionType } : {})
  };

  // Get all responses with their questions and mentions
  const responses = await prismaReadReplica.fanoutResponse.findMany({
    where: {
      ...whereResponse,
      fanoutQuestion: whereQuestion
    },
    include: {
      fanoutQuestion: {
        select: { id: true, text: true, type: true }
      },
      mentions: {
        where: { companyId },
        select: { position: true }
      }
    },
    orderBy: [
      { fanoutQuestion: { text: 'asc' } },
      { model: 'asc' }
    ]
  });

  console.log(`[calculateTopResponses] Found ${responses.length} total responses before pagination`);

  // Pre-compute best position per question for ranking
  const questionBestPosition = new Map<string, number>();
  responses.forEach(r => {
    if (r.mentions.length > 0) {
      const minPos = Math.min(...r.mentions.map(m => m.position));
      const current = questionBestPosition.get(r.fanoutQuestionId);
      if (current === undefined || minPos < current) {
        questionBestPosition.set(r.fanoutQuestionId, minPos);
      }
    }
  });

  // Transform to flat response format
  type FlatResponse = {
    id: string;              // questionId
    question: string;
    type: string;
    model: string;
    response: string;
    position: number | null; // this model's position (or null)
    bestPosition: number | null; // question-level best across all models
    createdAt: string;
  };

  const flatResponses: FlatResponse[] = responses.map(r => ({
    id: r.fanoutQuestionId,
    question: r.fanoutQuestion!.text,
    type: r.fanoutQuestion!.type,
    model: r.model,
    response: r.content,
    position: r.mentions.length > 0 ? Math.min(...r.mentions.map(m => m.position)) : null,
    bestPosition: questionBestPosition.get(r.fanoutQuestionId) ?? null,
    createdAt: r.createdAt.toISOString()
  }));

  // Sort: primary by bestPosition (nulls last), secondary by question text, tertiary by model
  flatResponses.sort((a, b) => {
    // Primary sort: questions with mentions (bestPosition !== null) come first
    if (a.bestPosition !== null && b.bestPosition !== null) {
      // Both have mentions - sort by best position (ascending = rank 1 first)
      const posDiff = a.bestPosition - b.bestPosition;
      if (posDiff !== 0) return posDiff;
    } else if (a.bestPosition !== null && b.bestPosition === null) {
      return -1; // a has mentions, b doesn't - a comes first
    } else if (a.bestPosition === null && b.bestPosition !== null) {
      return 1; // b has mentions, a doesn't - b comes first
    }
    // If both have no mentions (bestPosition === null), continue to secondary sort

    // Secondary sort by question text
    const questionDiff = a.question.localeCompare(b.question);
    if (questionDiff !== 0) return questionDiff;

    // Tertiary sort by model
    return a.model.localeCompare(b.model);
  });

  const totalCount = flatResponses.length;
  const paginated = flatResponses.slice(skip, skip + limit);

  console.log(`[calculateTopResponses] Response-level result: ${totalCount} total responses, ${paginated.length} after pagination (skip: ${skip}, limit: ${limit})`);
  
  // Debug stats
  const responsesWithMentions = flatResponses.filter(r => r.position !== null).length;
  const responsesWithoutMentions = flatResponses.filter(r => r.position === null).length;
  console.log(`[calculateTopResponses] Breakdown: ${responsesWithMentions} with mentions, ${responsesWithoutMentions} without mentions (N/A)`);

  return { responses: paginated, totalCount };
}

// runId is ignored in new pipeline but kept for backward compatibility
export async function calculateShareOfVoiceHistory(_runId: string, companyId: string, filters?: { aiModel?: string }) {
  const whereClause: any = { companyId };
  
  // Apply aiModel filter if provided
  if (filters?.aiModel && filters.aiModel !== 'all') {
    whereClause.aiModel = filters.aiModel;
  }
  
  const history = await prismaReadReplica.shareOfVoiceHistory.findMany({
    where: whereClause,
    orderBy: { date: 'asc' },
  });
  return history;
}

export async function calculateSentimentOverTime(_runId: string, companyId: string, filters?: { aiModel?: string }) {
  const whereClause: any = { companyId };
  
  // Apply aiModel filter if provided
  if (filters?.aiModel && filters.aiModel !== 'all') {
    whereClause.aiModel = filters.aiModel;
  }
  
  const history = await prismaReadReplica.sentimentOverTime.findMany({
    where: whereClause,
    orderBy: { date: 'asc' },
  });
  return history;
}

// New utility functions to save data to normalized tables
export async function saveShareOfVoiceHistoryPoint(
    companyId: string,
    date: Date,
    aiModel: string,
    shareOfVoice: number,
    reportRunId?: string
): Promise<void> {
    if (!reportRunId) {
        console.warn(`[saveShareOfVoiceHistoryPoint] reportRunId is missing for company ${companyId}. Skipping save.`);
        return;
    }
    // Normalize date to day precision
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    await prisma.shareOfVoiceHistory.upsert({
        where: {
            companyId_date_aiModel: {
                companyId,
                date: normalizedDate,
                aiModel
            }
        },
        update: {
            shareOfVoice,
            reportRunId,
            updatedAt: new Date()
        },
        create: {
            companyId,
            date: normalizedDate,
            aiModel,
            shareOfVoice,
            reportRunId
        }
    });
}

export async function saveSentimentOverTimePoint(
    companyId: string,
    date: Date,
    aiModel: string,
    sentimentScore: number,
    reportRunId?: string
): Promise<void> {
    if (!reportRunId) {
        console.warn(`[saveSentimentOverTimePoint] reportRunId is missing for company ${companyId}. Skipping save.`);
        return;
    }
    // Normalize date to day precision
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    await prisma.sentimentOverTime.upsert({
        where: {
            companyId_date_aiModel: {
                companyId,
                date: normalizedDate,
                aiModel
            }
        },
        update: {
            sentimentScore,
            reportRunId,
            updatedAt: new Date()
        },
        create: {
            companyId,
            date: normalizedDate,
            aiModel,
            sentimentScore,
            reportRunId
        }
    });
} 