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
  const _prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  // Prefer pre-computed competitorRankings if present
  const metric = await prismaReadReplica.reportMetric.findFirst({
    where: { reportId: runId, aiModel: filters?.aiModel ?? "all" },
    select: { competitorRankings: true },
  });

  if (metric?.competitorRankings) {
    return metric.competitorRankings as unknown;
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
  const _prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();

  // Prefer pre-computed citationRankings if present
  const metric = await prismaReadReplica.reportMetric.findFirst({
    where: { reportId: runId, aiModel: filters?.aiModel ?? "all" },
    select: { competitorRankings: true },
  });

  // Check if citation rankings are already computed and stored in competitorRankings
  if (
    metric?.competitorRankings &&
    (metric.competitorRankings as any)?.citationRankings
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
  const _prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();

  if (!runId || !companyId) {
    return { questions: [], totalCount: 0 };
  }

  console.log(
    `[calculateTopQuestions] Computing for ${runId}, companyId: ${companyId}, filters:`,
    filters,
  );

  // Build where clauses
  const whereResponse: Record<string, unknown> = {
    runId,
    ...(filters?.aiModel && filters.aiModel !== "all"
      ? { model: filters.aiModel }
      : {}),
  };

  const whereQuestion: Record<string, unknown> = {
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
  const _prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  if (!runId || !companyId) {
    return { responses: [], totalCount: 0 };
  }

  console.log(
    `[calculateTopResponses] Computing response-level data for ${runId}, filters:`,
    filters,
  );

  // Build where clauses
  const whereResponse: Record<string, unknown> = {
    runId,
    ...(filters.aiModel && filters.aiModel !== "all"
      ? { model: filters.aiModel }
      : {}),
  };

  const whereQuestion: Record<string, unknown> = {
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

/**
 * Calculate Share of Voice history with intelligent granularity support
 * Supports hourly, daily, and weekly aggregation for optimal display of multiple daily reports
 */
export async function calculateShareOfVoiceHistory(
  _runId: string,
  companyId: string,
  filters?: { aiModel?: string; granularity?: 'hour' | 'day' | 'week'; dateRange?: string },
) {
  const _prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  
  // Default to raw data (individual reports) when no granularity specified
  const granularity = filters?.granularity || 'raw';
  
  // Helper function to build date range WHERE clause
  const getDateRangeFilter = (dateRange?: string): string => {
    if (!dateRange) return '';
    
    const now = new Date();
    let cutoffDate: Date;
    
    switch (dateRange) {
      case '24h':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return '';
    }
    
    return `AND date >= '${cutoffDate.toISOString()}'`;
  };
  
  const dateRangeFilter = getDateRangeFilter(filters?.dateRange);
  
  // For raw data, return individual points as before (backward compatibility)
  if (granularity === 'raw') {
    const whereClause: Record<string, unknown> = { companyId };
    if (filters?.aiModel && filters.aiModel !== "all") {
      whereClause.aiModel = filters.aiModel;
    }

    const history = await prismaReadReplica.shareOfVoiceHistory.findMany({
      where: whereClause,
      orderBy: { date: "asc" },
    });
    
    return history;
  }

  // For granularity-based aggregation, use PostgreSQL date_trunc for optimal performance
  const getTimeGrouping = (gran: string) => {
    switch (gran) {
      case 'hour': 
        // For hourly data, preserve actual execution time instead of truncating to hour start
        // This shows when reports actually ran rather than artificial hour buckets
        return "date";
      case 'week': return "date_trunc('week', date)";
      default: return "date_trunc('day', date)";
    }
  };

  const timeGrouping = getTimeGrouping(granularity);
  const aiModelFilter = filters?.aiModel && filters.aiModel !== "all" 
    ? `AND "aiModel" = '${filters.aiModel}'` 
    : '';

  // For hourly granularity, don't aggregate - show individual report times
  if (granularity === 'hour') {
    const individualHistory = await prismaReadReplica.$queryRawUnsafe(`
      SELECT 
        date,
        "aiModel",
        "shareOfVoice",
        1 as report_count,
        "createdAt" as first_report,
        "createdAt" as last_report
      FROM "ShareOfVoiceHistory" 
      WHERE "companyId" = '${companyId}'
        ${aiModelFilter}
        ${dateRangeFilter}
      ORDER BY date ASC
    `);

    return (individualHistory as Array<{
      date: Date;
      aiModel: string;
      shareOfVoice: string;
      report_count: string;
      first_report: Date;
      last_report: Date;
    }>).map(row => ({
      id: `${row.date.toISOString()}-${row.aiModel}`,
      companyId,
      date: row.date,
      aiModel: row.aiModel,
      shareOfVoice: parseFloat(row.shareOfVoice),
      reportRunId: null,
      createdAt: row.first_report,
      updatedAt: row.last_report,
      reportCount: parseInt(row.report_count),
      aggregationType: granularity,
    }));
  }

  // CRITICAL FIX: For daily granularity, check if all data is from the same day
  // If so, show individual reports instead of aggregating
  if (granularity === 'day') {
    // First check the date span of the data
    const dateSpanCheck = await prismaReadReplica.$queryRawUnsafe(`
      SELECT 
        DATE(MIN(date)) as min_date,
        DATE(MAX(date)) as max_date,
        COUNT(DISTINCT DATE(date)) as unique_days
      FROM "ShareOfVoiceHistory" 
      WHERE "companyId" = '${companyId}'
        ${aiModelFilter}
        ${dateRangeFilter}
    `);

    const spanInfo = (dateSpanCheck as Array<{ min_date: Date; max_date: Date; unique_days: string }>)[0];
    const uniqueDays = parseInt(spanInfo.unique_days);

    console.log(`[ShareOfVoiceHistory] Daily granularity check: ${uniqueDays} unique days`);

    // If all data is from 1-2 days, show individual reports for better granularity
    if (uniqueDays <= 2) {
      console.log(`[ShareOfVoiceHistory] Using individual reports for daily view (${uniqueDays} days)`);
      const individualHistory = await prismaReadReplica.$queryRawUnsafe(`
        SELECT 
          date,
          "aiModel",
          "shareOfVoice",
          1 as report_count,
          "createdAt" as first_report,
          "createdAt" as last_report
        FROM "ShareOfVoiceHistory" 
        WHERE "companyId" = '${companyId}'
          ${aiModelFilter}
          ${dateRangeFilter}
        ORDER BY date ASC
      `);

      return (individualHistory as Array<{
        date: Date;
        aiModel: string;
        shareOfVoice: string;
        report_count: string;
        first_report: Date;
        last_report: Date;
      }>).map(row => ({
        id: `${row.date.toISOString()}-${row.aiModel}`,
        companyId,
        date: row.date,
        aiModel: row.aiModel,
        shareOfVoice: parseFloat(row.shareOfVoice),
        reportRunId: null,
        createdAt: row.first_report,
        updatedAt: row.last_report,
        reportCount: parseInt(row.report_count),
        aggregationType: 'individual',
      }));
    }
  }

  // Debug logging for weekly granularity
  if (granularity === 'week') {
    console.log(`[ShareOfVoiceHistory] Weekly aggregation query for ${companyId}`);
    console.log(`[ShareOfVoiceHistory] Time grouping: ${timeGrouping}`);
    console.log(`[ShareOfVoiceHistory] Date range filter: ${dateRangeFilter}`);
  }

  // Raw SQL query for optimal aggregation performance (daily/weekly)
  let aggregatedHistory;
  
  if (granularity === 'week') {
    // For weekly: first get daily averages, then average those by week
    aggregatedHistory = await prismaReadReplica.$queryRawUnsafe(`
      WITH daily_averages AS (
        SELECT 
          DATE(date) as day,
          date_trunc('week', DATE(date)) as week_start,
          "aiModel",
          AVG("shareOfVoice") as daily_avg,
          COUNT(*) as daily_count
        FROM "ShareOfVoiceHistory" 
        WHERE "companyId" = '${companyId}'
          ${aiModelFilter}
          ${dateRangeFilter}
        GROUP BY DATE(date), date_trunc('week', DATE(date)), "aiModel"
      )
      SELECT 
        week_start as date,
        "aiModel",
        AVG(daily_avg) as "shareOfVoice",
        SUM(daily_count) as report_count,
        MIN(week_start) as first_report,
        MAX(week_start) as last_report
      FROM daily_averages
      GROUP BY week_start, "aiModel"
      ORDER BY date ASC
    `);
  } else {
    // For daily: direct aggregation is fine
    aggregatedHistory = await prismaReadReplica.$queryRawUnsafe(`
      SELECT 
        ${timeGrouping} as date,
        "aiModel",
        AVG("shareOfVoice") as "shareOfVoice",
        COUNT(*) as report_count,
        MIN("createdAt") as first_report,
        MAX("createdAt") as last_report
      FROM "ShareOfVoiceHistory" 
      WHERE "companyId" = '${companyId}'
        ${aiModelFilter}
        ${dateRangeFilter}
      GROUP BY ${timeGrouping}, "aiModel"
      ORDER BY date ASC
    `);
  }

  // Debug logging for weekly results
  if (granularity === 'week') {
    console.log(`[ShareOfVoiceHistory] Weekly query returned ${aggregatedHistory.length} rows`);
    if (aggregatedHistory.length > 0) {
      console.log(`[ShareOfVoiceHistory] First weekly result:`, aggregatedHistory[0]);
    }
  }

  // Transform to match expected interface
  return (aggregatedHistory as Array<{
    date: Date;
    aiModel: string;
    shareOfVoice: string;
    report_count: string;
    first_report: Date;
    last_report: Date;
  }>).map(row => ({
    id: `${row.date.toISOString()}-${row.aiModel}`, // Synthetic ID for aggregated data
    companyId,
    date: row.date,
    aiModel: row.aiModel,
    shareOfVoice: parseFloat(row.shareOfVoice),
    reportRunId: null, // Not applicable for aggregated data
    createdAt: row.first_report,
    updatedAt: row.last_report,
    // Additional metadata for aggregated data
    reportCount: parseInt(row.report_count),
    aggregationType: granularity,
  }));
}

/**
 * Calculate Inclusion Rate history with intelligent granularity support
 * Supports hourly, daily, and weekly aggregation for optimal display of multiple daily reports
 */
export async function calculateInclusionRateHistory(
  _runId: string,
  companyId: string,
  filters?: { aiModel?: string; granularity?: 'hour' | 'day' | 'week'; dateRange?: string },
) {
  const _prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  
  // Default to raw data (individual reports) when no granularity specified
  const granularity = filters?.granularity || 'raw';
  
  // For raw data, return individual points as before (backward compatibility)
  if (granularity === 'raw') {
    const whereClause: Record<string, unknown> = { companyId };
    if (filters?.aiModel && filters.aiModel !== "all") {
      whereClause.aiModel = filters.aiModel;
    }

    const history = await prismaReadReplica.inclusionRateHistory.findMany({
      where: whereClause,
      orderBy: { date: "asc" },
    });
    
    return history;
  }

  // For granularity-based aggregation, use PostgreSQL date_trunc for optimal performance
  const getTimeGrouping = (gran: string) => {
    switch (gran) {
      case 'hour': 
        // For hourly data, preserve actual execution time instead of truncating to hour start
        return "date";
      case 'week': return "date_trunc('week', date)";
      default: return "date_trunc('day', date)";
    }
  };

  const timeGrouping = getTimeGrouping(granularity);
  const aiModelFilter = filters?.aiModel && filters.aiModel !== "all" 
    ? `AND "aiModel" = '${filters.aiModel}'` 
    : '';

  // Helper function to build date range WHERE clause
  const getDateRangeFilter = (dateRange?: string): string => {
    if (!dateRange) return '';
    
    const now = new Date();
    let cutoffDate: Date;
    
    switch (dateRange) {
      case '24h':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return '';
    }
    
    return `AND date >= '${cutoffDate.toISOString()}'`;
  };
  
  const dateRangeFilter = getDateRangeFilter(filters?.dateRange);

  // For hourly granularity, don't aggregate - show individual report times
  if (granularity === 'hour') {
    const individualHistory = await prismaReadReplica.$queryRawUnsafe(`
      SELECT 
        date,
        "aiModel",
        "inclusionRate",
        1 as report_count,
        "createdAt" as first_report,
        "createdAt" as last_report
      FROM "InclusionRateHistory" 
      WHERE "companyId" = '${companyId}'
        ${aiModelFilter}
        ${dateRangeFilter}
      ORDER BY date ASC
    `);

    return (individualHistory as Array<{
      date: Date;
      aiModel: string;
      inclusionRate: string;
      report_count: string;
      first_report: Date;
      last_report: Date;
    }>).map(row => ({
      id: `${row.date.toISOString()}-${row.aiModel}`,
      companyId,
      date: row.date,
      aiModel: row.aiModel,
      inclusionRate: parseFloat(row.inclusionRate),
      reportRunId: null,
      createdAt: row.first_report,
      updatedAt: row.last_report,
      reportCount: parseInt(row.report_count),
      aggregationType: granularity,
    }));
  }

  // CRITICAL FIX: For daily granularity, check if all data is from the same day
  if (granularity === 'day') {
    const dateSpanCheck = await prismaReadReplica.$queryRawUnsafe(`
      SELECT 
        DATE(MIN(date)) as min_date,
        DATE(MAX(date)) as max_date,
        COUNT(DISTINCT DATE(date)) as unique_days
      FROM "InclusionRateHistory" 
      WHERE "companyId" = '${companyId}'
        ${aiModelFilter}
        ${dateRangeFilter}
    `);
    const spanInfo = (dateSpanCheck as Array<{ min_date: Date; max_date: Date; unique_days: string }>)[0];
    const uniqueDays = parseInt(spanInfo.unique_days);
    
    console.log(`[InclusionRateHistory] Daily granularity check: ${uniqueDays} unique days`);
    
    if (uniqueDays <= 2) {
      // Return individual reports instead of aggregating
      console.log(`[InclusionRateHistory] Smart daily granularity: showing individual reports (${uniqueDays} days)`);
      const individualHistory = await prismaReadReplica.$queryRawUnsafe(`
        SELECT 
          date,
          "aiModel",
          "inclusionRate",
          1 as report_count,
          "createdAt" as first_report,
          "createdAt" as last_report
        FROM "InclusionRateHistory" 
        WHERE "companyId" = '${companyId}'
          ${aiModelFilter}
          ${dateRangeFilter}
        ORDER BY date ASC
      `);

      return (individualHistory as Array<{
        date: Date;
        aiModel: string;
        inclusionRate: string;
        report_count: string;
        first_report: Date;
        last_report: Date;
      }>).map(row => ({
        id: `${row.date.toISOString()}-${row.aiModel}`,
        companyId,
        date: row.date,
        aiModel: row.aiModel,
        inclusionRate: parseFloat(row.inclusionRate),
        reportRunId: null,
        createdAt: row.first_report,
        updatedAt: row.last_report,
        reportCount: parseInt(row.report_count),
        aggregationType: 'raw', // Show as individual reports, not aggregated
      }));
    }
  }

  // Raw SQL query for optimal aggregation performance (daily/weekly)
  let aggregatedHistory;
  
  if (granularity === 'week') {
    // For weekly: first get daily averages, then average those by week
    aggregatedHistory = await prismaReadReplica.$queryRawUnsafe(`
      WITH daily_averages AS (
        SELECT 
          DATE(date) as day,
          date_trunc('week', DATE(date)) as week_start,
          "aiModel",
          AVG("inclusionRate") as daily_avg,
          COUNT(*) as daily_count
        FROM "InclusionRateHistory" 
        WHERE "companyId" = '${companyId}'
          ${aiModelFilter}
          ${dateRangeFilter}
        GROUP BY DATE(date), date_trunc('week', DATE(date)), "aiModel"
      )
      SELECT 
        week_start as date,
        "aiModel",
        AVG(daily_avg) as "inclusionRate",
        SUM(daily_count) as report_count,
        MIN(week_start) as first_report,
        MAX(week_start) as last_report
      FROM daily_averages
      GROUP BY week_start, "aiModel"
      ORDER BY date ASC
    `);
  } else {
    // For daily: direct aggregation is fine
    aggregatedHistory = await prismaReadReplica.$queryRawUnsafe(`
      SELECT 
        ${timeGrouping} as date,
        "aiModel",
        AVG("inclusionRate") as "inclusionRate",
        COUNT(*) as report_count,
        MIN("createdAt") as first_report,
        MAX("createdAt") as last_report
      FROM "InclusionRateHistory" 
      WHERE "companyId" = '${companyId}'
        ${aiModelFilter}
        ${dateRangeFilter}
      GROUP BY ${timeGrouping}, "aiModel"
      ORDER BY date ASC
    `);
  }

  // Transform to match expected interface
  return (aggregatedHistory as Array<{
    date: Date;
    aiModel: string;
    inclusionRate: string;
    report_count: string;
    first_report: Date;
    last_report: Date;
  }>).map(row => ({
    id: `${row.date.toISOString()}-${row.aiModel}`, // Synthetic ID for aggregated data
    companyId,
    date: row.date,
    aiModel: row.aiModel,
    inclusionRate: parseFloat(row.inclusionRate),
    reportRunId: null, // Not applicable for aggregated data
    createdAt: row.first_report,
    updatedAt: row.last_report,
    // Additional metadata for aggregated data
    reportCount: parseInt(row.report_count),
    aggregationType: granularity,
  }));
}

/**
 * Calculate Sentiment Over Time history with intelligent granularity support
 * Supports hourly, daily, and weekly aggregation for optimal display of multiple daily reports
 */
export async function calculateSentimentOverTime(
  _runId: string,
  companyId: string,
  filters?: { aiModel?: string; granularity?: 'hour' | 'day' | 'week' },
) {
  const _prisma = await getDbClient();
  const prismaReadReplica = await getReadDbClient();
  
  // Default to raw data (individual reports) when no granularity specified
  const granularity = filters?.granularity || 'raw';
  
  // For raw data, return individual points as before (backward compatibility)
  if (granularity === 'raw') {
    const whereClause: Record<string, unknown> = { companyId };
    if (filters?.aiModel && filters.aiModel !== "all") {
      whereClause.aiModel = filters.aiModel;
    }

    const history = await prismaReadReplica.sentimentOverTime.findMany({
      where: whereClause,
      orderBy: { date: "asc" },
    });
    
    return history;
  }

  // For granularity-based aggregation, use PostgreSQL date_trunc for optimal performance
  const getTimeGrouping = (gran: string) => {
    switch (gran) {
      case 'hour': 
        // For hourly data, preserve actual execution time instead of truncating to hour start
        return "date";
      case 'week': return "date_trunc('week', date)";
      default: return "date_trunc('day', date)";
    }
  };

  const timeGrouping = getTimeGrouping(granularity);
  const aiModelFilter = filters?.aiModel && filters.aiModel !== "all" 
    ? `AND "aiModel" = '${filters.aiModel}'` 
    : '';

  // For hourly granularity, don't aggregate - show individual report times
  if (granularity === 'hour') {
    const individualHistory = await prismaReadReplica.$queryRawUnsafe(`
      SELECT 
        date,
        "aiModel",
        "sentimentScore",
        1 as report_count,
        "createdAt" as first_report,
        "createdAt" as last_report
      FROM "SentimentOverTime" 
      WHERE "companyId" = '${companyId}'
        ${aiModelFilter}
      ORDER BY date ASC
    `);

    return (individualHistory as Array<{
      date: Date;
      aiModel: string;
      sentimentScore: string;
      report_count: string;
      first_report: Date;
      last_report: Date;
    }>).map(row => ({
      id: `${row.date.toISOString()}-${row.aiModel}`,
      companyId,
      date: row.date,
      aiModel: row.aiModel,
      sentimentScore: parseFloat(row.sentimentScore),
      reportRunId: null,
      createdAt: row.first_report,
      updatedAt: row.last_report,
      reportCount: parseInt(row.report_count),
      aggregationType: granularity,
    }));
  }

  // Raw SQL query for optimal aggregation performance (daily/weekly)
  const aggregatedHistory = await prismaReadReplica.$queryRawUnsafe(`
    SELECT 
      ${timeGrouping} as date,
      "aiModel",
      AVG("sentimentScore") as "sentimentScore",
      COUNT(*) as report_count,
      MIN("createdAt") as first_report,
      MAX("createdAt") as last_report
    FROM "SentimentOverTime" 
    WHERE "companyId" = '${companyId}'
      ${aiModelFilter}
    GROUP BY ${timeGrouping}, "aiModel"
    ORDER BY date ASC
  `);

  // Transform to match expected interface
  return (aggregatedHistory as Array<{
    date: Date;
    aiModel: string;
    sentimentScore: string;
    report_count: string;
    first_report: Date;
    last_report: Date;
  }>).map(row => ({
    id: `${row.date.toISOString()}-${row.aiModel}`, // Synthetic ID for aggregated data
    companyId,
    date: row.date,
    aiModel: row.aiModel,
    sentimentScore: parseFloat(row.sentimentScore),
    reportRunId: null, // Not applicable for aggregated data
    createdAt: row.first_report,
    updatedAt: row.last_report,
    // Additional metadata for aggregated data
    reportCount: parseInt(row.report_count),
    aggregationType: granularity,
  }));
}

// New utility functions to save data to normalized tables
export async function saveShareOfVoiceHistoryPoint(
  companyId: string,
  date: Date,
  aiModel: string,
  shareOfVoice: number,
  reportRunId?: string,
  _userTimezone?: string,
): Promise<void> {
  const prisma = await getDbClient();
  const _prismaReadReplica = await getReadDbClient();
  if (!reportRunId) {
    console.warn(
      `[saveShareOfVoiceHistoryPoint] reportRunId is missing for company ${companyId}. Skipping save.`,
    );
    return;
  }

  // Store with full timestamp precision - no date normalization
  // This preserves all data points for flexible aggregation at query time
  await prisma.shareOfVoiceHistory.upsert({
    where: {
      companyId_reportRunId_aiModel: {
        companyId,
        reportRunId,
        aiModel,
      },
    },
    update: {
      shareOfVoice,
      date,
      updatedAt: new Date(),
    },
    create: {
      companyId,
      date,
      aiModel,
      shareOfVoice,
      reportRunId,
    },
  });
}

export async function saveInclusionRateHistoryPoint(
  companyId: string,
  date: Date,
  aiModel: string,
  inclusionRate: number,
  reportRunId?: string,
  _userTimezone?: string,
): Promise<void> {
  const prisma = await getDbClient();
  const _prismaReadReplica = await getReadDbClient();
  if (!reportRunId) {
    console.warn(
      `[saveInclusionRateHistoryPoint] reportRunId is missing for company ${companyId}. Skipping save.`,
    );
    return;
  }

  // Store with full timestamp precision - no date normalization
  // This preserves all data points for flexible aggregation at query time
  await prisma.inclusionRateHistory.upsert({
    where: {
      companyId_reportRunId_aiModel: {
        companyId,
        reportRunId,
        aiModel,
      },
    },
    update: {
      inclusionRate,
      date,
      updatedAt: new Date(),
    },
    create: {
      companyId,
      date,
      aiModel,
      inclusionRate,
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
  _userTimezone?: string,
): Promise<void> {
  const prisma = await getDbClient();
  const _prismaReadReplica = await getReadDbClient();
  if (!reportRunId) {
    console.warn(
      `[saveSentimentOverTimePoint] reportRunId is missing for company ${companyId}. Skipping save.`,
    );
    return;
  }

  // Store with full timestamp precision - no date normalization
  // This preserves all data points for flexible aggregation at query time
  await prisma.sentimentOverTime.upsert({
    where: {
      companyId_reportRunId_aiModel: {
        companyId,
        reportRunId,
        aiModel,
      },
    },
    update: {
      sentimentScore,
      date,
      updatedAt: new Date(),
    },
    create: {
      companyId,
      date,
      aiModel,
      sentimentScore,
      reportRunId,
    },
  });
}
