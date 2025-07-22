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
 * - calculateCitationRankings: Calculates citation source rankings based on citation domains.
 * - calculateTopQuestions: Calculates top-ranking questions based on company mentions.
 * - calculateTopResponses: Calculates response-level data for questions, including position and mentions.
 * - calculateShareOfVoiceHistory: Retrieves historical share of voice data.
 * - calculateSentimentOverTime: Retrieves historical sentiment data.
 * - saveShareOfVoiceHistoryPoint: Saves a historical share of voice data point.
 * - saveSentimentOverTimePoint: Saves a historical sentiment data point.
 */
import { getDbClient, getReadDbClient } from "../config/database";

/**
 * Normalizes a domain for citation analytics by removing common subdomains and standardizing format
 * Examples:
 * - "https://www.reddit.com/r/programming" -> "reddit.com"
 * - "blog.example.com" -> "example.com"
 * - "en.wikipedia.org" -> "wikipedia.org" (preserves important subdomains)
 * - "support.github.com" -> "github.com"
 */
function normalizeDomainForAnalytics(domain: string): string {
  try {
    // Remove protocol if present
    let normalized = domain.replace(/^https?:\/\//, "");

    // Remove path and query parameters
    normalized = normalized.split("/")[0].split("?")[0].split("#")[0];

    // Convert to lowercase
    normalized = normalized.toLowerCase();

    // Remove common subdomains but preserve important ones
    const importantSubdomains = [
      "en",
      "fr",
      "de",
      "es",
      "it",
      "pt",
      "ru",
      "ja",
      "zh",
      "ko",
    ]; // Language codes
    const parts = normalized.split(".");

    if (parts.length > 2) {
      const subdomain = parts[0];
      const rootParts = parts.slice(-2); // Get last 2 parts (domain.tld)

      // Special cases for important subdomains we want to preserve
      if (
        importantSubdomains.includes(subdomain) ||
        subdomain === "docs" ||
        subdomain === "api" ||
        (parts.length === 3 && rootParts.join(".") === "wikipedia.org")
      ) {
        return parts.slice(-3).join("."); // Keep subdomain.domain.tld
      }

      // For most cases, just use domain.tld
      return rootParts.join(".");
    }

    return normalized;
  } catch (error) {
    // If parsing fails, return the original domain
    console.warn(
      `[normalizeDomainForAnalytics] Failed to normalize domain: ${domain}`,
      error,
    );
    return domain.toLowerCase();
  }
}

export async function calculateCompetitorRankings(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string },
) {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  // Prefer pre-computed competitorRankings if present
  const metric = await prismaReadReplica.reportMetric.findFirst({
    where: { reportId: runId, aiModel: filters?.aiModel ?? "all" },
    select: { competitorRankings: true },
  });

  if (metric?.competitorRankings) {
    return metric.competitorRankings as any;
  }

  // Fallback – compute simple SoV via Mention
  const company = await prismaReadReplica.company.findUnique({
    where: { id: companyId },
    include: { competitors: true }, // Include ALL competitors for comprehensive SoV calculation
  });
  if (!company)
    return {
      competitors: [],
      chartCompetitors: [],
      industryRanking: null,
      userCompany: null,
    };

  const competitorIds = company.competitors.map((c) => c.id);

  const mentions = await prismaReadReplica.mention.findMany({
    where: {
      response: {
        runId,
        ...(filters?.aiModel && filters.aiModel !== "all"
          ? { model: filters.aiModel }
          : {}),
      },
      OR: [{ companyId }, { competitorId: { in: competitorIds } }],
    },
    select: { companyId: true, competitorId: true },
  });

  const counts = new Map<string, number>();
  counts.set(companyId, 0);
  competitorIds.forEach((id) => counts.set(id, 0));

  mentions.forEach((m) => {
    const id = m.companyId ?? m.competitorId;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;

  const ranked = Array.from(counts.entries())
    .map(([id, cnt]) => {
      const isUserCompany = id === companyId;
      const competitor = company.competitors.find((c) => c.id === id);
      return {
        id,
        name: isUserCompany ? company.name : (competitor?.name ?? "Unknown"),
        website: isUserCompany ? company.website : competitor?.website,
        shareOfVoice: (cnt / total) * 100,
        isUserCompany,
      };
    })
    .sort((a, b) => b.shareOfVoice - a.shareOfVoice);

  return {
    competitors: ranked.filter((r) => !r.isUserCompany),
    chartCompetitors: ranked,
    industryRanking: ranked.findIndex((r) => r.isUserCompany) + 1,
    userCompany: ranked.find((r) => r.isUserCompany) || null,
  };
}

export async function calculateCitationRankings(
  runId: string,
  companyId: string,
  filters?: { aiModel?: string },
) {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();

  // Prefer pre-computed citationRankings if present
  const metric = await prismaReadReplica.reportMetric.findFirst({
    where: { reportId: runId, aiModel: filters?.aiModel ?? "all" },
    select: { competitorRankings: true },
  });

  // Check if citation rankings are already computed and stored in competitorRankings
  if (
    metric?.competitorRankings &&
    (metric.competitorRankings as any).citationRankings
  ) {
    return (metric.competitorRankings as any).citationRankings;
  }

  // Fallback – compute citation share of voice via Citation
  const citations = await prismaReadReplica.citation.findMany({
    where: {
      response: {
        runId,
        ...(filters?.aiModel && filters.aiModel !== "all"
          ? { model: filters.aiModel }
          : {}),
      },
    },
    select: { domain: true, url: true, title: true },
  });

  console.log(
    `[calculateCitationRankings] Found ${citations.length} citations for runId: ${runId}, aiModel: ${filters?.aiModel || "all"}`,
  );

  if (citations.length === 0) {
    return { sources: [], chartSources: [], totalCitations: 0 };
  }

  // Group citations by normalized domain for analytics
  const domainCounts = new Map<
    string,
    {
      count: number;
      urls: Set<string>;
      titles: Set<string>;
      originalDomain: string; // Keep original domain for display
      normalizedDomain: string; // For grouping
    }
  >();

  citations.forEach((citation) => {
    const originalDomain = citation.domain;
    const normalizedDomain = normalizeDomainForAnalytics(originalDomain);

    if (!domainCounts.has(normalizedDomain)) {
      domainCounts.set(normalizedDomain, {
        count: 0,
        urls: new Set(),
        titles: new Set(),
        originalDomain: originalDomain, // Use first occurrence as display domain
        normalizedDomain: normalizedDomain,
      });
    }

    const domainData = domainCounts.get(normalizedDomain)!;
    domainData.count += 1;
    domainData.urls.add(citation.url);
    domainData.titles.add(citation.title);
  });

  const total = citations.length;

  const ranked = Array.from(domainCounts.entries())
    .map(([normalizedDomain, data]) => ({
      domain: data.originalDomain, // Display the original domain format
      normalizedDomain: normalizedDomain, // For reference if needed
      name: data.originalDomain,
      shareOfVoice: (data.count / total) * 100,
      citationCount: data.count,
      uniqueUrls: data.urls.size,
      sampleTitle: Array.from(data.titles)[0] || "Web Source",
    }))
    .sort((a, b) => b.shareOfVoice - a.shareOfVoice);

  console.log(
    `[calculateCitationRankings] Computed rankings for ${ranked.length} unique domains from ${citations.length} total citations`,
  );

  // Log top domains for debugging
  ranked.slice(0, 5).forEach((source, index) => {
    console.log(
      `[calculateCitationRankings] #${index + 1}: ${source.domain} (${source.shareOfVoice.toFixed(1)}%, ${source.citationCount} citations)`,
    );
  });

  return {
    sources: ranked,
    chartSources: ranked,
    totalCitations: total,
  };
}

export async function calculateTopQuestions(
  runId?: string,
  companyId?: string,
  filters?: { aiModel?: string; questionType?: string },
  limit: number = 20,
  skip: number = 0,
) {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();

  if (!runId || !companyId) {
    return { questions: [], totalCount: 0 };
  }

  console.log(
    `[calculateTopQuestions] Computing for ${runId}, companyId: ${companyId}, filters:`,
    filters,
  );

  // Build where clauses
  const whereResponse: any = {
    runId,
    ...(filters?.aiModel && filters.aiModel !== "all"
      ? { model: filters.aiModel }
      : {}),
  };

  const whereQuestion: any = {
    companyId,
    ...(filters?.questionType && filters.questionType !== "all"
      ? { type: filters.questionType }
      : {}),
  };

  // Get all questions with their responses and mentions
  const questions = await prismaReadReplica.question.findMany({
    where: whereQuestion,
    include: {
      responses: {
        where: whereResponse,
        include: {
          mentions: {
            where: { companyId },
            select: { position: true },
          },
        },
        orderBy: { model: "asc" },
      },
    },
    orderBy: { query: "asc" },
  });

  console.log(`[calculateTopQuestions] Found ${questions.length} questions`);

  // Transform data: each question gets aggregated metrics across all its responses
  const transformed = [];

  for (const q of questions) {
    if (q.responses.length === 0) {
      continue; // Skip questions with no responses for this filter
    }

    // Collect all positions for this question across all model responses
    const allPositions: number[] = [];
    q.responses.forEach((r) => {
      r.mentions.forEach((m) => {
        if (m.position !== undefined && m.position !== null) {
          allPositions.push(m.position);
        }
      });
    });

    // Calculate aggregated metrics for the question
    const totalPositions = allPositions;
    const bestPos =
      totalPositions.length > 0 ? Math.min(...totalPositions) : null;
    const avgPos =
      totalPositions.length > 0
        ? Math.round(
            (totalPositions.reduce((a, b) => a + b, 0) /
              totalPositions.length) *
              100,
          ) / 100
        : null;

    // Find the response with the best position for this question
    let bestResp = q.responses[0]; // Default to first response
    let bestRespPos = null;

    for (const r of q.responses) {
      const respPositions = r.mentions
        .map((m) => m.position)
        .filter((p) => p !== undefined && p !== null);
      if (respPositions.length > 0) {
        const respBestPos = Math.min(...respPositions);
        if (bestRespPos === null || respBestPos < bestRespPos) {
          bestRespPos = respBestPos;
          bestResp = r;
        }
      }
    }

    const questionData = {
      id: q.id,
      question: q.query || "Untitled Question",
      type: q.type,
      bestPosition: bestPos, // Will be null if no mentions
      totalMentions: totalPositions.length,
      averagePosition: avgPos, // Will be null if no mentions
      bestResponse: bestResp.content,
      bestResponseModel: bestResp.model,
      responses: q.responses.map((r) => ({
        model: r.model,
        response: r.content,
        position:
          r.mentions.find((m) => m.position !== undefined)?.position || null, // null if no mention
        createdAt: r.createdAt?.toISOString?.() ?? undefined,
      })),
    };

    // Debug log for questions with suspicious rankings
    if (bestPos === null && totalPositions.length === 0) {
      console.log(
        `[calculateTopQuestions] Question without mentions: "${(q.query || "").substring(0, 50)}" - bestPosition: ${bestPos}, totalMentions: ${totalPositions.length}`,
      );
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
  skip: number = 0,
) {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  if (!runId || !companyId) {
    return { responses: [], totalCount: 0 };
  }

  console.log(
    `[calculateTopResponses] Computing response-level data for ${runId}, filters:`,
    filters,
  );

  // Build where clauses
  const whereResponse: any = {
    runId,
    ...(filters.aiModel && filters.aiModel !== "all"
      ? { model: filters.aiModel }
      : {}),
  };

  const whereQuestion: any = {
    companyId,
    ...(filters.questionType && filters.questionType !== "all"
      ? { type: filters.questionType }
      : {}),
  };

  // Get all responses with their questions and mentions
  const responses = await prismaReadReplica.response.findMany({
    where: {
      ...whereResponse,
      question: whereQuestion,
    },
    include: {
      question: {
        select: { id: true, query: true, type: true },
      },
      mentions: {
        where: { companyId },
        select: { position: true },
      },
    },
    orderBy: [{ question: { query: "asc" } }, { model: "asc" }],
  });

  console.log(
    `[calculateTopResponses] Found ${responses.length} total responses before pagination`,
  );

  // Pre-compute best position per question for ranking
  const questionBestPosition = new Map<string, number>();
  responses.forEach((r) => {
    const questionId = r.question.id;
    const positions = r.mentions
      .map((m) => m.position)
      .filter((p) => p !== undefined && p !== null);
    if (positions.length > 0) {
      const bestPos = Math.min(...positions);
      const currentBest = questionBestPosition.get(questionId);
      if (currentBest === undefined || bestPos < currentBest) {
        questionBestPosition.set(questionId, bestPos);
      }
    }
  });

  // Transform responses with enriched data
  const transformed = responses.map((r) => {
    const positions = r.mentions
      .map((m) => m.position)
      .filter((p) => p !== undefined && p !== null);
    const responsePosition =
      positions.length > 0 ? Math.min(...positions) : null;
    const questionBestPos = questionBestPosition.get(r.question.id) || null;

    return {
      id: r.id,
      questionId: r.question.id,
      question: r.question.query,
      questionType: r.question.type,
      model: r.model,
      response: r.content,
      position: responsePosition, // null if no mentions for this response
      totalMentions: positions.length,
      questionBestPosition: questionBestPos, // For sorting - best position across all responses for this question
      createdAt: r.createdAt?.toISOString?.() ?? undefined,
    };
  });

  // Sort by: 1) questions with mentions first (by best position), 2) questions without mentions by name
  transformed.sort((a, b) => {
    // Primary sort: by question-level best position
    if (a.questionBestPosition !== null && b.questionBestPosition !== null) {
      const positionDiff = a.questionBestPosition - b.questionBestPosition;
      if (positionDiff !== 0) return positionDiff;
    } else if (
      a.questionBestPosition !== null &&
      b.questionBestPosition === null
    ) {
      return -1; // a's question has mentions, b's doesn't
    } else if (
      a.questionBestPosition === null &&
      b.questionBestPosition !== null
    ) {
      return 1; // b's question has mentions, a's doesn't
    }

    // Secondary sort: by question text (alphabetical)
    const questionDiff = a.question.localeCompare(b.question);
    if (questionDiff !== 0) return questionDiff;

    // Tertiary sort: by model name (alphabetical)
    return a.model.localeCompare(b.model);
  });

  const totalCount = transformed.length;
  const paginated = transformed.slice(skip, skip + limit);

  console.log(
    `[calculateTopResponses] Returning ${paginated.length} responses out of ${totalCount} total`,
  );

  return { responses: paginated, totalCount };
}

// runId is ignored in new pipeline but kept for backward compatibility
export async function calculateShareOfVoiceHistory(
  _runId: string,
  companyId: string,
  filters?: { aiModel?: string },
) {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  const whereClause: any = { companyId };

  // Apply aiModel filter if provided
  if (filters?.aiModel && filters.aiModel !== "all") {
    whereClause.aiModel = filters.aiModel;
  }

  const history = await prismaReadReplica.shareOfVoiceHistory.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
  });
  return history;
}

// runId is ignored in new pipeline but kept for backward compatibility
export async function calculateSentimentOverTime(
  _runId: string,
  companyId: string,
  filters?: { aiModel?: string },
) {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  const whereClause: any = { companyId };

  // Apply aiModel filter if provided
  if (filters?.aiModel && filters.aiModel !== "all") {
    whereClause.aiModel = filters.aiModel;
  }

  const history = await prismaReadReplica.sentimentOverTime.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
  });
  return history;
}

// New utility functions to save data to normalized tables
export async function saveShareOfVoiceHistoryPoint(
  companyId: string,
  date: Date,
  aiModel: string,
  shareOfVoice: number,
  reportRunId?: string,
  userTimezone?: string,
): Promise<void> {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  if (!reportRunId) {
    console.warn(
      `[saveShareOfVoiceHistoryPoint] reportRunId is missing for company ${companyId}. Skipping save.`,
    );
    return;
  }
  
  // Normalize date to day precision using user's timezone or UTC as fallback
  let normalizedDate: Date;
  if (userTimezone) {
    try {
      // Get the date in user's timezone and normalize to midnight
      const userDate = new Date(date.toLocaleString("sv-SE", { timeZone: userTimezone }));
      normalizedDate = new Date(Date.UTC(
        userDate.getFullYear(),
        userDate.getMonth(),
        userDate.getDate(),
        0, 0, 0, 0
      ));
    } catch (error) {
      console.warn(`[saveShareOfVoiceHistoryPoint] Invalid timezone ${userTimezone}, falling back to UTC`);
      normalizedDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0, 0, 0, 0
      ));
    }
  } else {
    // Fallback to UTC normalization
    normalizedDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));
  }

  await prisma.shareOfVoiceHistory.upsert({
    where: {
      companyId_date_aiModel: {
        companyId,
        date: normalizedDate,
        aiModel,
      },
    },
    update: {
      shareOfVoice,
      reportRunId,
      updatedAt: new Date(),
    },
    create: {
      companyId,
      date: normalizedDate,
      aiModel,
      shareOfVoice,
      reportRunId,
    },
  });
}

export async function saveSentimentOverTimePoint(
  companyId: string,
  date: Date,
  aiModel: string,
  sentimentScore: number,
  reportRunId?: string,
  userTimezone?: string,
): Promise<void> {
  const prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  if (!reportRunId) {
    console.warn(
      `[saveSentimentOverTimePoint] reportRunId is missing for company ${companyId}. Skipping save.`,
    );
    return;
  }
  
  // Normalize date to day precision using user's timezone or UTC as fallback
  let normalizedDate: Date;
  if (userTimezone) {
    try {
      // Get the date in user's timezone and normalize to midnight
      const userDate = new Date(date.toLocaleString("sv-SE", { timeZone: userTimezone }));
      normalizedDate = new Date(Date.UTC(
        userDate.getFullYear(),
        userDate.getMonth(),
        userDate.getDate(),
        0, 0, 0, 0
      ));
    } catch (error) {
      console.warn(`[saveSentimentOverTimePoint] Invalid timezone ${userTimezone}, falling back to UTC`);
      normalizedDate = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0, 0, 0, 0
      ));
    }
  } else {
    // Fallback to UTC normalization
    normalizedDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    ));
  }

  await prisma.sentimentOverTime.upsert({
    where: {
      companyId_date_aiModel: {
        companyId,
        date: normalizedDate,
        aiModel,
      },
    },
    update: {
      sentimentScore,
      reportRunId,
      updatedAt: new Date(),
    },
    create: {
      companyId,
      date: normalizedDate,
      aiModel,
      sentimentScore,
      reportRunId,
    },
  });
}
