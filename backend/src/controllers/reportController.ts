import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/db';
import { queueReport } from '../services/reportSchedulingService';

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

    const report = await prisma.reportRun.findFirst({
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
  
  // Extract filters from query parameters
  const { dateRange, aiModel, company, competitors } = req.query;

  controllerLog({ 
    endpoint, 
    userId, 
    companyId,
    metadata: { 
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      filters: { dateRange, aiModel, company, competitors }
    }
  }, 'Latest report request received with filters');

  try {
    controllerLog({ endpoint, userId, companyId }, 'Searching for latest completed report');

    // 1. Find the most recent completed ReportRun for the company
    const latestRun = await prisma.reportRun.findFirst({
      where: {
        companyId: companyId,
        status: 'COMPLETED',
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!latestRun) {
      const duration = Date.now() - startTime;
      controllerLog({ 
        endpoint, 
        userId, 
        companyId, 
        duration, 
        statusCode: 404,
        metadata: { reason: 'no_completed_reports' }
      }, 'No completed report runs found', 'WARN');
      
      return res.status(404).json({ message: 'No completed report run found for this company.' });
    }

    controllerLog({ 
      endpoint, 
      userId, 
      companyId, 
      reportId: latestRun.id,
      metadata: { 
        reportCreatedAt: latestRun.createdAt,
        companyName: latestRun.company.name
      }
    }, `Latest report found: ${latestRun.id}`);

    // 2. Fetch all metrics associated with that run (with optional filtering)
    controllerLog({ endpoint, userId, companyId, reportId: latestRun.id }, 'Fetching report metrics');
    
    const metricsWhere: any = {
      runId: latestRun.id,
    };
    
    // Apply AI model filter if specified
    if (aiModel && aiModel !== 'all') {
      metricsWhere.engine = aiModel;
    }
    
    const metrics = await prisma.metric.findMany({
      where: metricsWhere,
    });

    // 3. Calculate dashboard data from raw database queries
    controllerLog({ endpoint, userId, companyId, reportId: latestRun.id }, 'Calculating dashboard data from raw queries');
    
    const filters = { aiModel: aiModel as string };
    
    // Calculate all dashboard metrics in parallel for efficiency
    const [
      brandShareOfVoice,
      averagePosition,
      averageInclusionRate,
      competitorRankings,
      topQuestions,
      sentimentOverTime,
      shareOfVoiceHistory
    ] = await Promise.all([
      calculateBrandShareOfVoice(latestRun.id, companyId, filters),
      calculateAveragePosition(latestRun.id, companyId, filters),
      calculateAverageInclusionRate(latestRun.id, companyId, filters),
      calculateCompetitorRankings(latestRun.id, companyId, filters),
      calculateTopQuestions(latestRun.id, companyId, filters),
      calculateSentimentOverTime(latestRun.id, companyId, filters),
      calculateShareOfVoiceHistory(latestRun.id, companyId, filters)
    ]);

    const responseData = {
      runId: latestRun.id,
      lastUpdated: latestRun.updatedAt.toISOString(),
      status: latestRun.status,
      metrics: metrics,
      brandShareOfVoice,
      shareOfVoiceHistory,
      averagePosition,
      averageInclusionRate,
      competitorRankings,
      topQuestions,
      sentimentOverTime,
    };

    const duration = Date.now() - startTime;
    controllerLog({ 
      endpoint, 
      userId, 
      companyId, 
      reportId: latestRun.id,
      duration, 
      statusCode: 200,
      metadata: { 
        metricsCount: metrics.length,
        companyName: latestRun.company.name,
        appliedFilters: { dateRange, aiModel },
        calculatedFromRawData: true
      }
    }, `Latest report data calculated from raw database with ${metrics.length} metrics and filtering applied`);

    res.status(200).json(responseData);
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



// Raw database calculation functions to replace DashboardData
async function calculateBrandShareOfVoice(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // Get all mentions for this run across all response types
    const [visibilityMentions, benchmarkMentions, personalMentions] = await Promise.all([
        prisma.visibilityMention.findMany({
            where: {
                visibilityResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            include: { company: true, competitor: true }
        }),
        prisma.benchmarkMention.findMany({
            where: {
                benchmarkResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            include: { company: true, competitor: true }
        }),
        prisma.personalMention.findMany({
            where: {
                personalResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            include: { company: true, competitor: true }
        })
    ]);

    const allMentions = [...visibilityMentions, ...benchmarkMentions, ...personalMentions];
    const totalMentions = allMentions.length;
    
    if (totalMentions === 0) {
        return { shareOfVoice: 0 };
    }

    const companyMentions = allMentions.filter(mention => mention.companyId === companyId).length;
    const shareOfVoice = (companyMentions / totalMentions) * 100;

    return { shareOfVoice };
}

async function calculateAveragePosition(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // Get all company mentions with their positions
    const [visibilityMentions, benchmarkMentions, personalMentions] = await Promise.all([
        prisma.visibilityMention.findMany({
            where: {
                companyId,
                visibilityResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            select: { position: true }
        }),
        prisma.benchmarkMention.findMany({
            where: {
                companyId,
                benchmarkResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            select: { position: true }
        }),
        prisma.personalMention.findMany({
            where: {
                companyId,
                personalResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            select: { position: true }
        })
    ]);

    const allCompanyMentions = [...visibilityMentions, ...benchmarkMentions, ...personalMentions];
    
    if (allCompanyMentions.length === 0) {
        return { averagePosition: 0, change: 0 };
    }

    const totalPositions = allCompanyMentions.reduce((sum, mention) => sum + mention.position, 0);
    const averagePosition = totalPositions / allCompanyMentions.length;

    // TODO: Calculate change by comparing with previous runs
    // For now, return 0 change - this could be enhanced to look at historical data
    const change = 0;

    return { averagePosition, change };
}

async function calculateAverageInclusionRate(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // Get total number of responses and number of responses with company mentions
    const [totalResponses, responsesWithMentions] = await Promise.all([
        // Count all responses for this run
        Promise.all([
            prisma.visibilityResponse.count({
                where: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            }),
            prisma.benchmarkResponse.count({
                where: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            }),
            prisma.personalResponse.count({
                where: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            })
        ]).then(counts => counts.reduce((sum, count) => sum + count, 0)),
        
        // Count responses that have company mentions
        Promise.all([
            prisma.visibilityResponse.count({
                where: {
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                    mentions: { some: { companyId } }
                }
            }),
            prisma.benchmarkResponse.count({
                where: {
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                    benchmarkMentions: { some: { companyId } }
                }
            }),
            prisma.personalResponse.count({
                where: {
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                    mentions: { some: { companyId } }
                }
            })
        ]).then(counts => counts.reduce((sum, count) => sum + count, 0))
    ]);

    if (totalResponses === 0) {
        return { averageInclusionRate: 0, change: 0 };
    }

    const averageInclusionRate = (responsesWithMentions / totalResponses) * 100;
    
    // TODO: Calculate change by comparing with previous runs
    const change = 0;

    return { averageInclusionRate, change };
}

async function calculateCompetitorRankings(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // Get all competitors for this company
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: { competitors: true }
    });

    if (!company) {
        return { competitors: [], chartCompetitors: [], industryRanking: null, userCompany: null };
    }

    // Calculate share of voice for company and all competitors
    const entityMentionCounts = new Map<string, { name: string, isUserCompany: boolean, website?: string, mentions: number }>();
    
    // Add the user's company
    entityMentionCounts.set(companyId, {
        name: company.name,
        isUserCompany: true,
        website: company.website,
        mentions: 0
    });

    // Add all competitors
    company.competitors.forEach(competitor => {
        entityMentionCounts.set(competitor.id, {
            name: competitor.name,
            isUserCompany: false,
            website: competitor.website,
            mentions: 0
        });
    });

    // Count mentions for each entity
    const [visibilityMentions, benchmarkMentions, personalMentions] = await Promise.all([
        prisma.visibilityMention.findMany({
            where: {
                visibilityResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                OR: [
                    { companyId },
                    { competitorId: { in: company.competitors.map(c => c.id) } }
                ]
            }
        }),
        prisma.benchmarkMention.findMany({
            where: {
                benchmarkResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                OR: [
                    { companyId },
                    { competitorId: { in: company.competitors.map(c => c.id) } }
                ]
            }
        }),
        prisma.personalMention.findMany({
            where: {
                personalResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                },
                OR: [
                    { companyId },
                    { competitorId: { in: company.competitors.map(c => c.id) } }
                ]
            }
        })
    ]);

    // Count mentions for each entity
    [...visibilityMentions, ...benchmarkMentions, ...personalMentions].forEach(mention => {
        const entityId = mention.companyId || mention.competitorId;
        if (entityId && entityMentionCounts.has(entityId)) {
            entityMentionCounts.get(entityId)!.mentions++;
        }
    });

    const totalMentions = Array.from(entityMentionCounts.values()).reduce((sum, entity) => sum + entity.mentions, 0);
    
    // Calculate share of voice and rank entities
    const rankedEntities = Array.from(entityMentionCounts.entries())
        .map(([id, entity]) => ({
            id,
            name: entity.name,
            isUserCompany: entity.isUserCompany,
            website: entity.website,
            shareOfVoice: totalMentions > 0 ? (entity.mentions / totalMentions) * 100 : 0,
            change: 0, // TODO: Calculate change from previous runs
            changeType: 'stable' as const
        }))
        .sort((a, b) => b.shareOfVoice - a.shareOfVoice);

    // Find user company ranking
    const userCompanyRanking = rankedEntities.findIndex(entity => entity.isUserCompany) + 1;
    const industryRanking = userCompanyRanking > 0 ? userCompanyRanking : null;

    return {
        competitors: rankedEntities.filter(entity => !entity.isUserCompany),
        chartCompetitors: rankedEntities,
        industryRanking,
        userCompany: rankedEntities.find(entity => entity.isUserCompany) || null
    };
}

async function calculateTopQuestions(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // Get questions where the company has mentions, ranked by position
    const [visibilityQuestions, benchmarkQuestions, personalQuestions] = await Promise.all([
        prisma.visibilityQuestion.findMany({
            where: {
                responses: {
                    some: {
                        runId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                        mentions: { some: { companyId } }
                    }
                }
            },
            include: {
                product: { select: { name: true } },
                responses: {
                    where: {
                        runId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                        mentions: { some: { companyId } }
                    },
                    include: {
                        mentions: {
                            where: { companyId }
                        }
                    }
                }
            }
        }),
        prisma.benchmarkingQuestion.findMany({
            where: {
                benchmarkResponses: {
                    some: {
                        runId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                        benchmarkMentions: { some: { companyId } }
                    }
                }
            },
            include: {
                benchmarkResponses: {
                    where: {
                        runId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                        benchmarkMentions: { some: { companyId } }
                    },
                    include: {
                        benchmarkMentions: {
                            where: { companyId }
                        }
                    }
                }
            }
        }),
        prisma.personalQuestion.findMany({
            where: {
                responses: {
                    some: {
                        runId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                        mentions: { some: { companyId } }
                    }
                }
            },
            include: {
                responses: {
                    where: {
                        runId,
                        ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {}),
                        mentions: { some: { companyId } }
                    },
                    include: {
                        mentions: {
                            where: { companyId }
                        }
                    }
                }
            }
        })
    ]);

    // Calculate detailed question data with best responses
    const questionsWithDetails = [
        ...visibilityQuestions.map(q => {
            // Find best mention (lowest position)
            const allMentions = q.responses.flatMap(r => r.mentions);
            const bestMention = allMentions.reduce((best, current) => 
                current.position < best.position ? current : best, allMentions[0]);
            
            // Find the response containing the best mention
            const bestResponse = q.responses.find(r => 
                r.mentions.some(m => m.id === bestMention.id));
            
            const averagePosition = allMentions.reduce((sum, m) => sum + m.position, 0) / allMentions.length;
            
            return {
                id: q.id,
                question: q.question,
                averagePosition,
                bestPosition: bestMention.position,
                type: 'visibility' as const,
                productName: q.product?.name,
                bestResponse: bestResponse?.content || '',
                bestResponseModel: bestResponse?.engine || 'unknown'
            };
        }),
        ...benchmarkQuestions.map(q => {
            // Find best mention (lowest position)
            const allMentions = q.benchmarkResponses.flatMap(r => r.benchmarkMentions);
            const bestMention = allMentions.reduce((best, current) => 
                current.position < best.position ? current : best, allMentions[0]);
            
            // Find the response containing the best mention
            const bestResponse = q.benchmarkResponses.find(r => 
                r.benchmarkMentions.some(m => m.id === bestMention.id));
            
            const averagePosition = allMentions.reduce((sum, m) => sum + m.position, 0) / allMentions.length;
            
            return {
                id: q.id,
                question: q.text,
                averagePosition,
                bestPosition: bestMention.position,
                type: 'benchmark' as const,
                productName: undefined,
                bestResponse: bestResponse?.content || '',
                bestResponseModel: bestResponse?.engine || 'unknown'
            };
        }),
        ...personalQuestions.map(q => {
            // Find best mention (lowest position)
            const allMentions = q.responses.flatMap(r => r.mentions);
            const bestMention = allMentions.reduce((best, current) => 
                current.position < best.position ? current : best, allMentions[0]);
            
            // Find the response containing the best mention
            const bestResponse = q.responses.find(r => 
                r.mentions.some(m => m.id === bestMention.id));
            
            const averagePosition = allMentions.reduce((sum, m) => sum + m.position, 0) / allMentions.length;
            
            return {
                id: q.id,
                question: q.question,
                averagePosition,
                bestPosition: bestMention.position,
                type: 'personal' as const,
                productName: undefined,
                bestResponse: bestResponse?.content || '',
                bestResponseModel: bestResponse?.engine || 'unknown'
            };
        })
    ].sort((a, b) => a.averagePosition - b.averagePosition) // Lower position is better
     .slice(0, 10); // Top 10 questions

    return questionsWithDetails;
}

async function calculateSentimentOverTime(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // Get sentiment metrics for this run
    const sentimentMetrics = await prisma.metric.findMany({
        where: {
            runId,
            name: 'Detailed Sentiment Scores',
            ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
        },
        orderBy: { createdAt: 'asc' }
    });

    if (sentimentMetrics.length === 0) {
        return [];
    }

    // Group metrics by date and calculate average sentiment scores
    const sentimentByDate: { [date: string]: { scores: number[], count: number } } = {};
    
    sentimentMetrics.forEach(metric => {
        const value = metric.value as any;
        if (!value?.ratings?.[0]) return;
        
        const rating = value.ratings[0];
        const categoryScores = Object.values(rating).filter(v => typeof v === 'number') as number[];
        if (categoryScores.length === 0) return;
        
        const averageScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
        const date = new Date(metric.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        if (!sentimentByDate[date]) {
            sentimentByDate[date] = { scores: [], count: 0 };
        }
        sentimentByDate[date].scores.push(averageScore);
        sentimentByDate[date].count++;
    });
    
    // Convert to chart format
    const sentimentOverTime = Object.entries(sentimentByDate).map(([date, data]) => ({
        date,
        score: data.scores.reduce((sum, score) => sum + score, 0) / data.count,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sentimentOverTime;
}

async function calculateShareOfVoiceHistory(runId: string, companyId: string, filters?: { aiModel?: string }) {
    // Get all mentions for this run across all response types
    const [visibilityMentions, benchmarkMentions, personalMentions] = await Promise.all([
        prisma.visibilityMention.findMany({
            where: {
                visibilityResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            select: { createdAt: true, companyId: true }
        }),
        prisma.benchmarkMention.findMany({
            where: {
                benchmarkResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            select: { createdAt: true, companyId: true }
        }),
        prisma.personalMention.findMany({
            where: {
                personalResponse: { 
                    runId,
                    ...(filters?.aiModel && filters.aiModel !== 'all' ? { engine: filters.aiModel } : {})
                }
            },
            select: { createdAt: true, companyId: true }
        })
    ]);

    const allMentions = [...visibilityMentions, ...benchmarkMentions, ...personalMentions];
    
    if (allMentions.length === 0) {
        return [];
    }

    // Group mentions by date
    const mentionsByDate: { [date: string]: { companyMentions: number; totalMentions: number } } = {};
    
    allMentions.forEach(mention => {
        const date = new Date(mention.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!mentionsByDate[date]) {
            mentionsByDate[date] = { companyMentions: 0, totalMentions: 0 };
        }
        mentionsByDate[date].totalMentions++;
        if (mention.companyId === companyId) {
            mentionsByDate[date].companyMentions++;
        }
    });

    // Convert to chart format
    const shareOfVoiceHistory = Object.entries(mentionsByDate).map(([date, data]) => ({
        date,
        shareOfVoice: data.totalMentions > 0 ? (data.companyMentions / data.totalMentions) * 100 : 0,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return shareOfVoiceHistory;
} 