/**
 * @file webAuditController.ts
 * @description Web audit controller for handling audit requests
 *
 * Provides REST API endpoints for:
 * - Starting new web audits
 * - Checking audit status
 * - Retrieving audit results
 * - Managing audit history
 *
 * @dependencies
 * - webAuditService: Core audit logic
 * - Request validation and error handling
 * - Authentication and authorization
 */

import { Request, Response } from "express";
import { z } from "zod";
import {
  deleteWebAudit,
  getAuditJobProgress,
  getWebAuditHistory,
  getWebAuditResult,
  startWebAudit,
} from "../services/webAudit/webAuditService";
import logger from "../utils/logger";

// Request validation schemas
const StartAuditSchema = z.object({
  url: z.string().url("Invalid URL format"),
  includePerformance: z.boolean().optional().default(true),
  includeSEO: z.boolean().optional().default(true),
  includeGEO: z.boolean().optional().default(true),
  includeSecurity: z.boolean().optional().default(true),
});

const AuditIdSchema = z.object({
  id: z.string().min(1, "Audit ID is required"),
});

const CompanyIdSchema = z.object({
  companyId: z.string().min(1, "Company ID is required"),
});

/**
 * Start a new web audit
 * POST /api/web-audit/start
 */
export async function startAudit(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    // Get company ID from URL parameters (following report controller pattern)
    const userId = req.user?.id;
    const companyId = req.params.companyId;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
        message: "Please log in to run web audits",
      });
      return;
    }

    if (!companyId) {
      res.status(400).json({
        error: "Missing company ID",
        message: "Company ID is required to run web audits",
      });
      return;
    }

    // Verify user has access to this company (following report controller pattern)
    const { getPrismaClient } = await import("../config/dbCache");
    const prisma = await getPrismaClient();

    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        userId: userId,
      },
    });

    if (!company) {
      res.status(404).json({
        error: "Company not found",
        message: "Company not found or you do not have access to it",
      });
      return;
    }

    // Validate request body
    const validatedData = StartAuditSchema.parse(req.body);

    logger.info("Starting web audit request", {
      companyId,
      url: validatedData.url,
      analysisTypes: {
        performance: validatedData.includePerformance,
        seo: validatedData.includeSEO,
        geo: validatedData.includeGEO,
        security: validatedData.includeSecurity,
      },
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });

    // Start the primary audit
    const auditId = await startWebAudit({
      url: validatedData.url,
      companyId,
      includePerformance: validatedData.includePerformance,
      includeSEO: validatedData.includeSEO,
      includeGEO: validatedData.includeGEO,
      includeSecurity: validatedData.includeSecurity,
      summaryOnly: false,
    });

    // Optional fanout to accepted competitors (scores only)
    const fanout = (req.query.fanout as string) === "accepted";
    if (fanout) {
      const competitors = await prisma.competitor.findMany({
        where: { companyId, isAccepted: true },
        select: { website: true },
      });
      const competitorWebsites = competitors
        .map((c) => c.website)
        .filter((w): w is string => typeof w === "string" && w.length > 0);

      if (competitorWebsites.length > 0) {
        // Fire-and-forget enqueue for competitor websites with summaryOnly
        await Promise.allSettled(
          competitorWebsites.map((site) =>
            startWebAudit({
              url: site,
              companyId,
              includePerformance: true,
              includeSEO: true,
              includeGEO: true,
              includeSecurity: true,
              summaryOnly: true,
            })
          )
        );
      }
    }

    const responseTime = Date.now() - startTime;

    logger.info("Web audit started successfully", {
      auditId,
      companyId,
      url: validatedData.url,
      responseTime,
    });

    res.status(202).json({
      success: true,
      data: {
        auditId,
        status: "queued",
        estimatedTime: "2-3 minutes",
        url: validatedData.url,
      },
      message: "Web audit started successfully",
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error("Failed to start web audit", {
      companyId: req.params.companyId,
      url: req.body?.url,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation error",
        message: "Invalid request data",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to start web audit",
    });
  }
}

/**
 * Get audit status and results
 * GET /api/web-audit/:id
 */
export async function getAudit(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    // Validate audit ID
    const { id } = AuditIdSchema.parse(req.params);
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
        message: "Please log in to access audits",
      });
      return;
    }

    logger.info("Getting web audit result", {
      auditId: id,
      userId,
    });

    // Authorization: ensure the audit belongs to a company owned by this user
    const { getPrismaClient } = await import("../config/dbCache");
    const prisma = await getPrismaClient();
    const audit = await prisma.webAuditRun.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        company: { select: { userId: true } },
      },
    });

    if (!audit) {
      res.status(404).json({ error: "Not found", message: "Audit not found" });
      return;
    }

    if (audit.company.userId !== userId) {
      res.status(403).json({
        error: "Forbidden",
        message: "You do not have access to this audit",
      });
      return;
    }

    // Get audit result
    const result = await getWebAuditResult(id);

    if (!result) {
      res.status(404).json({
        error: "Not found",
        message: "Audit not found",
      });
      return;
    }

    const responseTime = Date.now() - startTime;

    logger.info("Web audit result retrieved", {
      auditId: id,
      responseTime,
      hasResults: !!result.details,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error("Failed to get web audit result", {
      auditId: req.params.id,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation error",
        message: "Invalid audit ID",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve audit result",
    });
  }
}

/**
 * Get audit history for company
 * GET /api/web-audit/history
 */
export async function getAuditHistory(
  req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();

  try {
    // Get company ID from URL parameters (following report controller pattern)
    const userId = req.user?.id;
    const companyId = req.params.companyId;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
        message: "Please log in to access audit history",
      });
      return;
    }

    if (!companyId) {
      res.status(400).json({
        error: "Missing company ID",
        message: "Company ID is required to access audit history",
      });
      return;
    }

    // Verify user has access to this company
    const { getPrismaClient } = await import("../config/dbCache");
    const prisma = await getPrismaClient();

    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        userId: userId,
      },
    });

    if (!company) {
      res.status(404).json({
        error: "Company not found",
        message: "Company not found or you do not have access to it",
      });
      return;
    }

    logger.info("Getting web audit history", {
      companyId,
    });

    // Get audit history
    const history = await getWebAuditHistory(companyId);

    const responseTime = Date.now() - startTime;

    logger.info("Web audit history retrieved", {
      companyId,
      responseTime,
      auditCount: history.length,
    });

    res.status(200).json({
      success: true,
      data: {
        audits: history,
        total: history.length,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error("Failed to get web audit history", {
      companyId: req.params.companyId,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve audit history",
    });
  }
}

/**
 * Get competitor latest visibility scores (accepted competitors)
 * GET /api/web-audit/companies/:companyId/competitor-scores
 */
export async function getCompetitorScores(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = req.user?.id;
    const companyId = req.params.companyId;
    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!companyId) {
      res.status(400).json({ error: "Missing company ID" });
      return;
    }

    const { getPrismaClient } = await import("../config/dbCache");
    const prisma = await getPrismaClient();

    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    const competitors = await prisma.competitor.findMany({
      where: { companyId, isAccepted: true },
      select: { name: true, website: true },
      orderBy: { name: "asc" },
    });

    const results = await Promise.all(
      competitors.map(async (comp) => {
        const run = await prisma.webAuditRun.findFirst({
          where: { companyId, url: comp.website, status: "completed" },
          orderBy: { completedAt: "desc" },
        });
        const scores = run
          ? {
              overall: Math.round(
                ((run.performanceScore || 0) +
                  (run.seoScore || 0) +
                  (run.geoScore || 0) +
                  (run.securityScore || 0)) /
                  4
              ),
              performance: run.performanceScore || 0,
              seo: run.seoScore || 0,
              geo: run.geoScore || 0,
              security: run.securityScore || 0,
            }
          : null;

        return {
          name: comp.name,
          website: comp.website,
          scores,
          completedAt: run?.completedAt || null,
        };
      })
    );

    // Sort by overall desc (nulls last)
    results.sort((a, b) => {
      const ao = a.scores?.overall ?? -1;
      const bo = b.scores?.overall ?? -1;
      return bo - ao;
    });

    res.status(200).json({ success: true, data: { competitors: results } });
  } catch (error) {
    logger.error("Failed to get competitor scores", {
      companyId: req.params.companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve competitor scores",
    });
  }
}

/**
 * Delete an audit
 * DELETE /api/web-audit/:id
 */
export async function deleteAudit(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();

  try {
    // Get company ID and audit ID from URL parameters
    const userId = req.user?.id;
    const companyId = req.params.companyId;
    const { id } = AuditIdSchema.parse(req.params);

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
        message: "Please log in to delete audits",
      });
      return;
    }

    if (!companyId) {
      res.status(400).json({
        error: "Missing company ID",
        message: "Company ID is required to delete audits",
      });
      return;
    }

    // Verify user has access to this company
    const { getPrismaClient } = await import("../config/dbCache");
    const prisma = await getPrismaClient();

    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        userId: userId,
      },
    });

    if (!company) {
      res.status(404).json({
        error: "Company not found",
        message: "Company not found or you do not have access to it",
      });
      return;
    }

    logger.info("Deleting web audit", {
      auditId: id,
      companyId,
    });

    // Delete the audit
    await deleteWebAudit(id, companyId);

    const responseTime = Date.now() - startTime;

    logger.info("Web audit deleted successfully", {
      auditId: id,
      companyId,
      responseTime,
    });

    res.status(200).json({
      success: true,
      message: "Audit deleted successfully",
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error("Failed to delete web audit", {
      auditId: req.params.id,
      companyId: req.params.companyId,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Validation error",
        message: "Invalid audit ID",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to delete audit",
    });
  }
}

/**
 * Get audit status only (lightweight endpoint)
 * GET /api/web-audit/:id/status
 */
export async function getAuditStatus(
  req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();

  try {
    // Validate audit ID
    const { id } = AuditIdSchema.parse(req.params);
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
        message: "Please log in to access audit status",
      });
      return;
    }

    // Authorization: ensure the audit belongs to a company owned by this user
    const { getPrismaClient } = await import("../config/dbCache");
    const prisma = await getPrismaClient();
    const audit = await prisma.webAuditRun.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        company: { select: { userId: true } },
      },
    });

    if (!audit) {
      res.status(404).json({ error: "Not found", message: "Audit not found" });
      return;
    }

    if (audit.company.userId !== userId) {
      res.status(403).json({
        error: "Forbidden",
        message: "You do not have access to this audit",
      });
      return;
    }

    // Prefer DB status to infer state accurately (reuse prisma from above)
    const run = await prisma.webAuditRun.findUnique({
      where: { id },
      select: {
        id: true,
        url: true,
        status: true,
        requestedAt: true,
        completedAt: true,
        performanceScore: true,
        seoScore: true,
        geoScore: true,
        securityScore: true,
      },
    });

    if (!run) {
      res.status(404).json({ error: "Not found", message: "Audit not found" });
      return;
    }

    const responseTime = Date.now() - startTime;

    // Job progress hint for UI (best-effort)
    const jobProgress = await getAuditJobProgress(id);
    const statusValue = run.status as
      | "queued"
      | "running"
      | "completed"
      | "failed";
    const isCompleted = statusValue === "completed";
    const scores = isCompleted
      ? {
          performance: run.performanceScore || 0,
          seo: run.seoScore || 0,
          geo: run.geoScore || 0,
          security: run.securityScore || 0,
          overall: Math.round(
            ((run.performanceScore || 0) +
              (run.seoScore || 0) +
              (run.geoScore || 0) +
              (run.securityScore || 0)) /
              4
          ),
        }
      : undefined;

    const statusInfo = {
      id: run.id,
      url: run.url,
      status: statusValue,
      timestamp: run.requestedAt,
      analysisTime:
        run.completedAt && run.requestedAt
          ? run.completedAt.getTime() - run.requestedAt.getTime()
          : 0,
      progress: isCompleted ? 100 : (jobProgress ?? undefined),
      scores,
    };

    res.status(200).json({
      success: true,
      data: statusInfo,
    });

    logger.info("Web audit status retrieved", {
      auditId: id,
      status: statusInfo.status,
      responseTime,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error("Failed to get web audit status", {
      auditId: req.params.id,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to retrieve audit status",
    });
  }
}

/**
 * Health check endpoint for web audit service
 * GET /api/web-audit/health
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  try {
    // Basic health checks
    const checks = {
      service: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    };

    // TODO: Add more sophisticated health checks
    // - Database connectivity
    // - PageSpeed API connectivity
    // - Queue system health

    res.status(200).json({
      success: true,
      data: checks,
    });
  } catch (error) {
    logger.error("Health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      error: "Service unhealthy",
      message: "Health check failed",
    });
  }
}
