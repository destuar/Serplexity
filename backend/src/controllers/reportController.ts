import { Request, Response } from 'express';
import { z } from 'zod';
import prisma, { prismaReadReplica } from '../config/db';
import redis from '../config/redis';
import { queueReport } from '../services/reportSchedulingService';
import { scheduleEmergencyReportTrigger } from '../queues/backupScheduler';
import { alertingService } from '../services/alertingService';
import { MODELS } from '../config/models';
import { getFullReportMetrics } from '../services/metricsService';
import {
    calculateCompetitorRankings,
    calculateTopQuestions,
    calculateShareOfVoiceHistory,
    calculateSentimentOverTime,
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
  const companyId = req.params.companyId;
  const force = req.query.force === 'true';
  
  controllerLog({
    endpoint,
    userId,
    companyId,
    metadata: {
      force,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    }
  }, 'Report creation request received');

  try {
    if (!userId) {
      const duration = Date.now() - startTime;
      controllerLog({
        endpoint,
        companyId,
        duration,
        statusCode: 401,
        metadata: { reason: 'missing_user_id' }
      }, 'Authentication failed - no user ID', 'WARN');
      
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please log in to generate reports'
      });
    }

    if (!companyId) {
      const duration = Date.now() - startTime;
      controllerLog({
        endpoint,
        userId,
        duration,
        statusCode: 400,
        metadata: { reason: 'missing_company_id' }
      }, 'Bad request - missing company ID', 'WARN');
      
      return res.status(400).json({ 
        error: 'Missing company ID',
        message: 'Company ID is required to generate reports'
      });
    }

    controllerLog({ endpoint, userId, companyId }, 'Validating user access to company');

    // Verify user has access to this company
    const company = await prisma.company.findFirst({
      where: { 
        id: companyId,
        userId: userId
      },
      include: {
        competitors: true,
        benchmarkingQuestions: true
      }
    });

    if (!company) {
      const duration = Date.now() - startTime;
      controllerLog({
        endpoint,
        userId,
        companyId,
        duration,
        statusCode: 404,
        metadata: { reason: 'company_not_found_or_access_denied' }
      }, 'Company not found or access denied', 'WARN');
      
      return res.status(404).json({ 
        error: 'Company not found',
        message: 'Company not found or you do not have access to it'
      });
    }

    // Enhanced validation for report generation prerequisites
    if (!company.competitors || company.competitors.length === 0) {
      const duration = Date.now() - startTime;
      controllerLog({
        endpoint,
        userId,
        companyId,
        duration,
        statusCode: 400,
        metadata: { 
          reason: 'no_competitors',
          companyName: company.name
        }
      }, 'Cannot generate report - no competitors configured', 'WARN');
      
      return res.status(400).json({
        error: 'No competitors configured',
        message: 'Please add at least one competitor to your company profile before generating a report'
      });
    }

    controllerLog({
      endpoint,
      userId,
      companyId,
      metadata: { 
        companyName: company.name,
        competitorsCount: company.competitors.length,
        benchmarkingQuestionsCount: company.benchmarkingQuestions.length
      }
    }, `Company validation successful: ${company.name}`);

    // Enhanced rate limiting check
    const rateLimitWindow = 60 * 1000; // 1 minute
    const maxRequestsPerWindow = 3;
    const now = Date.now();
    
    const recentRequests = await prisma.reportRun.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(now - rateLimitWindow)
        }
      }
    });

    if (recentRequests >= maxRequestsPerWindow && !force) {
      const duration = Date.now() - startTime;
      controllerLog({
        endpoint,
        userId,
        companyId,
        duration,
        statusCode: 429,
        metadata: { 
          reason: 'rate_limit_exceeded',
          recentRequests,
          maxRequestsPerWindow,
          windowMs: rateLimitWindow
        }
      }, 'Rate limit exceeded for report generation', 'WARN');
      
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many report generation requests. Please wait a moment before trying again.',
        retryAfter: Math.ceil(rateLimitWindow / 1000)
      });
    }

    // Check for any running reports for this company
    const runningReport = await prisma.reportRun.findFirst({
      where: {
        companyId,
        status: { in: ['PENDING', 'RUNNING'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (runningReport && !force) {
      const duration = Date.now() - startTime;
      controllerLog({
        endpoint,
        userId,
        companyId,
        duration,
        statusCode: 409,
        metadata: { 
          reason: 'concurrent_generation',
          existingRunId: runningReport.id,
          existingStatus: runningReport.status,
          existingCreatedAt: runningReport.createdAt
        }
      }, 'Concurrent report generation detected', 'WARN');
      
      return res.status(409).json({
        error: 'Report generation in progress',
        message: 'A report is already being generated for this company. Please wait for it to complete.',
        existingRunId: runningReport.id,
        status: runningReport.status
      });
    }

    // Queue the report generation with enhanced error handling
    controllerLog({ endpoint, userId, companyId }, 'Initiating report queue process');
    
    try {
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
          companyName: company.name,
          competitorsCount: company.competitors.length
        }
      }, `Report ${result.isNew ? 'queued' : 'existing'} - Run ID: ${result.runId}`);

      if (result.isNew) {
        return res.status(202).json({
          message: 'Report generation has been queued successfully',
          runId: result.runId,
          estimatedTime: '2-5 minutes',
          status: 'PENDING'
        });
      } else {
        return res.status(200).json({
          message: 'A report for today has already been generated or is in progress',
          runId: result.runId,
          status: result.status
        });
      }
    } catch (queueError) {
      const duration = Date.now() - startTime;
      
      // Enhanced error handling for different queue error types
      let statusCode = 500;
      let errorMessage = 'Failed to queue report generation';
      let userMessage = 'An internal error occurred while starting report generation. Please try again.';
      
      if (queueError instanceof Error) {
        if (queueError.message.includes('already being processed')) {
          statusCode = 409;
          errorMessage = 'Concurrent generation detected';
          userMessage = 'A report is already being generated for this company. Please wait for it to complete.';
        } else if (queueError.message.includes('Company with ID') && queueError.message.includes('not found')) {
          statusCode = 404;
          errorMessage = 'Company not found during queue process';
          userMessage = 'Company not found or access denied';
        } else if (queueError.message.includes('queue is not available')) {
          statusCode = 503;
          errorMessage = 'Report generation service unavailable';
          userMessage = 'Report generation service is temporarily unavailable. Please try again later.';
        }
      }
      
      controllerLog({
        endpoint,
        userId,
        companyId,
        duration,
        statusCode,
        error: queueError,
        metadata: {
          errorType: queueError instanceof Error ? queueError.constructor.name : 'Unknown',
          companyName: company.name
        }
      }, `Queue error: ${errorMessage}`, 'ERROR');
      
      return res.status(statusCode).json({
        error: errorMessage,
        message: userMessage
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    controllerLog({
      endpoint,
      userId,
      companyId,
      duration,
      statusCode: 500,
      error,
      metadata: {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    }, `Unexpected error in report creation: ${error instanceof Error ? error.message : String(error)}`, 'ERROR');
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
    });
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
  const effectiveModel = (aiModel as string | undefined) || 'all';

  try {
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const latestRun = await prismaReadReplica.reportRun.findFirst({
      where: { companyId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: {
        optimizationTasks: {
          orderBy: { taskId: 'asc' },
        },
      },
    });

    if (!latestRun) {
      return res.status(404).json({ error: 'No completed report found for this company.' });
    }

    // Fetch all pre-computed metrics for the latest report
    const metrics = await getFullReportMetrics(latestRun.id, effectiveModel);

    // Fetch sentiment details from SentimentScore table
    let sentimentDetails: any[] = [];
    try {
      const sentimentScores = await prismaReadReplica.sentimentScore.findMany({
        where: { 
          runId: latestRun.id,
          name: 'Detailed Sentiment Scores'
        },
        select: {
          engine: true,
          value: true,
          name: true
        }
      });

      // Transform sentiment scores into the expected format
      sentimentDetails = sentimentScores.map(score => ({
        name: score.name,
        engine: score.engine,
        value: score.value
      }));

      controllerLog({ 
        endpoint, 
        userId, 
        companyId, 
        reportId: latestRun.id,
        metadata: { sentimentScoresFound: sentimentDetails.length }
      }, `Fetched ${sentimentDetails.length} sentiment details for dashboard`);
    } catch (error) {
      controllerLog({ 
        endpoint, 
        userId, 
        companyId, 
        reportId: latestRun.id, 
        error 
      }, 'Failed to fetch sentiment details', 'ERROR');
      // Continue without sentiment details rather than failing the entire request
    }

    // If shareOfVoiceHistory is missing (which it is for individual models), fetch it on demand
    let shareOfVoiceHistory = (metrics as any)?.shareOfVoiceHistory;
    if (!shareOfVoiceHistory || (Array.isArray(shareOfVoiceHistory) && shareOfVoiceHistory.length === 0)) {
      shareOfVoiceHistory = await calculateShareOfVoiceHistory(latestRun.id, companyId, { aiModel: effectiveModel });
    }

    // Similarly, fetch sentimentOverTime if it's not on the main metrics object
    let sentimentOverTime = (metrics as any)?.sentimentOverTime;
    if (!sentimentOverTime || (Array.isArray(sentimentOverTime) && sentimentOverTime.length === 0)) {
        sentimentOverTime = await calculateSentimentOverTime(latestRun.id, companyId, { aiModel: effectiveModel });
    }

    if (!metrics) {
      // This might happen if metrics haven't been computed yet for this run/model.
      return res.status(404).json({ error: 'Metrics not available for the latest report.' });
    }

    // If the latest report has no optimization tasks, fallback to the newest report that does.
    let optimizationTasks = latestRun.optimizationTasks || [];

    if (!optimizationTasks || optimizationTasks.length === 0) {
      const tasksSourceRun = await prismaReadReplica.reportRun.findFirst({
        where: {
          companyId,
          status: 'COMPLETED',
          optimizationTasks: {
            some: {},
          },
        },
        select: {
          optimizationTasks: {
            orderBy: { taskId: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      optimizationTasks = tasksSourceRun?.optimizationTasks ?? [];
    }

    const responseData = {
      id: latestRun.id,
      runId: latestRun.id,
      companyId: latestRun.companyId,
      createdAt: latestRun.createdAt,
      updatedAt: latestRun.updatedAt,
      lastUpdated: latestRun.updatedAt.toISOString(),
      aiVisibilitySummary: latestRun.aiVisibilitySummary || null,
      optimizationTasks,
      sentimentDetails, // Add sentiment details to the response
      ...metrics, // Spread all the pre-computed metrics (may include history if present)
      shareOfVoiceHistory, // Ensure history is always present
      sentimentOverTime, // Ensure sentiment history is always present
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

/**
 * Emergency endpoint to manually trigger report generation for a specific company
 * Should be used when the daily scheduler fails or when immediate report is needed
 */
export const emergencyTriggerCompanyReport = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { companyId } = req.params;
  const { reason = 'Manual emergency trigger' } = req.body;

  controllerLog({
    endpoint: 'POST /emergency/companies/:companyId/trigger-report',
    companyId,
    metadata: { reason }
  }, 'Emergency report trigger requested');

  try {
    // Validate company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true }
    });

    if (!company) {
      const duration = Date.now() - startTime;
      controllerLog({
        endpoint: 'POST /emergency/companies/:companyId/trigger-report',
        companyId,
        duration,
        statusCode: 404
      }, 'Company not found for emergency trigger', 'ERROR');
      return res.status(404).json({ error: 'Company not found' });
    }

    // Force=true to bypass daily cache for emergency
    const result = await queueReport(companyId, true);
    
    const duration = Date.now() - startTime;
    controllerLog({
      endpoint: 'POST /emergency/companies/:companyId/trigger-report',
      companyId,
      duration,
      statusCode: 200,
      metadata: { 
        runId: result.runId,
        isNew: result.isNew,
        status: result.status,
        reason
      }
    }, `Emergency report trigger successful for ${company.name}`);

    // Send alert about manual trigger
    await alertingService.alertSystemIssue({
      component: 'SCHEDULER',
      message: `Manual emergency report triggered for company: ${company.name}`,
      details: {
        companyId,
        companyName: company.name,
        runId: result.runId,
        reason,
        isNew: result.isNew,
        triggeredBy: 'manual_api_call'
      },
      timestamp: new Date()
    }).catch(alertError => {
      console.error('[ReportController] Failed to send manual trigger alert:', alertError);
    });

    res.status(200).json({
      success: true,
      runId: result.runId,
      isNew: result.isNew,
      status: result.status,
      message: `Emergency report triggered for ${company.name}`,
      reason
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    controllerLog({
      endpoint: 'POST /emergency/companies/:companyId/trigger-report',
      companyId,
      duration,
      statusCode: 500,
      error
    }, 'Emergency report trigger failed', 'ERROR');

    res.status(500).json({ 
      error: 'Failed to trigger emergency report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Emergency endpoint to trigger reports for ALL eligible companies
 * Should be used only in case of catastrophic scheduler failure
 */
export const emergencyTriggerAllReports = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { reason = 'Manual emergency trigger for all companies', delayMinutes = 0 } = req.body;

  controllerLog({
    endpoint: 'POST /emergency/trigger-all-reports',
    metadata: { reason, delayMinutes }
  }, 'Emergency all-reports trigger requested');

  try {
    // Validate delay is reasonable (max 24 hours)
    const maxDelayMinutes = 24 * 60;
    if (delayMinutes < 0 || delayMinutes > maxDelayMinutes) {
      return res.status(400).json({ 
        error: `Delay must be between 0 and ${maxDelayMinutes} minutes (24 hours)` 
      });
    }

    // Get count of eligible companies for response
    const eligibleCompaniesCount = await prisma.company.count({
      where: {
        runs: {
          some: {
            status: 'COMPLETED',
          },
        },
      },
    });

    if (eligibleCompaniesCount === 0) {
      const duration = Date.now() - startTime;
      controllerLog({
        endpoint: 'POST /emergency/trigger-all-reports',
        duration,
        statusCode: 200,
        metadata: { eligibleCompaniesCount: 0 }
      }, 'No eligible companies found for emergency trigger');
      
      return res.status(200).json({
        success: true,
        message: 'No eligible companies found (companies need at least one completed report)',
        eligibleCompaniesCount: 0
      });
    }

    // Schedule the emergency trigger
    await scheduleEmergencyReportTrigger(delayMinutes);
    
    const duration = Date.now() - startTime;
    const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    controllerLog({
      endpoint: 'POST /emergency/trigger-all-reports',
      duration,
      statusCode: 200,
      metadata: { 
        eligibleCompaniesCount,
        delayMinutes,
        scheduledTime: scheduledTime.toISOString(),
        reason
      }
    }, `Emergency all-reports trigger scheduled for ${eligibleCompaniesCount} companies`);

    // Send immediate alert about the emergency trigger
    await alertingService.alertSystemIssue({
      component: 'SCHEDULER',
      message: `Emergency trigger scheduled for ALL companies`,
      details: {
        eligibleCompaniesCount,
        reason,
        delayMinutes,
        scheduledTime: scheduledTime.toISOString(),
        triggeredBy: 'manual_api_call'
      },
      timestamp: new Date()
    }).catch(alertError => {
      console.error('[ReportController] Failed to send emergency all-trigger alert:', alertError);
    });

    res.status(200).json({
      success: true,
      message: `Emergency report generation scheduled for ${eligibleCompaniesCount} companies`,
      eligibleCompaniesCount,
      scheduledTime: scheduledTime.toISOString(),
      delayMinutes,
      reason
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    controllerLog({
      endpoint: 'POST /emergency/trigger-all-reports',
      duration,
      statusCode: 500,
      error
    }, 'Emergency all-reports trigger failed', 'ERROR');

    res.status(500).json({ 
      error: 'Failed to schedule emergency report generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * System health check endpoint that validates all critical components
 */
export const getSystemHealth = async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const healthChecks = {
      database: { status: 'unknown', details: {} as any },
      redis: { status: 'unknown', details: {} as any },
      scheduler: { status: 'unknown', details: {} as any },
      recentReports: { status: 'unknown', details: {} as any }
    };

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthChecks.database.status = 'healthy';
    } catch (dbError) {
      healthChecks.database.status = 'unhealthy';
      healthChecks.database.details = { error: dbError instanceof Error ? dbError.message : 'Unknown error' };
    }

    // Check Redis connection
    try {
      await redis.ping();
      healthChecks.redis.status = 'healthy';
    } catch (redisError) {
      healthChecks.redis.status = 'unhealthy';
      healthChecks.redis.details = { error: redisError instanceof Error ? redisError.message : 'Unknown error' };
    }

    // Check recent report generation (last 24 hours)
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentReports = await prisma.reportRun.count({
        where: { createdAt: { gte: last24Hours } }
      });
      const failedReports = await prisma.reportRun.count({
        where: { 
          createdAt: { gte: last24Hours },
          status: 'FAILED'
        }
      });
      
      healthChecks.recentReports.status = recentReports > 0 ? 'healthy' : 'warning';
      healthChecks.recentReports.details = {
        totalReports: recentReports,
        failedReports,
        successRate: recentReports > 0 ? ((recentReports - failedReports) / recentReports * 100).toFixed(1) + '%' : 'N/A'
      };
    } catch (reportsError) {
      healthChecks.recentReports.status = 'unhealthy';
      healthChecks.recentReports.details = { error: reportsError instanceof Error ? reportsError.message : 'Unknown error' };
    }

    // Overall health status
    const allHealthy = Object.values(healthChecks).every(check => check.status === 'healthy');
    const hasUnhealthy = Object.values(healthChecks).some(check => check.status === 'unhealthy');
    
    const overallStatus = allHealthy ? 'healthy' : hasUnhealthy ? 'unhealthy' : 'degraded';
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    const duration = Date.now() - startTime;
    
    controllerLog({
      endpoint: 'GET /system/health',
      duration,
      statusCode,
      metadata: { overallStatus, ...healthChecks }
    }, `System health check completed - Status: ${overallStatus}`);

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: healthChecks,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    controllerLog({
      endpoint: 'GET /system/health',
      duration,
      statusCode: 500,
      error
    }, 'System health check failed', 'ERROR');

    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    });
  }
};

 