import { Request, Response } from 'express';
import { z } from 'zod';
import prisma, { prismaReadReplica } from '../config/db';
import redis from '../config/redis';
import { queueReport } from '../services/reportSchedulingService';
import { MODELS } from '../config/models';
import { getFullReportMetrics } from '../services/metricsService';
import {
    calculateCompetitorRankings,
    calculateTopQuestions,
} from '../services/dashboardService';

// Enhanced logging system for the report controller
interface ControllerLogContext {
    endpoint: string;
    userId?: string;
    companyId?: string;
    reportId?: string;
    duration?: number;
    statusCode?: number;
    error?: unknown;
    metadata?: Record<string, any>;
}

const controllerLog = (context: ControllerLogContext, message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO') => {
    const timestamp = new Date().toISOString();
    const { endpoint, userId, companyId, reportId, duration, statusCode, error, metadata } = context;
    
    let logLine = `[${timestamp}][ReportController][${endpoint}][${level}]`;
    
    if (userId) logLine += `[User:${userId}]`;
    if (companyId) logLine += `[Company:${companyId}]`;
    if (reportId) logLine += `[Report:${reportId}]`;
    if (duration !== undefined) logLine += `[${duration}ms]`;
    if (statusCode) logLine += `[HTTP:${statusCode}]`;
    
    logLine += ` ${message}`;
    
    if (metadata && Object.keys(metadata).length > 0) {
        logLine += ` | Meta: ${JSON.stringify(metadata)}`;
    }
    
    console.log(logLine);
    
    if (error) {
        const errorDetails = error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : {
            message: String(error),
            stack: undefined,
            name: 'Unknown'
        };
        
        console.error(`[${timestamp}][ReportController][${endpoint}][ERROR_DETAIL]`, {
            ...errorDetails,
            userId,
            companyId,
            reportId,
            metadata
        });
    }
};

const createReportSchema = z.object({
  companyId: z.string(),
  force: z.boolean().optional().default(false),
});

export const createReport = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const endpoint = 'CREATE_REPORT';
  const userId = req.user?.id;

  controllerLog({ 
    endpoint, 
    userId,
    metadata: { 
      requestBody: req.body,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    }
  }, 'Report creation request received');

  try {
    const { companyId, force } = createReportSchema.parse(req.body);
    
    controllerLog({ 
      endpoint, 
      userId, 
      companyId,
      metadata: { force }
    }, `Request validated - Force mode: ${force}`);

    if (!userId) {
      const duration = Date.now() - startTime;
      controllerLog({ 
        endpoint, 
        duration, 
        statusCode: 401,
        metadata: { reason: 'missing_user_id' }
      }, 'Authentication failed - no user ID', 'WARN');
      
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify the user has access to this company before proceeding
    controllerLog({ endpoint, userId, companyId }, 'Verifying user access to company');
    
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: userId },
    });

    if (!company) {
      const duration = Date.now() - startTime;
      controllerLog({ 
        endpoint, 
        userId, 
        companyId, 
        duration, 
        statusCode: 403,
        metadata: { reason: 'access_denied' }
      }, 'Access denied - company not found or access not permitted', 'WARN');
      
      return res.status(403).json({ error: 'Access to this company is denied or company does not exist' });
    }

    controllerLog({ 
      endpoint, 
      userId, 
      companyId,
      metadata: { companyName: company.name }
    }, `Company access verified: ${company.name}`);

    // Queue the report generation
    controllerLog({ endpoint, userId, companyId }, 'Initiating report queue process');
    
    const result = await queueReport(companyId, force);
    
    const duration = Date.now() - startTime;
    const statusCode = result.isNew ? 202 : 200;
    
    controllerLog({ 
      endpoint, 
      userId, 
      companyId, 
      reportId: result.runId,
      duration, 
      statusCode,
      metadata: { 
        isNew: result.isNew,
        status: result.status,
        companyName: company.name
      }
    }, `Report ${result.isNew ? 'queued' : 'existing'} - Run ID: ${result.runId}`);

    if (result.isNew) {
        return res.status(202).json({
            message: 'Report generation has been queued',
            runId: result.runId,
        });
    } else {
        return res.status(200).json({
            message: 'A report for today has already been generated or is in progress.',
            runId: result.runId,
            status: result.status,
        });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof z.ZodError) {
      controllerLog({ 
        endpoint, 
        userId, 
        duration, 
        statusCode: 400, 
        error,
        metadata: { validationErrors: error.errors }
      }, 'Request validation failed', 'ERROR');
      
      return res.status(400).json({ error: error.errors });
    }
    
          controllerLog({ 
        endpoint, 
        userId, 
        duration, 
        statusCode: 500, 
        error,
        metadata: { 
          errorType: error instanceof Error ? error.name : 'Unknown',
          companyId: req.body?.companyId
        }
      }, 'Internal server error during report creation', 'ERROR');
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReportStatus = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const endpoint = 'GET_REPORT_STATUS';
  const userId = req.user?.id;
  const reportId = req.params.id;

  controllerLog({ 
    endpoint, 
    userId, 
    reportId,
    metadata: { 
      userAgent: req.headers['user-agent'],
      ip: req.ip
    }
  }, 'Report status request received');

  try {
    if (!userId) {
      const duration = Date.now() - startTime;
      controllerLog({ 
        endpoint, 
        reportId, 
        duration, 
        statusCode: 401
      }, 'Authentication failed', 'WARN');
      
      return res.status(401).json({ error: 'User not authenticated' });
    }

    controllerLog({ endpoint, userId, reportId }, 'Fetching report status from database');

    const report = await prismaReadReplica.reportRun.findFirst({
      where: {
        id: reportId,
        company: {
          userId: userId,
        },
      },
      select: {
        id: true,
        status: true,
        stepStatus: true,
        createdAt: true,
        updatedAt: true,
        company: {
          select: {
            id: true,
            name: true
          }
        }
      },
    });

    const duration = Date.now() - startTime;

    if (!report) {
      controllerLog({ 
        endpoint, 
        userId, 
        reportId, 
        duration, 
        statusCode: 404,
        metadata: { reason: 'report_not_found' }
      }, 'Report not found or access denied', 'WARN');
      
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    controllerLog({ 
      endpoint, 
      userId, 
      reportId, 
      companyId: report.company.id,
      duration, 
      statusCode: 200,
      metadata: { 
        status: report.status,
        stepStatus: report.stepStatus,
        companyName: report.company.name
      }
    }, `Report status retrieved: ${report.status}`);

    res.status(200).json({
      id: report.id,
      status: report.status,
      stepStatus: report.stepStatus,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    controllerLog({ 
      endpoint, 
      userId, 
      reportId, 
      duration, 
      statusCode: 500, 
      error,
      metadata: { errorType: error instanceof Error ? error.name : 'Unknown' }
    }, 'Internal server error while fetching report status', 'ERROR');
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLatestReport = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const endpoint = 'GET_LATEST_REPORT';
  const userId = req.user?.id;
  const companyId = req.params.companyId;
  const { aiModel } = req.query;

  try {
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const latestRun = await prismaReadReplica.reportRun.findFirst({
      where: { companyId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestRun) {
      return res.status(404).json({ error: 'No completed report found for this company.' });
    }

    // Fetch all pre-computed metrics for the latest report
    const metrics = await getFullReportMetrics(latestRun.id, aiModel as string || 'all');

    if (!metrics) {
      // This might happen if metrics haven't been computed yet for this run/model.
      return res.status(404).json({ error: 'Metrics not available for the latest report.' });
    }

    // Construct the final response object
    const responseData = {
      id: latestRun.id,
      runId: latestRun.id,
      companyId: latestRun.companyId,
      createdAt: latestRun.createdAt,
      updatedAt: latestRun.updatedAt,
      lastUpdated: latestRun.updatedAt.toISOString(),
      ...metrics, // Spread all the pre-computed metrics
    };

    const duration = Date.now() - startTime;
    controllerLog({ endpoint, userId, companyId, reportId: latestRun.id, duration, statusCode: 200 }, 'Successfully retrieved latest report with pre-computed metrics');
    
    return res.status(200).json(responseData);

  } catch (error) {
    const duration = Date.now() - startTime;
    controllerLog({ 
      endpoint, 
      userId, 
      companyId, 
      duration, 
      statusCode: 500, 
      error,
      metadata: { errorType: error instanceof Error ? error.name : 'Unknown' }
    }, `Failed to retrieve latest report for company ${companyId}`, 'ERROR');
    
    res.status(500).json({ error: 'Failed to retrieve report' });
  }
};

export const getCompetitorRankingsForReport = async (req: Request, res: Response) => {
  const { runId } = req.params;
  const { companyId, aiModel } = req.query;

  if (!runId || !companyId) {
    return res.status(400).json({ error: 'runId and companyId are required' });
  }

  try {
    const rankings = await calculateCompetitorRankings(runId, companyId as string, { aiModel: aiModel as string | undefined });
    return res.status(200).json(rankings);
  } catch (error) {
    console.error(`Failed to get competitor rankings for report ${runId}`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReportResponses = async (req: Request, res: Response) => {
  const { runId } = req.params;
  const { companyId, aiModel, page = '1', limit = '100' } = req.query;

  if (!runId || !companyId) {
    return res.status(400).json({ error: 'runId and companyId are required' });
  }

  try {
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // We can reuse the top questions logic, but remove the limit and add pagination
    const responses = await calculateTopQuestions(runId, companyId as string, { aiModel: aiModel as string | undefined }, limitNum, skip);
    // In a real scenario, we'd also return total count for pagination controls
    return res.status(200).json(responses);
  } catch (error) {
    console.error(`Failed to get responses for report ${runId}`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

 