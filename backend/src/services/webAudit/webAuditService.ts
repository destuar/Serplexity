/**
 * @file webAuditService.ts
 * @description Core web audit orchestration service
 *
 * Provides comprehensive website analysis including:
 * - Performance analysis via PageSpeed Insights API
 * - Technical SEO analysis
 * - GEO optimization scoring
 * - Accessibility analysis
 * - Security analysis
 *
 * @dependencies
 * - performanceAnalyzer: PageSpeed Insights integration
 * - seoAnalyzer: Technical SEO checks
 * - geoAnalyzer: GEO optimization analysis
 * - accessibilityAnalyzer: WCAG compliance
 * - securityAnalyzer: Security headers and HTTPS
 * - auditScorer: Score calculation engine
 */

import { Queue } from "bullmq";
import { z } from "zod";
import { getDbClient } from "../../config/database";
import env from "../../config/env";
import { redis } from "../../config/redis";
import logger from "../../utils/logger";
import { geoAnalyzer } from "./analyzers/geoAnalyzer";
import { performanceAnalyzer } from "./analyzers/performanceAnalyzer";
import { securityAnalyzer } from "./analyzers/securityAnalyzer";
import { seoAnalyzer } from "./analyzers/seoAnalyzer";
import { auditScorer } from "./scoring/auditScorer";
// redis connection provided by ../../config/redis

// Queue setup
const WEB_AUDIT_QUEUE_NAME = `${env.BULLMQ_QUEUE_PREFIX}web-audit`;
const webAuditQueue = new Queue(WEB_AUDIT_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Types and interfaces
export interface AuditConfig {
  url: string;
  companyId: string;
  includePerformance: boolean;
  includeSEO: boolean;
  includeGEO: boolean;
  includeSecurity: boolean;
  summaryOnly?: boolean; // if true, store only scores, skip heavy details
}

export interface AuditResult {
  id: string;
  scores: {
    performance: number;
    seo: number;
    geo: number;
    security: number;
    overall: number;
  };
  details: {
    performance?: PerformanceResults;
    seo?: SEOResults;
    geo?: GEOResults;
    security?: SecurityResults;
  };
  recommendations: Recommendation[];
  metadata: {
    analysisTime: number;
    url: string;
    timestamp: Date;
  };
}

export interface PerformanceResults {
  coreWebVitals: {
    lcp: number;
    fid: number;
    cls: number;
  };
  loadTime: number;
  pageSize: number;
  resourceCount: number;
  mobileScore: number;
  desktopScore: number;
  /** Time To First Byte (ms), if available */
  ttfb?: number;
  /** Interaction to Next Paint (ms), if available */
  inp?: number;
  opportunities: Array<{
    title: string;
    description: string;
    savings: number;
  }>;
}

export interface SEOResults {
  technical: {
    robotsTxt: {
      exists: boolean;
      accessible: boolean;
      errors: string[];
    };
    llmsTxt: {
      exists: boolean;
      accessible: boolean;
    };
    sitemap: {
      exists: boolean;
      accessible: boolean;
      urlCount: number;
    };
    /** From <meta name="robots"> */
    robotsMeta?: {
      noindex: boolean;
      nofollow: boolean;
    };
    /** From X-Robots-Tag response header */
    xRobotsTag?: {
      noindex: boolean;
      nofollow: boolean;
    };
  };
  metaTags: {
    title: {
      exists: boolean;
      length: number;
      optimized: boolean;
    };
    description: {
      exists: boolean;
      length: number;
      optimized: boolean;
    };
    keywords: boolean;
  };
  structure: {
    headings: {
      h1Count: number;
      properHierarchy: boolean;
    };
    internalLinks: number;
    canonicalTag: boolean;
  };
  social?: {
    openGraph: boolean;
    twitterCard: boolean;
  };
  i18n?: {
    hreflangCount: number;
  };
}

export interface GEOResults {
  schemaMarkup: {
    jsonLd: Array<{
      type: string;
      valid: boolean;
    }>;
    microdata: boolean;
    totalSchemas: number;
  };
  contentStructure: {
    faqSections: number;
    listStructure: number;
    tableStructure: number;
    answerReadyContent: number;
  };
  aiOptimization: {
    readabilityScore: number;
    citationFriendly: boolean;
    structuredAnswers: number;
    // Deterministic additional metrics (0-100 unless stated otherwise)
    freshnessScore?: number;
    chunkabilityScore?: number;
    anchorCoverage?: number; // 0-100
    mainContentRatio?: number; // 0-100
    questionHeadingCoverage?: number; // 0-100
    schemaCompletenessScore?: number;
    tldrPresent?: boolean;
  };
}

export interface AccessibilityResults {
  wcagCompliance: {
    level: "A" | "AA" | "AAA" | "FAIL";
    score: number;
  };
  issues: Array<{
    type: string;
    severity: "critical" | "serious" | "moderate" | "minor";
    count: number;
    description: string;
  }>;
  altText: {
    coverage: number;
    totalImages: number;
    missingAlt: number;
  };
  colorContrast: {
    passed: number;
    failed: number;
    ratio: number;
  };
}

export interface SecurityResults {
  https: {
    enabled: boolean;
    certificateValid: boolean;
    hsts: boolean;
  };
  headers: {
    contentSecurityPolicy: boolean;
    xFrameOptions: boolean;
    xContentTypeOptions: boolean;
    referrerPolicy: boolean;
    permissionsPolicy: boolean;
  };
  vulnerabilities: Array<{
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    description: string;
  }>;
}

export interface Recommendation {
  category: "performance" | "seo" | "geo" | "security";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  resources?: string[];
}

// Input validation schemas
const AuditConfigSchema = z.object({
  url: z.string().url("Invalid URL format"),
  companyId: z.string().min(1, "Company ID is required"),
  includePerformance: z.boolean().default(true),
  includeSEO: z.boolean().default(true),
  includeGEO: z.boolean().default(true),
  includeSecurity: z.boolean().default(true),
  summaryOnly: z.boolean().optional().default(false),
});

/**
 * Start a comprehensive web audit
 */
export async function startWebAudit(config: AuditConfig): Promise<string> {
  const startTime = Date.now();

  try {
    // Validate input
    const validatedConfig = AuditConfigSchema.parse(config);

    logger.info("Starting web audit", {
      url: validatedConfig.url,
      companyId: validatedConfig.companyId,
      analysisTypes: {
        performance: validatedConfig.includePerformance,
        seo: validatedConfig.includeSEO,
        geo: validatedConfig.includeGEO,
        security: validatedConfig.includeSecurity,
      },
    });

    // Create audit run record
    const prisma = await getDbClient();
    const auditRun = await prisma.webAuditRun.create({
      data: {
        companyId: validatedConfig.companyId,
        url: validatedConfig.url,
        status: "queued",
      },
    });

    // Queue the job for background processing
    await webAuditQueue.add(
      "processWebAudit",
      {
        auditId: auditRun.id,
        url: validatedConfig.url,
        options: {
          includePerformance: validatedConfig.includePerformance,
          includeSEO: validatedConfig.includeSEO,
          includeGEO: validatedConfig.includeGEO,
          includeSecurity: validatedConfig.includeSecurity,
          summaryOnly: validatedConfig.summaryOnly,
        },
        companyId: validatedConfig.companyId,
      },
      {
        jobId: auditRun.id, // Use audit ID as job ID for easy tracking
        delay: 0, // Start immediately
      }
    );

    logger.info("Web audit queued successfully", {
      auditId: auditRun.id,
      url: validatedConfig.url,
      queueTime: Date.now() - startTime,
    });

    return auditRun.id;
  } catch (error) {
    logger.error("Failed to start web audit", {
      url: config.url,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Failed to start web audit: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Process web audit (called by worker)
 */
export async function processAudit(
  auditId: string,
  url: string,
  options: {
    includePerformance: boolean;
    includeSEO: boolean;
    includeGEO: boolean;
    includeSecurity: boolean;
    summaryOnly?: boolean;
  },
  companyId: string
): Promise<AuditResult> {
  const startTime = Date.now();
  const prisma = await getDbClient();

  try {
    // Update status to running
    await prisma.webAuditRun.update({
      where: { id: auditId },
      data: { status: "running" },
    });
    // Initial progress hint
    try {
      await setAuditJobProgress(auditId, 5);
    } catch {}

    logger.info("Processing web audit", { auditId, url });

    // Run analyses in parallel; bump progress as each completes
    const perfPromise = options.includePerformance
      ? performanceAnalyzer
          .analyze(url)
          .finally(() => setAuditJobProgress(auditId, 25))
      : Promise.resolve(null);
    const seoPromise = options.includeSEO
      ? seoAnalyzer.analyze(url).finally(() => setAuditJobProgress(auditId, 45))
      : Promise.resolve(null);
    const geoPromise = options.includeGEO
      ? geoAnalyzer.analyze(url).finally(() => setAuditJobProgress(auditId, 65))
      : Promise.resolve(null);
    const secPromise = options.includeSecurity
      ? securityAnalyzer
          .analyze(url)
          .finally(() => setAuditJobProgress(auditId, 85))
      : Promise.resolve(null);

    const analyses = await Promise.allSettled([
      perfPromise,
      seoPromise,
      geoPromise,
      secPromise,
    ]);

    // Extract results
    const [performanceResult, seoResult, geoResult, securityResult] = analyses;

    const details: AuditResult["details"] = {};

    if (performanceResult.status === "fulfilled" && performanceResult.value) {
      details.performance = performanceResult.value;
    }
    if (seoResult.status === "fulfilled" && seoResult.value) {
      details.seo = seoResult.value;
    }
    if (geoResult.status === "fulfilled" && geoResult.value) {
      details.geo = geoResult.value;
    }
    if (securityResult.status === "fulfilled" && securityResult.value) {
      details.security = securityResult.value;
    }

    // Prepare input for scorer to satisfy exactOptionalPropertyTypes
    const scoreInput: {
      performance?: PerformanceResults;
      seo?: SEOResults;
      geo?: GEOResults;
      security?: SecurityResults;
    } = {};
    if (details.performance) scoreInput.performance = details.performance;
    if (details.seo) scoreInput.seo = details.seo;
    if (details.geo) scoreInput.geo = details.geo;
    if (details.security) scoreInput.security = details.security;

    // Calculate scores
    const scores = auditScorer.calculateScores(scoreInput);

    // Generate recommendations
    const recommendations = auditScorer.generateRecommendations(
      scoreInput,
      scores
    );

    // Update database with results
    try {
      await setAuditJobProgress(auditId, 90);
    } catch {}
    const baseUpdate: any = {
      status: "completed",
      completedAt: new Date(),
      performanceScore: scores.performance,
      seoScore: scores.seo,
      geoScore: scores.geo,
      securityScore: scores.security,
    };

    if (!options.summaryOnly) {
      if (details.performance) {
        baseUpdate.performance = JSON.parse(
          JSON.stringify(details.performance)
        );
      }
      if (details.seo) {
        baseUpdate.seoTechnical = JSON.parse(JSON.stringify(details.seo));
      }
      if (details.geo) {
        baseUpdate.geoOptimization = JSON.parse(JSON.stringify(details.geo));
      }
      if (details.security) {
        baseUpdate.security = JSON.parse(JSON.stringify(details.security));
      }
    }

    await prisma.webAuditRun.update({
      where: { id: auditId },
      data: baseUpdate,
    });
    try {
      await setAuditJobProgress(auditId, 100);
    } catch {}

    const processingTime = Date.now() - startTime;

    logger.info("Web audit completed successfully", {
      auditId,
      url,
      processingTime,
      scores: {
        performance: scores.performance,
        seo: scores.seo,
        geo: scores.geo,
        security: scores.security,
        overall: scores.overall,
      },
      recommendationCount: recommendations.length,
    });

    // Return the result for the worker
    return {
      id: auditId,
      scores,
      details,
      recommendations,
      metadata: {
        analysisTime: processingTime,
        url,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    logger.error("Web audit processing failed", {
      auditId,
      url,
      processingTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    });

    // Update status to failed
    await prisma.webAuditRun.update({
      where: { id: auditId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

/**
 * Compute summary scores for a URL without persisting details
 */
export async function computeSummaryScores(url: string): Promise<{
  performance: number;
  seo: number;
  geo: number;
  security: number;
  overall: number;
}> {
  const analyses = await Promise.allSettled([
    performanceAnalyzer.analyze(url),
    seoAnalyzer.analyze(url),
    geoAnalyzer.analyze(url),
    securityAnalyzer.analyze(url),
  ]);

  const [perf, seo, geo, sec] = analyses;
  const details: any = {};
  if (perf.status === "fulfilled" && perf.value)
    details.performance = perf.value;
  if (seo.status === "fulfilled" && seo.value) details.seo = seo.value;
  if (geo.status === "fulfilled" && geo.value) details.geo = geo.value;
  if (sec.status === "fulfilled" && sec.value) details.security = sec.value;

  const scores = auditScorer.calculateScores(details);
  return {
    performance: scores.performance,
    seo: scores.seo,
    geo: scores.geo,
    security: scores.security,
    overall: scores.overall,
  };
}

/**
 * Get audit status and results
 */
export async function getWebAuditResult(
  auditId: string
): Promise<AuditResult | null> {
  try {
    const prisma = await getDbClient();
    const auditRun = await prisma.webAuditRun.findUnique({
      where: { id: auditId },
      include: { company: true },
    });

    if (!auditRun) {
      return null;
    }

    if (auditRun.status !== "completed") {
      return {
        id: auditRun.id,
        scores: {
          performance: auditRun.performanceScore || 0,
          seo: auditRun.seoScore || 0,
          geo: auditRun.geoScore || 0,
          security: auditRun.securityScore || 0,
          overall: 0,
        },
        details: {},
        recommendations: [],
        metadata: {
          analysisTime: 0,
          url: auditRun.url,
          timestamp: auditRun.requestedAt,
        },
      };
    }

    // Calculate overall score
    const scores = {
      performance: auditRun.performanceScore || 0,
      seo: auditRun.seoScore || 0,
      geo: auditRun.geoScore || 0,
      security: auditRun.securityScore || 0,
      overall: Math.round(
        ((auditRun.performanceScore || 0) +
          (auditRun.seoScore || 0) +
          (auditRun.geoScore || 0) +
          (auditRun.securityScore || 0)) /
          4
      ),
    };

    // Treat empty objects persisted in JSON columns as undefined to avoid
    // downstream recommendation generation errors
    const isNonEmptyObject = (obj: unknown): boolean => {
      return (
        !!obj &&
        typeof obj === "object" &&
        Object.keys(obj as object).length > 0
      );
    };

    const details = {
      performance: isNonEmptyObject(auditRun.performance)
        ? (auditRun.performance as unknown as PerformanceResults)
        : undefined,
      seo: isNonEmptyObject(auditRun.seoTechnical)
        ? (auditRun.seoTechnical as unknown as SEOResults)
        : undefined,
      geo: isNonEmptyObject(auditRun.geoOptimization)
        ? (auditRun.geoOptimization as unknown as GEOResults)
        : undefined,
      security: isNonEmptyObject(auditRun.security)
        ? (auditRun.security as unknown as SecurityResults)
        : undefined,
    };

    // Generate fresh recommendations based on results
    const recommendations = auditScorer.generateRecommendations(
      details,
      scores
    );

    return {
      id: auditRun.id,
      scores,
      details,
      recommendations,
      metadata: {
        analysisTime: auditRun.completedAt
          ? auditRun.completedAt.getTime() - auditRun.requestedAt.getTime()
          : 0,
        url: auditRun.url,
        timestamp: auditRun.requestedAt,
      },
    };
  } catch (error) {
    logger.error("Failed to get web audit result", {
      auditId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Failed to get audit result: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get background job progress for an audit, if available (0-100)
 */
export async function getAuditJobProgress(
  auditId: string
): Promise<number | null> {
  try {
    const job = await webAuditQueue.getJob(auditId);
    if (!job) return null;
    const progress = typeof job.progress === "number" ? job.progress : null;
    // Normalize BullMQ progress to 0-100 range
    if (progress === null) return null;
    if (progress < 0) return 0;
    if (progress > 100) return 100;
    return progress;
  } catch (_err) {
    return null;
  }
}

/**
 * Best-effort monotonic job progress setter (0-100)
 */
export async function setAuditJobProgress(
  auditId: string,
  targetProgress: number
): Promise<void> {
  try {
    const job = await webAuditQueue.getJob(auditId);
    if (!job) return;
    const prev = typeof job.progress === "number" ? job.progress : 0;
    const normalized = Math.max(0, Math.min(100, targetProgress));
    const next = Math.max(prev, normalized);
    if (next > prev) {
      await job.updateProgress(next);
    }
  } catch {
    // ignore progress failures
  }
}

/**
 * Get audit history for a company
 */
export async function getWebAuditHistory(companyId: string): Promise<
  Array<{
    id: string;
    url: string;
    status: string;
    requestedAt: Date;
    completedAt: Date | null;
    scores: {
      performance: number | null;
      seo: number | null;
      geo: number | null;
      accessibility: number | null;
      security: number | null;
      overall: number | null;
    };
  }>
> {
  try {
    const prisma = await getDbClient();
    const auditRuns = await prisma.webAuditRun.findMany({
      where: { companyId },
      orderBy: { requestedAt: "desc" },
      take: 50, // Limit to recent 50 audits
    });

    return auditRuns.map((run) => ({
      id: run.id,
      url: run.url,
      status: run.status,
      requestedAt: run.requestedAt,
      completedAt: run.completedAt,
      scores: {
        performance: run.performanceScore,
        seo: run.seoScore,
        geo: run.geoScore,
        accessibility: run.accessibilityScore,
        security: run.securityScore,
        overall:
          run.performanceScore !== null &&
          run.seoScore !== null &&
          run.geoScore !== null &&
          run.securityScore !== null
            ? Math.round(
                ((run.performanceScore || 0) +
                  (run.seoScore || 0) +
                  (run.geoScore || 0) +
                  (run.securityScore || 0)) /
                  4
              )
            : null,
      },
    }));
  } catch (error) {
    logger.error("Failed to get web audit history", {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Failed to get audit history: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete an audit run
 */
export async function deleteWebAudit(
  auditId: string,
  companyId: string
): Promise<void> {
  try {
    const prisma = await getDbClient();

    await prisma.webAuditRun.deleteMany({
      where: {
        id: auditId,
        companyId, // Ensure user can only delete their own audits
      },
    });

    logger.info("Web audit deleted", { auditId, companyId });
  } catch (error) {
    logger.error("Failed to delete web audit", {
      auditId,
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Failed to delete audit: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Export service object for easy importing
export const webAuditService = {
  startWebAudit,
  processAudit,
  getWebAuditResult,
  getWebAuditHistory,
  deleteWebAudit,
};
