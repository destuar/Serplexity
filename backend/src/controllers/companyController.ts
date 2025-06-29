import { Request, Response } from 'express';
import { z } from 'zod';
import prisma, { prismaReadReplica } from '../config/db';

import env from '../config/env';


// Type for sentiment score values
interface SentimentScoreValue {
  ratings: Array<{
    quality: number;
    priceValue: number;
    brandReputation: number;
    brandTrust: number;
    customerService: number;
    summaryDescription: string;
  }>;
}




// Validation schemas
const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().url('Invalid website URL'),
  industry: z.string().min(1, 'Industry is required'),
  competitors: z.array(
    z.object({
      name: z.string().min(1, 'Competitor name cannot be empty'),
      website: z.string().url('Invalid competitor website URL'),
    })
  ).min(1, 'At least one competitor is required'),
  benchmarkingQuestions: z.array(z.string().min(1, "Question cannot be empty")).min(1, 'At least one benchmarking question is required').max(5, 'Maximum 5 questions allowed'),
  products: z.array(z.string().min(1, "Product name cannot be empty")).min(1, 'At least one product is required').max(5, 'Maximum 5 products allowed'),
});

const updateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').optional(),
  website: z.string().url('Invalid website URL').optional(),
  industry: z.string().min(1, 'Industry is required').optional(),
  competitors: z.array(
    z.object({
      name: z.string().min(1, 'Competitor name cannot be empty'),
      website: z.string().url('Invalid competitor website URL'),
    })
  ).min(1, 'At least one competitor is required').optional(),
  benchmarkingQuestions: z.array(z.string().min(1, "Question cannot be empty")).min(1, 'At least one benchmarking question is required').optional(),
  products: z.array(z.string().min(1, "Product name cannot be empty")).min(1, 'At least one product is required').optional(),
});





/**
 * Create a new company profile with competitors
 */
export const createCompany = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user already has 3 companies (maximum limit)
    const existingCompaniesCount = await prisma.company.count({
      where: { userId },
    });

    if (existingCompaniesCount >= 3) {
      return res.status(400).json({ 
        error: 'Maximum company limit reached',
        message: 'You can only create up to 3 company profiles. Please delete an existing company to create a new one.'
      });
    }

    const { name, website, industry, competitors, benchmarkingQuestions, products } = createCompanySchema.parse(req.body);

    // Create company with competitors in a transaction
    const company = await prisma.$transaction(async (tx) => {
      // Create the company
      const newCompany = await tx.company.create({
        data: {
          name,
          website,
          industry,
          userId,
        },
      });

      // Create competitors
      if (competitors && competitors.length > 0) {
        // Enhanced normalization: lowercase, strip protocol & www, and remove any trailing path or slash
        const normalizeWebsite = (website: string) =>
          website
            .toLowerCase()
            .replace(/^https?:\/\//, '')  // Remove protocol
            .replace(/^www\./, '')         // Remove leading www.
            .split('/')[0];                // Keep only the hostname (drops trailing '/' or paths)
        
        // Remove duplicates based on website within the submitted list
        const uniqueCompetitors = competitors.filter((competitor, index) => {
          const normalizedWebsite = normalizeWebsite(competitor.website);
          return competitors.findIndex(c => normalizeWebsite(c.website) === normalizedWebsite) === index;
        });

        await tx.competitor.createMany({
          data: uniqueCompetitors.map(competitor => ({
            name: competitor.name,
            website: competitor.website,
            companyId: newCompany.id,
            isGenerated: false, // User-added competitors
          })),
        });
      }

      // Create benchmarking questions
      await tx.benchmarkingQuestion.createMany({
        data: benchmarkingQuestions.map(questionText => ({
          text: questionText,
          companyId: newCompany.id,
          isGenerated: false, // User-added questions
        })),
      });

      // Create products
      await tx.product.createMany({
        data: products.map(productName => ({
          name: productName,
          companyId: newCompany.id,
        })),
      });

      // Return company with only user-added data for editing
      return await tx.company.findUnique({
        where: { id: newCompany.id },
        include: {
          competitors: { where: { isGenerated: false } },
          benchmarkingQuestions: { where: { isGenerated: false } },
          products: true,
        },
      });
    });

    res.status(201).json({ company });
  } catch (error) {
    console.error('[CREATE COMPANY ERROR]', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    
    // Handle Prisma unique constraint violations
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002' && 'meta' in error && error.meta) {
        const meta = error.meta as { target?: string[] };
        if (meta.target?.includes('website') && meta.target?.includes('companyId')) {
          return res.status(400).json({ 
            error: 'A competitor with this website already exists for your company. Please use a different website or update the existing competitor.' 
          });
        }
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all companies for the authenticated user
 */
export const getCompanies = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const companies = await prismaReadReplica.company.findMany({
      where: { userId },
      include: {
        competitors: { where: { isGenerated: false } },
        benchmarkingQuestions: { where: { isGenerated: false } },
        products: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ companies });
  } catch (error) {
    console.error('[GET COMPANIES ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get a specific company by ID (must belong to the authenticated user)
 */
export const getCompany = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First check if company exists at all
    const companyExists = await prismaReadReplica.company.findUnique({
      where: { id },
    });

    if (!companyExists) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Then check if user owns this company
    if (companyExists.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get company with relations
    const company = await prismaReadReplica.company.findUnique({
      where: { id },
      include: {
        competitors: { where: { isGenerated: false } },
        benchmarkingQuestions: { where: { isGenerated: false } },
        products: true,
      },
    });

    res.json({ company });
  } catch (error) {
    console.error('[GET COMPANY ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAverageInclusionRate = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { dateRange, aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Ensure the company belongs to the user
    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found or unauthorized' });
    }

    // Calculate date filter
    let dateFilter = {};
    if (dateRange) {
      const now = new Date();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = daysMap[dateRange as keyof typeof daysMap] || 30;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      dateFilter = { gte: startDate };
    }

    const reportRuns = await prisma.reportRun.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 2,
    });



    if (reportRuns.length === 0) {
      return res.json({ averageInclusionRate: null, change: null });
    }

    const calculateAIR = async (runId: string) => {
      // Create model filter
      let modelFilter = {};
      if (aiModel && aiModel !== 'all') {
        modelFilter = { model: aiModel as string };
      }

      // Count total responses for this run
      const totalVisibilityResponses = await prismaReadReplica.visibilityResponse.count({
        where: { 
          runId: runId,
          ...modelFilter,
        },
      });

      const totalBenchmarkResponses = await prismaReadReplica.benchmarkResponse.count({
        where: { 
          runId: runId,
          ...modelFilter,
        },
      });

      // Count responses that mentioned the company
      const visibilityResponsesWithCompanyMentions = await prismaReadReplica.visibilityResponse.count({
        where: {
          runId: runId,
          ...modelFilter,
          mentions: {
            some: {
              companyId: companyId,
            },
          },
        },
      });

      const benchmarkResponsesWithCompanyMentions = await prismaReadReplica.benchmarkResponse.count({
        where: {
          runId: runId,
          ...modelFilter,
          benchmarkMentions: {
            some: {
              companyId: companyId,
            },
          },
        },
      });

      const totalResponses = totalVisibilityResponses + totalBenchmarkResponses;
      const responsesWithCompanyMentions = visibilityResponsesWithCompanyMentions + benchmarkResponsesWithCompanyMentions;



      if (totalResponses === 0) {
        return 0;
      }

      return (responsesWithCompanyMentions / totalResponses) * 100;
    };

    const latestAIR = await calculateAIR(reportRuns[0].id);

    let change = null;
    if (reportRuns.length > 1) {
      const previousAIR = await calculateAIR(reportRuns[1].id);
      // Calculate percentage point difference (raw difference)
      // e.g., 25% - 10% = +15 percentage points
      change = latestAIR - previousAIR;
    }

    res.json({ averageInclusionRate: latestAIR, change });
  } catch (error) {
    console.error('[GET AIR ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getAveragePosition = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { dateRange, aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Ensure the company belongs to the user
    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found or unauthorized' });
    }

    // Calculate date filter
    let dateFilter = {};
    if (dateRange) {
      const now = new Date();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = daysMap[dateRange as keyof typeof daysMap] || 30;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      dateFilter = { gte: startDate };
    }

    const reportRuns = await prisma.reportRun.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 2,
    });

    if (reportRuns.length === 0) {
      return res.json({ averagePosition: null, change: null });
    }

    const calculateAveragePosition = async (runId: string) => {
      // Create model filter for responses
      let responseModelFilter = {};
      if (aiModel && aiModel !== 'all') {
        responseModelFilter = { model: aiModel as string };
      }

      // Get all visibility mentions for this company in this run
      const visibilityMentions = await prismaReadReplica.visibilityMention.findMany({
        where: {
          companyId: companyId,
          visibilityResponse: {
            runId: runId,
            ...responseModelFilter,
          },
        },
        select: {
          position: true,
        },
      });

      // Get all benchmark mentions for this company in this run
      const benchmarkMentions = await prismaReadReplica.benchmarkMention.findMany({
        where: {
          companyId: companyId,
          benchmarkResponse: {
            runId: runId,
            ...responseModelFilter,
          },
        },
        select: {
          position: true,
        },
      });

      const allPositions = [
        ...visibilityMentions.map(m => m.position),
        ...benchmarkMentions.map(m => m.position)
      ];

      if (allPositions.length === 0) {
        return null;
      }

      const sum = allPositions.reduce((acc, pos) => acc + pos, 0);
      return sum / allPositions.length;
    };

    const latestAvgPosition = await calculateAveragePosition(reportRuns[0].id);

    let change = null;
    if (reportRuns.length > 1 && latestAvgPosition !== null) {
      const previousAvgPosition = await calculateAveragePosition(reportRuns[1].id);
      if (previousAvgPosition !== null) {
        // For position, we want the actual position difference
        // Positive change means improvement (moved to lower position numbers)
        change = previousAvgPosition - latestAvgPosition;
      }
    }

    res.json({ averagePosition: latestAvgPosition, change });
  } catch (error) {
    console.error('[GET AVERAGE POSITION ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getShareOfVoice = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { dateRange, aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Ensure the company belongs to the user
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found or unauthorized' });
    }

    // Calculate date filter
    let dateFilter = {};
    if (dateRange) {
      const now = new Date();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = daysMap[dateRange as keyof typeof daysMap] || 30;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      dateFilter = { gte: startDate };
    }

    const reportRuns = await prisma.reportRun.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 2,
    });

    if (reportRuns.length === 0) {
      return res.json({ shareOfVoice: null, change: null });
    }

    const calculateShareOfVoice = async (runId: string) => {
      // Create model filter for responses
      let responseModelFilter = {};
      if (aiModel && aiModel !== 'all') {
        responseModelFilter = { model: aiModel as string };
      }

      // Count total visibility mentions for this run
      const totalVisibilityMentions = await prisma.visibilityMention.count({
        where: {
          visibilityResponse: {
            runId: runId,
            ...responseModelFilter,
          },
        },
      });

      // Count total benchmark mentions for this run
      const totalBenchmarkMentions = await prisma.benchmarkMention.count({
        where: {
          benchmarkResponse: {
            runId: runId,
            ...responseModelFilter,
          },
        },
      });

      // Count mentions that belong to the user's company
      const companyVisibilityMentions = await prisma.visibilityMention.count({
        where: {
          companyId: companyId,
          visibilityResponse: {
            runId: runId,
            ...responseModelFilter,
          },
        },
      });

      const companyBenchmarkMentions = await prisma.benchmarkMention.count({
        where: {
          companyId: companyId,
          benchmarkResponse: {
            runId: runId,
            ...responseModelFilter,
          },
        },
      });

      const totalMentions = totalVisibilityMentions + totalBenchmarkMentions;
      const companyMentions = companyVisibilityMentions + companyBenchmarkMentions;

      if (totalMentions === 0) {
        return 0;
      }

      return (companyMentions / totalMentions) * 100;
    };

    const latestShareOfVoice = await calculateShareOfVoice(reportRuns[0].id);

    let change = null;
    if (reportRuns.length > 1) {
      const previousShareOfVoice = await calculateShareOfVoice(reportRuns[1].id);
      // Calculate percentage point difference
      change = latestShareOfVoice - previousShareOfVoice;
    }

    res.json({ shareOfVoice: latestShareOfVoice, change });
  } catch (error) {
    console.error('[GET SHARE OF VOICE ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getShareOfVoiceHistory = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { dateRange, aiModel } = req.query;

    // Calculate date filter
    let dateFilter: { gte?: Date } = {};
    if (dateRange) {
      const now = new Date();
      const daysMap: { [key: string]: number } = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = daysMap[dateRange as string] || 30;
      dateFilter.gte = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const reportRuns = await prisma.reportRun.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        ...(dateFilter.gte && { createdAt: dateFilter }),
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    });

    if (reportRuns.length === 0) {
      return res.json({ history: [] });
    }

    let modelFilter = {};
    if (aiModel && aiModel !== 'all') {
        modelFilter = { model: aiModel as string };
    }

    const historyPromises = reportRuns.map(async (run) => {
      const visibilityMentions = await prisma.visibilityMention.findMany({
        where: { visibilityResponse: { runId: run.id, ...modelFilter } },
        select: { companyId: true },
      });
      const benchmarkMentions = await prisma.benchmarkMention.findMany({
        where: { benchmarkResponse: { runId: run.id, ...modelFilter } },
        select: { companyId: true },
      });

      const allMentions = [...visibilityMentions, ...benchmarkMentions];
      const totalMentions = allMentions.length;
      const companyMentions = allMentions.filter(m => m.companyId === companyId).length;
      
      const shareOfVoice = totalMentions > 0 ? (companyMentions / totalMentions) * 100 : 0;

      return {
        date: run.createdAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
        shareOfVoice,
      };
    });

    const history = await Promise.all(historyPromises);
    
    // Simple deduplication, keeping the last data point for a given day
    const uniqueHistory = Array.from(new Map(history.map(item => [item.date, item])).values());

    res.json({ history: uniqueHistory });
  } catch (error) {
    console.error('Error fetching share of voice history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getSentimentData = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { aiModel } = req.query;

    // Get latest completed run
    const reportRuns = await prisma.reportRun.findMany({
      where: { companyId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    if (reportRuns.length === 0) {
      return res.status(404).json({ error: 'No completed report runs found' });
    }

    const calculateSentimentData = async (runId: string) => {
      let responseModelFilter = {};
      if (aiModel && aiModel !== 'all') {
        responseModelFilter = { model: aiModel as string };
      }

      const metrics = await prisma.sentimentScore.findMany({
        where: {
          runId: runId,
          name: 'sentimentScores',
        },
      });

      return metrics.length > 0 ? metrics[0].value : null;
    };

    const latestSentimentData = await calculateSentimentData(reportRuns[0].id);

    res.json({ sentimentData: latestSentimentData });
  } catch (error) {
    console.error('Failed to get sentiment data:', error);
    res.status(500).json({ error: 'Failed to retrieve sentiment data' });
  }
};

export const getTopRankingQuestions = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { aiModel, limit = '10' } = req.query;

    // Get latest completed run
    const reportRun = await prisma.reportRun.findFirst({
      where: { companyId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!reportRun) {
      return res.status(404).json({ error: 'No completed report runs found' });
    }

    // Create model filter for responses
    let responseModelFilter = {};
    if (aiModel && aiModel !== 'all') {
      responseModelFilter = { model: aiModel as string };
    }

    // Get ALL visibility questions for this run
    const visibilityQuestions = await prisma.visibilityQuestion.findMany({
      where: {
        responses: {
          some: {
            runId: reportRun.id,
            ...responseModelFilter,
          },
        },
      },
      include: {
        responses: {
          where: {
            runId: reportRun.id,
            ...responseModelFilter,
          },
          include: {
            mentions: {
              where: {
                companyId: companyId,
              },
            },
          },
        },
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    // Get ALL benchmark questions for this company
    const benchmarkQuestions = await prisma.benchmarkingQuestion.findMany({
      where: {
        companyId: companyId,
        benchmarkResponses: {
          some: {
            runId: reportRun.id,
            ...responseModelFilter,
          },
        },
      },
      include: {
        benchmarkResponses: {
          where: {
            runId: reportRun.id,
            ...responseModelFilter,
          },
          include: {
            benchmarkMentions: {
              where: {
                companyId: companyId,
              },
            },
          },
        },
      },
    });

    // Process and combine results
    const questionResults: Array<{
      id: string;
      question: string;
      type: 'visibility' | 'benchmark';
      productName?: string;
      bestPosition: number;
      totalMentions: number;
      averagePosition: number;
      bestResponse: string;
      bestResponseModel: string;
      responses: Array<{
        model: string;
        response: string;
        position?: number;
      }>;
    }> = [];

    // Process visibility questions (including ones where company is not mentioned)
    visibilityQuestions.forEach(vq => {
      const allMentions = vq.responses.flatMap(r => r.mentions);
      
      if (allMentions.length > 0) {
        // Company IS mentioned
        const positions = allMentions.map(m => m.position);
        const bestPosition = Math.min(...positions);
        const averagePosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
        
        // Find the response with the best position
        let bestResponse = '';
        let bestResponseModel = '';
        let bestResponsePosition = Infinity;
        
        for (const response of vq.responses) {
          const responseMentions = response.mentions.filter(m => m.companyId === companyId);
          if (responseMentions.length > 0) {
            const responseMinPosition = Math.min(...responseMentions.map(m => m.position));
            if (responseMinPosition < bestResponsePosition) {
              bestResponsePosition = responseMinPosition;
              bestResponseModel = response.model;
              try {
                const parsedContent = JSON.parse(response.content);
                bestResponse = parsedContent.answer || response.content;
              } catch {
                bestResponse = response.content;
              }
            }
          }
        }
        
        questionResults.push({
          id: vq.id,
          question: vq.question,
          type: 'visibility',
          productName: vq.product.name,
          bestPosition,
          totalMentions: allMentions.length,
          averagePosition,
          bestResponse,
          bestResponseModel,
          responses: (() => {
            const latestMap = new Map<string, typeof vq.responses[0]>();
            vq.responses.forEach(r => {
              const existing = latestMap.get(r.model);
              if (!existing || existing.createdAt < r.createdAt) {
                latestMap.set(r.model, r);
              }
            });
            return Array.from(latestMap.values()).map(r => {
              let respContent = r.content;
              try {
                const parsed = JSON.parse(r.content);
                respContent = parsed.answer || r.content;
              } catch {}
              return {
                model: r.model,
                response: respContent,
                position: r.mentions.find(m => m.companyId === companyId)?.position,
                createdAt: r.createdAt,
              };
            });
          })(),
        });
      } else {
        // Company is NOT mentioned - still show the question
        const firstResponse = vq.responses[0];
        let responseContent = 'No response available';
        let responseModel = 'unknown';
        
        if (firstResponse) {
          responseModel = firstResponse.model;
          try {
            const parsedContent = JSON.parse(firstResponse.content);
            responseContent = parsedContent.answer || firstResponse.content;
          } catch {
            responseContent = firstResponse.content;
          }
        }
        
        questionResults.push({
          id: vq.id,
          question: vq.question,
          type: 'visibility',
          productName: vq.product.name,
          bestPosition: 999, // High number to sort non-mentioned questions to bottom
          totalMentions: 0,
          averagePosition: 999,
          bestResponse: responseContent,
          bestResponseModel: responseModel,
          responses: (() => {
            const latestMap = new Map<string, typeof vq.responses[0]>();
            vq.responses.forEach(r => {
              const existing = latestMap.get(r.model);
              if (!existing || existing.createdAt < r.createdAt) {
                latestMap.set(r.model, r);
              }
            });
            return Array.from(latestMap.values()).map(r => {
              let respContent = r.content;
              try {
                const parsed = JSON.parse(r.content);
                respContent = parsed.answer || r.content;
              } catch {}
              return { model: r.model, response: respContent, createdAt: r.createdAt };
            });
          })(),
        });
      }
    });

    // Process benchmark questions (including ones where company is not mentioned)
    benchmarkQuestions.forEach(bq => {
      const allMentions = bq.benchmarkResponses.flatMap(r => r.benchmarkMentions);
      
      if (allMentions.length > 0) {
        // Company IS mentioned
        const positions = allMentions.map(m => m.position);
        const bestPosition = Math.min(...positions);
        const averagePosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
        
        // Find the response with the best position
        let bestResponse = '';
        let bestResponseModel = '';
        let bestResponsePosition = Infinity;
        
        for (const response of bq.benchmarkResponses) {
          const responseMentions = response.benchmarkMentions.filter(m => m.companyId === companyId);
          if (responseMentions.length > 0) {
            const responseMinPosition = Math.min(...responseMentions.map(m => m.position));
            if (responseMinPosition < bestResponsePosition) {
              bestResponsePosition = responseMinPosition;
              bestResponseModel = response.model;
              try {
                const parsedContent = JSON.parse(response.content);
                bestResponse = parsedContent.answer || response.content;
              } catch {
                bestResponse = response.content;
              }
            }
          }
        }
        
        questionResults.push({
          id: bq.id,
          question: bq.text,
          type: 'benchmark',
          bestPosition,
          totalMentions: allMentions.length,
          averagePosition,
          bestResponse,
          bestResponseModel,
          responses: (() => {
            const latestMap = new Map<string, typeof bq.benchmarkResponses[0]>();
            bq.benchmarkResponses.forEach(r => {
              const existing = latestMap.get(r.model);
              if (!existing || existing.createdAt < r.createdAt) {
                latestMap.set(r.model, r);
              }
            });
            return Array.from(latestMap.values()).map(r => {
              let respContent = r.content;
              try {
                const parsed = JSON.parse(r.content);
                respContent = parsed.answer || r.content;
              } catch {}
              return {
                model: r.model,
                response: respContent,
                position: r.benchmarkMentions.find(m => m.companyId === companyId)?.position,
                createdAt: r.createdAt,
              };
            });
          })(),
        });
      } else {
        // Company is NOT mentioned - still show the question
        const firstResponse = bq.benchmarkResponses[0];
        let responseContent = 'No response available';
        let responseModel = 'unknown';
        
        if (firstResponse) {
          responseModel = firstResponse.model;
          try {
            const parsedContent = JSON.parse(firstResponse.content);
            responseContent = parsedContent.answer || firstResponse.content;
          } catch {
            responseContent = firstResponse.content;
          }
        }
        
        questionResults.push({
          id: bq.id,
          question: bq.text,
          type: 'benchmark',
          bestPosition: 999,
          totalMentions: 0,
          averagePosition: 999,
          bestResponse: responseContent,
          bestResponseModel: responseModel,
          responses: (() => {
            const latestMap = new Map<string, typeof bq.benchmarkResponses[0]>();
            bq.benchmarkResponses.forEach(r => {
              const existing = latestMap.get(r.model);
              if (!existing || existing.createdAt < r.createdAt) {
                latestMap.set(r.model, r);
              }
            });
            return Array.from(latestMap.values()).map(r => {
              let respContent = r.content;
              try {
                const parsed = JSON.parse(r.content);
                respContent = parsed.answer || r.content;
              } catch {}
              return { model: r.model, response: respContent, createdAt: r.createdAt };
            });
          })(),
        });
      }
    });

    // Sort by best position (lower is better), then by average position, then by total mentions
    questionResults.sort((a, b) => {
      if (a.bestPosition !== b.bestPosition) {
        return a.bestPosition - b.bestPosition;
      }
      if (a.averagePosition !== b.averagePosition) {
        return a.averagePosition - b.averagePosition;
      }
      return b.totalMentions - a.totalMentions;
    });

    // Return all results - let frontend handle filtering and limiting
    res.json({ 
      questions: questionResults,
      totalCount: questionResults.length,
      runId: reportRun.id,
      runDate: reportRun.createdAt,
    });
  } catch (error) {
    console.error('Failed to get top ranking questions:', error);
    res.status(500).json({ error: 'Failed to retrieve top ranking questions' });
  }
};

export const getSentimentOverTime = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { dateRange, aiModel } = req.query;

    let dateFilter: { gte?: Date } = {};
    if (dateRange) {
      const now = new Date();
      const daysMap: { [key: string]: number } = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = daysMap[dateRange as string] || 30;
      dateFilter.gte = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const reportRuns = await prisma.reportRun.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        ...(dateFilter.gte && { createdAt: dateFilter }),
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    });

    if (reportRuns.length === 0) {
      return res.json({ history: [] });
    }

    const engineFilter = (aiModel && aiModel !== 'all') ? (aiModel as string) : 'serplexity-summary';

    const historyPromises = reportRuns.map(async (run) => {
      const sentimentMetric = await prisma.sentimentScore.findFirst({
        where: {
          runId: run.id,
          name: 'Detailed Sentiment Scores',
          engine: engineFilter,
        },
      });

      if (!sentimentMetric || !sentimentMetric.value) {
        return null;
      }

      const value = sentimentMetric.value as unknown as SentimentScoreValue;
      const ratings = value.ratings[0];
      const scores = Object.values(ratings).filter(v => typeof v === 'number') as number[];
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      return {
        date: run.createdAt.toISOString().split('T')[0],
        score: averageScore,
      };
    });

    const history = (await Promise.all(historyPromises)).filter(Boolean);
    const uniqueHistory = Array.from(new Map(history.map(item => [item!.date, item])).values());

    res.json({ history: uniqueHistory });
  } catch (error) {
    console.error('Error fetching sentiment over time:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getCompetitorRankings = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { dateRange, aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Ensure the company belongs to the user
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
      include: { competitors: true },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found or unauthorized' });
    }

    // Calculate date filter
    let dateFilter = {};
    if (dateRange) {
      const now = new Date();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
      const days = daysMap[dateRange as keyof typeof daysMap] || 30;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      dateFilter = { gte: startDate };
    }

    // Get the latest 2 report runs for comparison
    const reportRuns = await prisma.reportRun.findMany({
      where: {
        companyId,
        status: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 2,
    });

    if (reportRuns.length === 0) {
      return res.json({ competitors: [], industryRanking: null });
    }

    const calculateCompetitorShareOfVoice = async (runId: string) => {
      // Create model filter for responses
      let responseModelFilter = {};
      if (aiModel && aiModel !== 'all') {
        responseModelFilter = { model: aiModel as string };
      }

      // Get all visibility mentions with competitor info
      const visibilityMentions = await prisma.visibilityMention.findMany({
        where: {
          visibilityResponse: {
            runId: runId,
            ...responseModelFilter,
          },
        },
        include: {
          competitor: true,
          company: true,
        },
      });

      // Get all benchmark mentions with competitor info
      const benchmarkMentions = await prisma.benchmarkMention.findMany({
        where: {
          benchmarkResponse: {
            runId: runId,
            ...responseModelFilter,
          },
        },
        include: {
          competitor: true,
          company: true,
        },
      });

      // Combine all mentions
      const allMentions = [
        ...visibilityMentions.map(m => ({
          id: m.id,
          competitorId: m.competitorId,
          companyId: m.companyId,
          competitor: m.competitor,
          company: m.company,
        })),
        ...benchmarkMentions.map(m => ({
          id: m.id,
          competitorId: m.competitorId,
          companyId: m.companyId,
          competitor: m.competitor,
          company: m.company,
        })),
      ];

      // Count mentions by competitor/company
      const mentionCounts = new Map<string, { name: string; website?: string; count: number; isUserCompany: boolean }>();

      allMentions.forEach(mention => {
        if (mention.competitor) {
          const key = `competitor_${mention.competitor.id}`;
          const existing = mentionCounts.get(key) || { name: mention.competitor.name, website: mention.competitor.website || undefined, count: 0, isUserCompany: false };
          mentionCounts.set(key, { ...existing, count: existing.count + 1 });
        } else if (mention.company) {
          const key = `company_${mention.company.id}`;
          const existing = mentionCounts.get(key) || { name: mention.company.name, website: mention.company.website, count: 0, isUserCompany: mention.company.id === companyId };
          mentionCounts.set(key, { ...existing, count: existing.count + 1 });
        }
      });

      const totalMentions = allMentions.length;
      if (totalMentions === 0) {
        return [];
      }

      // Convert to share of voice percentages
      const competitors = Array.from(mentionCounts.values()).map(item => ({
        name: item.name,
        website: item.website,
        shareOfVoice: (item.count / totalMentions) * 100,
        isUserCompany: item.isUserCompany,
      }));

      return competitors.sort((a, b) => b.shareOfVoice - a.shareOfVoice);
    };

    // Calculate current share of voice
    const currentCompetitors = await calculateCompetitorShareOfVoice(reportRuns[0].id);
    
    // Calculate previous share of voice for comparison
    let previousCompetitors: any[] = [];
    if (reportRuns.length > 1) {
      previousCompetitors = await calculateCompetitorShareOfVoice(reportRuns[1].id);
    }

    // Calculate changes
    const competitorsWithChanges = currentCompetitors.map(current => {
      const previous = previousCompetitors.find(p => p.name === current.name);
      const change = previous ? current.shareOfVoice - previous.shareOfVoice : 0;
      
      return {
        ...current,
        change,
        changeType: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'stable',
      };
    });

    // Find user company ranking
    const userCompanyIndex = competitorsWithChanges.findIndex(c => c.isUserCompany);
    const industryRanking = userCompanyIndex >= 0 ? userCompanyIndex + 1 : null;

    // Get top 3 competitors (including user company) for list display
    const topCompetitors = competitorsWithChanges.slice(0, 3);

    // Group remaining competitors if more than 3
    let listCompetitors = topCompetitors;
    if (competitorsWithChanges.length > 3) {
      const remainingCompetitors = competitorsWithChanges.slice(3);
      
      const othersShareOfVoice = remainingCompetitors.reduce((sum, c) => sum + c.shareOfVoice, 0);
      const othersChange = remainingCompetitors.reduce((sum, c) => sum + (c.change || 0), 0);
      
      listCompetitors.push({
        name: `${remainingCompetitors.length}+ others`,
        website: undefined,
        shareOfVoice: othersShareOfVoice,
        change: othersChange,
        changeType: othersChange > 0 ? 'increase' : othersChange < 0 ? 'decrease' : 'stable',
        isUserCompany: false,
      });
    }

    // Get top 12 individual competitors for chart display (no grouping)
    const chartCompetitors = competitorsWithChanges.slice(0, 12);

    res.json({ 
      competitors: listCompetitors,
      chartCompetitors: chartCompetitors,
      industryRanking,
      userCompany: competitorsWithChanges.find(c => c.isUserCompany) || null,
    });
  } catch (error) {
    console.error('[GET COMPETITOR RANKINGS ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Update a company profile
 */
export const updateCompany = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const updateData = updateCompanySchema.parse(req.body);

    // First check if company exists at all
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Then check if user owns this company
    if (existingCompany.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update company with competitors in a transaction
    const company = await prisma.$transaction(async (tx) => {
      // Update company basic info
      const updatedCompany = await tx.company.update({
        where: { id },
        data: {
          name: updateData.name,
          website: updateData.website,
          industry: updateData.industry,
        },
      });

      // Handle Competitors
      if (updateData.competitors) {
        // First, delete only the user-added competitors for this company
        await tx.competitor.deleteMany({
          where: { companyId: id, isGenerated: false },
        });

        // Enhanced normalization: lowercase, strip protocol & www, and remove any trailing path or slash
        const normalizeWebsite = (website: string) =>
          website
            .toLowerCase()
            .replace(/^https?:\/\//, '')  // Remove protocol
            .replace(/^www\./, '')         // Remove leading www.
            .split('/')[0];                // Keep only the hostname (drops trailing '/' or paths)
        
        // Remove duplicates based on website within the submitted list
        const uniqueCompetitors = updateData.competitors.filter((competitor, index) => {
          const normalizedWebsite = normalizeWebsite(competitor.website);
          return updateData.competitors!.findIndex(c => normalizeWebsite(c.website) === normalizedWebsite) === index;
        });

        // Then, create the new list of user-added competitors
        await tx.competitor.createMany({
          data: uniqueCompetitors.map(c => ({
            name: c.name,
            website: c.website,
            companyId: id,
            isGenerated: false, // Explicitly set as user-added
          })),
        });
      }

      // Handle Benchmarking Questions
      if (updateData.benchmarkingQuestions) {
        // First, delete generated variations that reference user-added questions
        // This prevents foreign key constraint violations
        await tx.benchmarkingQuestion.deleteMany({
          where: { 
            companyId: id, 
            isGenerated: true,
            originalQuestionId: { not: null }
          },
        });

        // Then, delete only user-added questions (originalQuestionId is null)
        await tx.benchmarkingQuestion.deleteMany({
          where: { companyId: id, isGenerated: false },
        });

        // Create the new list of user-added questions
        await tx.benchmarkingQuestion.createMany({
          data: updateData.benchmarkingQuestions.map(questionText => ({
            text: questionText,
            companyId: id,
            isGenerated: false, // Explicitly set as user-added
          })),
        });
      }

      // Handle Products
      if (updateData.products) {
        await tx.product.deleteMany({
          where: { companyId: id },
        });
        await tx.product.createMany({
          data: updateData.products.map(productName => ({
            name: productName,
            companyId: id,
          })),
        });
      }

      // Return updated company with only user-added data for editing
      return await tx.company.findUnique({
        where: { id },
        include: {
          competitors: { where: { isGenerated: false } },
          benchmarkingQuestions: { where: { isGenerated: false } },
          products: true,
        },
      });
    });

    res.json({ company });
  } catch (error) {
    console.error('[UPDATE COMPANY ERROR]', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    
    // Handle Prisma unique constraint violations
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'P2002' && 'meta' in error && error.meta) {
        const meta = error.meta as { target?: string[] };
        if (meta.target?.includes('website') && meta.target?.includes('companyId')) {
          return res.status(400).json({ 
            error: 'A competitor with this website already exists for your company. Please use a different website or update the existing competitor.' 
          });
        }
      }
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a company profile
 */
export const deleteCompany = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First check if company exists at all
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Then check if user owns this company
    if (existingCompany.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete company (competitors will be deleted due to cascade)
    await prisma.company.delete({
      where: { id },
    });

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('[DELETE COMPANY ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}; 