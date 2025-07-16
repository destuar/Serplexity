/**
 * @file companyController.ts
 * @description This file contains the controllers for managing companies and their associated data.
 * It handles all CRUD (Create, Read, Update, Delete) operations for company profiles, as well as fetching
 * detailed performance metrics like share of voice, average position, and competitor rankings. It also ensures
 * data validation and user ownership of the resources.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - zod: For schema validation of request bodies.
 * - ../config/db: The singleton Prisma client instance for database interactions.
 * - ../services/metricsService: Service for fetching full report metrics.
 * - ../services/dashboardService: Service for calculating dashboard data like top questions.
 * - ../config/env: Environment variable configuration.
 *
 * @exports
 * - createCompany: Controller for creating a new company.
 * - getCompanies: Controller for fetching all companies for the authenticated user.
 * - getCompany: Controller for fetching a specific company by ID.
 * - getAverageInclusionRate: Controller for fetching the average inclusion rate.
 * - getAveragePosition: Controller for fetching the average position.
 * - getShareOfVoice: Controller for fetching the share of voice.
 * - getCompetitorRankings: Controller for fetching competitor rankings.
 * - getSentimentData: Controller for fetching sentiment data.
 * - getTopRankingQuestions: Controller for fetching top ranking questions.
 * - getSentimentOverTime: Controller for fetching sentiment over time.
 * - getShareOfVoiceHistory: Controller for fetching share of voice history.
 * - updateCompany: Controller for updating a company.
 * - deleteCompany: Controller for deleting a company.
 */
import { Request, Response } from 'express';
import { z } from 'zod';
import prisma, { prismaReadReplica } from '../config/db';
import { getFullReportMetrics } from '../services/metricsService';
import { calculateTopQuestions } from '../services/dashboardService';

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
  // Removed products validation as Product model deprecated
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
  // Removed products field
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

    const { name, website, industry, competitors, benchmarkingQuestions } = createCompanySchema.parse(req.body);

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
        })),
      });

      // Removed product creation

      // Return company with only user-added data for editing
      return await tx.company.findUnique({
        where: { id: newCompany.id },
        include: {
          competitors: { where: { isGenerated: false } },
          benchmarkingQuestions: true,
          // no products
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
        benchmarkingQuestions: true,
        // no products
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
        benchmarkingQuestions: true,
        // no products
      },
    });

    res.json({ company });
  } catch (error) {
    console.error('[GET COMPANY ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== Helper =====
const findLatestRuns = async (companyId: string) => {
  const latestRun = await prismaReadReplica.reportRun.findFirst({
    where: { companyId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  });
  if (!latestRun) return { latestRun: null, previousRun: null };

  const previousRun = await prismaReadReplica.reportRun.findFirst({
    where: { companyId, status: 'COMPLETED', id: { not: latestRun.id } },
    orderBy: { createdAt: 'desc' },
  });
  return { latestRun, previousRun };
};

// --- Average Inclusion Rate (pre-computed) ---
export const getAverageInclusionRate = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify ownership
    const company = await prismaReadReplica.company.findFirst({ where: { id: companyId, userId } });
    if (!company) {
      return res.status(404).json({ error: 'Company not found or unauthorized' });
    }

    const { latestRun, previousRun } = await findLatestRuns(companyId);
    if (!latestRun) {
      return res.json({ averageInclusionRate: null, change: null });
    }

    const latestMetrics = await getFullReportMetrics(latestRun.id, (aiModel as string) || 'all');
    const previousMetrics = previousRun ? await getFullReportMetrics(previousRun.id, (aiModel as string) || 'all') : null;

    const latestRate = latestMetrics?.averageInclusionRate ?? null;
    const prevRate = previousMetrics?.averageInclusionRate ?? null;
    const change = latestRate !== null && prevRate !== null ? latestRate - prevRate : null;

    return res.json({ averageInclusionRate: latestRate, change });
  } catch (error) {
    console.error('[GET AIR ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- Average Position (pre-computed) ---
export const getAveragePosition = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const company = await prismaReadReplica.company.findFirst({ where: { id: companyId, userId } });
    if (!company) return res.status(404).json({ error: 'Company not found or unauthorized' });

    const { latestRun, previousRun } = await findLatestRuns(companyId);
    if (!latestRun) return res.json({ averagePosition: null, change: null });

    const latestMetrics = await getFullReportMetrics(latestRun.id, (aiModel as string) || 'all');
    const previousMetrics = previousRun ? await getFullReportMetrics(previousRun.id, (aiModel as string) || 'all') : null;

    const latestPos = latestMetrics?.averagePosition ?? null;
    const prevPos = previousMetrics?.averagePosition ?? null;
    const change = latestPos !== null && prevPos !== null ? prevPos - latestPos : null; // lower position is better

    return res.json({ averagePosition: latestPos, change });
  } catch (error) {
    console.error('[GET AVERAGE POSITION ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- Share of Voice (pre-computed) ---
export const getShareOfVoice = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const company = await prismaReadReplica.company.findFirst({ where: { id: companyId, userId } });
    if (!company) return res.status(404).json({ error: 'Company not found or unauthorized' });

    const { latestRun, previousRun } = await findLatestRuns(companyId);
    if (!latestRun) return res.json({ shareOfVoice: null, change: null });

    const latestMetrics = await getFullReportMetrics(latestRun.id, (aiModel as string) || 'all');
    const previousMetrics = previousRun ? await getFullReportMetrics(previousRun.id, (aiModel as string) || 'all') : null;

    const latestSov = latestMetrics?.shareOfVoice ?? null;
    const prevSov = previousMetrics?.shareOfVoice ?? null;
    const change = latestSov !== null && prevSov !== null ? latestSov - prevSov : null;

    return res.json({ shareOfVoice: latestSov, change });
  } catch (error) {
    console.error('[GET SHARE OF VOICE ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- Competitor Rankings (placeholder using pre-computed JSON) ---
export const getCompetitorRankings = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const company = await prismaReadReplica.company.findFirst({ where: { id: companyId, userId } });
    if (!company) return res.status(404).json({ error: 'Company not found or unauthorized' });

    const { latestRun } = await findLatestRuns(companyId);
    if (!latestRun) return res.json({ competitors: [], chartCompetitors: [], industryRanking: null, userCompany: null });

    const metrics = await getFullReportMetrics(latestRun.id, (aiModel as string) || 'all');
    if (metrics?.competitorRankings) {
      return res.json(metrics.competitorRankings);
    }

    // Fallback empty
    return res.json({ competitors: [], chartCompetitors: [], industryRanking: null, userCompany: null });
  } catch (error) {
    console.error('[GET COMPETITOR RANKINGS ERROR]', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- Placeholder stubs (to be implemented) ---
export const getSentimentData = async (_req: Request, res: Response) => {
  return res.json({ sentimentScore: null, change: null });
};

export const getTopRankingQuestions = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { aiModel, limit, questionType } = req.query;
    const userId = req.user?.id;

    console.log('[GET_TOP_RANKING_QUESTIONS] Request for company:', companyId, 'aiModel:', aiModel, 'limit:', limit, 'questionType:', questionType);

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const company = await prismaReadReplica.company.findFirst({ where: { id: companyId, userId } });
    if (!company) return res.status(404).json({ error: 'Company not found or unauthorized' });

    const { latestRun } = await findLatestRuns(companyId);
    if (!latestRun) {
      console.log('[GET_TOP_RANKING_QUESTIONS] No latest run found for company:', companyId);
      return res.json({ questions: [], totalCount: 0, runId: null, runDate: null });
    }

    // Parse limit properly: if 'all' or undefined, fetch everything (use large number)
    // Otherwise parse as integer
    let parsedLimit = 1000; // Default to large number for 'all'
    if (limit && limit !== 'all') {
      const limitNum = parseInt(limit as string, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        parsedLimit = limitNum;
      }
    }

    console.log('[GET_TOP_RANKING_QUESTIONS] Using limit:', parsedLimit, '(original:', limit, ')');

    // 10x APPROACH: Use response-level granularity for proper display
    console.log('[GET_TOP_RANKING_QUESTIONS] Using response-level calculation for accurate counts');
    const { calculateTopResponses } = await import('../services/dashboardService');
    const calculationResult = await calculateTopResponses(
      latestRun.id, 
      companyId, 
      { 
        aiModel: aiModel as string,
        questionType: questionType as string 
      }, 
      parsedLimit, 
      0
    );
    
    // Transform response format to match frontend expectations
    const responses = calculationResult?.responses || [];
    const totalCount = calculationResult?.totalCount || 0;
    
    console.log('[GET_TOP_RANKING_QUESTIONS] Response-level calculation returned:', responses.length, 'responses, totalCount:', totalCount);
    
    // Transform to expected frontend format (backwards compatibility)
    const questions = responses.map((r: any) => ({
      id: r.id,
      question: r.question,
      type: r.type,
      bestPosition: r.bestPosition,
      totalMentions: r.position !== null ? 1 : 0, // Simplified for response-level
      averagePosition: r.position,
      bestResponse: r.response,
      bestResponseModel: r.model,
      responses: [{
        model: r.model,
        response: r.response,
        position: r.position,
        createdAt: r.createdAt
      }]
    }));

    res.json({
      questions,
      totalCount,
      runId: latestRun.id,
      runDate: latestRun.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[GET_TOP_RANKING_QUESTIONS] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getSentimentOverTime = async (_req: Request, res: Response) => {
  return res.json([]);
};

export const getShareOfVoiceHistory = async (req: Request, res: Response) => {
  try {
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    const company = await prismaReadReplica.company.findFirst({ where: { id: companyId, userId } });
    if (!company) return res.status(404).json({ error: 'Company not found or unauthorized' });

    // Use the dashboard service function to get the share of voice history
    const { calculateShareOfVoiceHistory } = await import('../services/dashboardService');
    const history = await calculateShareOfVoiceHistory('', companyId, { aiModel: aiModel as string });
    
    return res.json(history);
  } catch (error) {
    console.error('[GET SHARE OF VOICE HISTORY ERROR]', error);
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

      // Handle Benchmarking Questions (schema simplified – only user-created questions)
      if (updateData.benchmarkingQuestions) {
        // Delete existing questions
        await tx.benchmarkingQuestion.deleteMany({ where: { companyId: id } });

        // Re-create supplied questions
        await tx.benchmarkingQuestion.createMany({
          data: updateData.benchmarkingQuestions.map((questionText: string) => ({
            text: questionText,
            companyId: id,
          })),
        });
      }

      // Removed product update handling

      // Return updated company with only user-added data for editing
      return await tx.company.findUnique({
        where: { id },
        include: {
          competitors: { where: { isGenerated: false } },
          benchmarkingQuestions: true,
          // no products
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