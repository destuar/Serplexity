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
import logger from "../utils/logger";
import { startWebAudit, getWebAuditResult, getWebAuditHistory, deleteWebAudit } from "../services/webAudit/webAuditService";

// Request validation schemas
const StartAuditSchema = z.object({
  url: z.string().url("Invalid URL format"),
  includePerformance: z.boolean().optional().default(true),
  includeSEO: z.boolean().optional().default(true),
  includeGEO: z.boolean().optional().default(true),
  includeAccessibility: z.boolean().optional().default(true),
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
        accessibility: validatedData.includeAccessibility,
        security: validatedData.includeSecurity,
      },
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Start the audit
    const auditId = await startWebAudit({
      url: validatedData.url,
      companyId,
      includePerformance: validatedData.includePerformance,
      includeSEO: validatedData.includeSEO,
      includeGEO: validatedData.includeGEO,
      includeAccessibility: validatedData.includeAccessibility,
      includeSecurity: validatedData.includeSecurity,
    });

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
        status: 'queued',
        estimatedTime: '2-3 minutes',
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

    // TODO: For this endpoint, we may need to validate company access through the audit record
    // since audit ID is the primary identifier, not company ID in URL
    // For now, we'll rely on the audit service to validate company access

    logger.info("Getting web audit result", {
      auditId: id,
      userId,
    });

    // Get audit result
    const result = await getWebAuditResult(id);

    if (!result) {
      res.status(404).json({
        error: "Not found",
        message: "Audit not found",
      });
      return;
    }

    // TODO: Add authorization check to ensure user can access this audit
    // For now, we trust the audit ID is sufficient

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
export async function getAuditHistory(req: Request, res: Response): Promise<void> {
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
export async function getAuditStatus(req: Request, res: Response): Promise<void> {
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

    // TODO: Similar to getAudit, we may need to validate company access through the audit record
    // For now, we'll rely on the audit service to validate company access

    // Get basic audit info (just status and metadata)
    const result = await getWebAuditResult(id);

    if (!result) {
      res.status(404).json({
        error: "Not found",
        message: "Audit not found",
      });
      return;
    }

    const responseTime = Date.now() - startTime;

    // Return only status information (no full results)
    const statusInfo = {
      id: result.id,
      url: result.metadata.url,
      status: result.scores.overall > 0 ? 'completed' : 'running',
      timestamp: result.metadata.timestamp,
      analysisTime: result.metadata.analysisTime,
      scores: result.scores.overall > 0 ? result.scores : undefined,
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
      service: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
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