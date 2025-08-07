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

import { z } from "zod";
import { Queue } from "bullmq";
import logger from "../../utils/logger";
import { getDbClient } from "../../config/database";
import { performanceAnalyzer } from "./analyzers/performanceAnalyzer";
import { seoAnalyzer } from "./analyzers/seoAnalyzer";
import { geoAnalyzer } from "./analyzers/geoAnalyzer";
import { accessibilityAnalyzer } from "./analyzers/accessibilityAnalyzer";
import { securityAnalyzer } from "./analyzers/securityAnalyzer";
import { auditScorer } from "./scoring/auditScorer";
import { redis } from "../../config/redis";
import env from "../../config/env";

// Queue setup
const WEB_AUDIT_QUEUE_NAME = `${env.BULLMQ_QUEUE_PREFIX}web-audit`;
const webAuditQueue = new Queue(WEB_AUDIT_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 3,
    backoff: {
      type: 'exponential',
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
  includeAccessibility: boolean;
  includeSecurity: boolean;
}

export interface AuditResult {
  id: string;
  scores: {
    performance: number;
    seo: number;
    geo: number;
    accessibility: number;
    security: number;
    overall: number;
  };
  details: {
    performance?: PerformanceResults;
    seo?: SEOResults;
    geo?: GEOResults;
    accessibility?: AccessibilityResults;
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
  };
}

export interface AccessibilityResults {
  wcagCompliance: {
    level: 'A' | 'AA' | 'AAA' | 'FAIL';
    score: number;
  };
  issues: Array<{
    type: string;
    severity: 'critical' | 'serious' | 'moderate' | 'minor';
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
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  }>;
}

export interface Recommendation {
  category: 'performance' | 'seo' | 'geo' | 'accessibility' | 'security';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  resources?: string[];
}

// Input validation schemas
const AuditConfigSchema = z.object({
  url: z.string().url("Invalid URL format"),
  companyId: z.string().min(1, "Company ID is required"),
  includePerformance: z.boolean().default(true),
  includeSEO: z.boolean().default(true),
  includeGEO: z.boolean().default(true),
  includeAccessibility: z.boolean().default(true),
  includeSecurity: z.boolean().default(true),
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
        accessibility: validatedConfig.includeAccessibility,
        security: validatedConfig.includeSecurity,
      }
    });

    // Create audit run record
    const prisma = await getDbClient();
    const auditRun = await prisma.webAuditRun.create({
      data: {
        companyId: validatedConfig.companyId,
        url: validatedConfig.url,
        status: 'queued',
      },
    });

    // Queue the job for background processing
    await webAuditQueue.add('processWebAudit', {
      auditId: auditRun.id,
      url: validatedConfig.url,
      options: {
        includePerformance: validatedConfig.includePerformance,
        includeSEO: validatedConfig.includeSEO,
        includeGEO: validatedConfig.includeGEO,
        includeAccessibility: validatedConfig.includeAccessibility,
        includeSecurity: validatedConfig.includeSecurity,
      },
      companyId: validatedConfig.companyId,
    }, {
      jobId: auditRun.id, // Use audit ID as job ID for easy tracking
      delay: 0, // Start immediately
    });

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
    throw new Error(`Failed to start web audit: ${error instanceof Error ? error.message : String(error)}`);
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
    includeAccessibility: boolean;
    includeSecurity: boolean;
  },
  companyId: string
): Promise<AuditResult> {
  const startTime = Date.now();
  const prisma = await getDbClient();

  try {
    // Update status to running
    await prisma.webAuditRun.update({
      where: { id: auditId },
      data: { status: 'running' },
    });

    logger.info("Processing web audit", {
      auditId,
      url,
    });

    // Run analyses in parallel for better performance
    const analyses = await Promise.allSettled([
      options.includePerformance ? performanceAnalyzer.analyze(url) : null,
      options.includeSEO ? seoAnalyzer.analyze(url) : null,
      options.includeGEO ? geoAnalyzer.analyze(url) : null,
      options.includeAccessibility ? accessibilityAnalyzer.analyze(url) : null,
      options.includeSecurity ? securityAnalyzer.analyze(url) : null,
    ]);

    // Extract results
    const [performanceResult, seoResult, geoResult, accessibilityResult, securityResult] = analyses;

    const details: AuditResult['details'] = {};
    
    if (performanceResult.status === 'fulfilled' && performanceResult.value) {
      details.performance = performanceResult.value;
    }
    if (seoResult.status === 'fulfilled' && seoResult.value) {
      details.seo = seoResult.value;
    }
    if (geoResult.status === 'fulfilled' && geoResult.value) {
      details.geo = geoResult.value;
    }
    if (accessibilityResult.status === 'fulfilled' && accessibilityResult.value) {
      details.accessibility = accessibilityResult.value;
    }
    if (securityResult.status === 'fulfilled' && securityResult.value) {
      details.security = securityResult.value;
    }

    // Calculate scores
    const scores = auditScorer.calculateScores(details);

    // Generate recommendations
    const recommendations = auditScorer.generateRecommendations(details, scores);

    // Update database with results
    await prisma.webAuditRun.update({
      where: { id: auditId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        performanceScore: scores.performance,
        seoScore: scores.seo,
        geoScore: scores.geo,
        accessibilityScore: scores.accessibility,
        securityScore: scores.security,
        performance: details.performance ? JSON.parse(JSON.stringify(details.performance)) : {},
        seoTechnical: details.seo ? JSON.parse(JSON.stringify(details.seo)) : {},
        geoOptimization: details.geo ? JSON.parse(JSON.stringify(details.geo)) : {},
        accessibility: details.accessibility ? JSON.parse(JSON.stringify(details.accessibility)) : {},
        security: details.security ? JSON.parse(JSON.stringify(details.security)) : {},
      },
    });

    const processingTime = Date.now() - startTime;

    logger.info("Web audit completed successfully", {
      auditId,
      url,
      processingTime,
      scores: {
        performance: scores.performance,
        seo: scores.seo,
        geo: scores.geo,
        accessibility: scores.accessibility,
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
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

/**
 * Get audit status and results
 */
export async function getWebAuditResult(auditId: string): Promise<AuditResult | null> {
  try {
    const prisma = await getDbClient();
    const auditRun = await prisma.webAuditRun.findUnique({
      where: { id: auditId },
      include: { company: true },
    });

    if (!auditRun) {
      return null;
    }

    if (auditRun.status !== 'completed') {
      return {
        id: auditRun.id,
        scores: {
          performance: auditRun.performanceScore || 0,
          seo: auditRun.seoScore || 0,
          geo: auditRun.geoScore || 0,
          accessibility: auditRun.accessibilityScore || 0,
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
      accessibility: auditRun.accessibilityScore || 0,
      security: auditRun.securityScore || 0,
      overall: Math.round(
        ((auditRun.performanceScore || 0) +
         (auditRun.seoScore || 0) +
         (auditRun.geoScore || 0) +
         (auditRun.accessibilityScore || 0) +
         (auditRun.securityScore || 0)) / 5
      ),
    };

    const details = {
      performance: auditRun.performance as unknown as PerformanceResults || undefined,
      seo: auditRun.seoTechnical as unknown as SEOResults || undefined,
      geo: auditRun.geoOptimization as unknown as GEOResults || undefined,
      accessibility: auditRun.accessibility as unknown as AccessibilityResults || undefined,
      security: auditRun.security as unknown as SecurityResults || undefined,
    };

    // Generate fresh recommendations based on results
    const recommendations = auditScorer.generateRecommendations(details, scores);

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
    throw new Error(`Failed to get audit result: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get audit history for a company
 */
export async function getWebAuditHistory(companyId: string): Promise<Array<{
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
}>> {
  try {
    const prisma = await getDbClient();
    const auditRuns = await prisma.webAuditRun.findMany({
      where: { companyId },
      orderBy: { requestedAt: 'desc' },
      take: 50, // Limit to recent 50 audits
    });

    return auditRuns.map(run => ({
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
        overall: run.performanceScore && run.seoScore && run.geoScore && run.accessibilityScore && run.securityScore
          ? Math.round((run.performanceScore + run.seoScore + run.geoScore + run.accessibilityScore + run.securityScore) / 5)
          : null,
      },
    }));

  } catch (error) {
    logger.error("Failed to get web audit history", {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to get audit history: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete an audit run
 */
export async function deleteWebAudit(auditId: string, companyId: string): Promise<void> {
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
    throw new Error(`Failed to delete audit: ${error instanceof Error ? error.message : String(error)}`);
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