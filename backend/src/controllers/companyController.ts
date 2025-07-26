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
 * - getInclusionRateHistory: Controller for fetching inclusion rate history.
 * - updateCompany: Controller for updating a company.
 * - deleteCompany: Controller for deleting a company.
 */
import { Request, Response } from "express";
import { z } from "zod";
import { getPrismaClient, getReadPrismaClient } from "../config/dbCache";
import { getFullReportMetrics } from "../services/metricsService";
import { flexibleUrlSchema } from "../utils/urlNormalizer";


// Validation schemas
const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  website: flexibleUrlSchema,
  industry: z.string().min(1, "Industry is required"),
  // Removed required competitors and benchmarking questions - these will be auto-generated or added later
});

const updateCompanySchema = z.object({
  name: z.string().min(1, "Company name is required").optional(),
  website: flexibleUrlSchema.optional(),
  industry: z.string().min(1, "Industry is required").optional(),
  // Competitors and benchmarking questions can be updated separately if needed
});

/**
 * Create a new company profile with competitors
 */
export const createCompany = async (req: Request, res: Response) => {
  try {
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if user already has 3 companies (maximum limit)
    const existingCompaniesCount = await prisma.company.count({
      where: { userId },
    });

    if (existingCompaniesCount >= 3) {
      return res.status(400).json({
        error: "Maximum company limit reached",
        message:
          "You can only create up to 3 company profiles. Please delete an existing company to create a new one.",
      });
    }

    const { name, website, industry } = createCompanySchema.parse(req.body);

    // Create company first
    const company = await prisma.company.create({
      data: {
        name,
        website,
        industry,
        userId,
      },
      include: {
        competitors: true,
      },
    });

    // Questions will be generated during first report run
    console.log(`[CREATE_COMPANY] Company created. Questions will be generated during first report run.`);

    res.status(201).json({ company });
  } catch (error) {
    console.error("[CREATE COMPANY ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }

    // Handle Prisma unique constraint violations
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002" && "meta" in error && error.meta) {
        const meta = error.meta as { target?: string[] };
        if (
          meta.target?.includes("website") &&
          meta.target?.includes("companyId")
        ) {
          return res.status(400).json({
            error:
              "A competitor with this website already exists for your company. Please use a different website or update the existing competitor.",
          });
        }
      }
    }

    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get all companies for the authenticated user
 */
export const getCompanies = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const companies = await prismaReadReplica.company.findMany({
      where: { userId },
      include: {
        competitors: { where: { isGenerated: false } },
        // no products
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ companies });
  } catch (error) {
    console.error("[GET COMPANIES ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get a specific company by ID (must belong to the authenticated user)
 */
export const getCompany = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // First check if company exists at all
    const companyExists = await prismaReadReplica.company.findUnique({
      where: { id },
    });

    if (!companyExists) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Then check if user owns this company
    if (companyExists.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get company with relations
    const company = await prismaReadReplica.company.findUnique({
      where: { id },
      include: {
        competitors: { where: { isGenerated: false } },
        // no products
      },
    });

    res.json({ company });
  } catch (error) {
    console.error("[GET COMPANY ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ===== Helper =====
const findLatestRuns = async (companyId: string) => {
  const prismaReadReplica = await getReadPrismaClient();
  const latestRun = await prismaReadReplica.reportRun.findFirst({
    where: { companyId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
  });
  if (!latestRun) return { latestRun: null, previousRun: null };

  const previousRun = await prismaReadReplica.reportRun.findFirst({
    where: { companyId, status: "COMPLETED", id: { not: latestRun.id } },
    orderBy: { createdAt: "desc" },
  });
  return { latestRun, previousRun };
};

// --- Average Inclusion Rate (pre-computed) ---
export const getAverageInclusionRate = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify ownership
    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company) {
      return res
        .status(404)
        .json({ error: "Company not found or unauthorized" });
    }

    const { latestRun, previousRun } = await findLatestRuns(companyId);
    if (!latestRun) {
      return res.json({ averageInclusionRate: null, change: null });
    }

    const latestMetrics = await getFullReportMetrics(
      latestRun.id,
      (aiModel as string) || "all",
    );
    const previousMetrics = previousRun
      ? await getFullReportMetrics(previousRun.id, (aiModel as string) || "all")
      : null;

    const latestRate = latestMetrics?.averageInclusionRate ?? null;
    const prevRate = previousMetrics?.averageInclusionRate ?? null;
    const change =
      latestRate !== null && prevRate !== null ? latestRate - prevRate : null;

    return res.json({ averageInclusionRate: latestRate, change });
  } catch (error) {
    console.error("[GET AIR ERROR]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- Average Position (pre-computed) ---
export const getAveragePosition = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ error: "User not authenticated" });

    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company)
      return res
        .status(404)
        .json({ error: "Company not found or unauthorized" });

    const { latestRun, previousRun } = await findLatestRuns(companyId);
    if (!latestRun) return res.json({ averagePosition: null, change: null });

    const latestMetrics = await getFullReportMetrics(
      latestRun.id,
      (aiModel as string) || "all",
    );
    const previousMetrics = previousRun
      ? await getFullReportMetrics(previousRun.id, (aiModel as string) || "all")
      : null;

    const latestPos = latestMetrics?.averagePosition ?? null;
    const prevPos = previousMetrics?.averagePosition ?? null;
    const change =
      latestPos !== null && prevPos !== null ? prevPos - latestPos : null; // lower position is better

    return res.json({ averagePosition: latestPos, change });
  } catch (error) {
    console.error("[GET AVERAGE POSITION ERROR]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- Share of Voice (pre-computed) ---
export const getShareOfVoice = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ error: "User not authenticated" });

    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company)
      return res
        .status(404)
        .json({ error: "Company not found or unauthorized" });

    const { latestRun, previousRun } = await findLatestRuns(companyId);
    if (!latestRun) return res.json({ shareOfVoice: null, change: null });

    const latestMetrics = await getFullReportMetrics(
      latestRun.id,
      (aiModel as string) || "all",
    );
    const previousMetrics = previousRun
      ? await getFullReportMetrics(previousRun.id, (aiModel as string) || "all")
      : null;

    const latestSov = latestMetrics?.shareOfVoice ?? null;
    const prevSov = previousMetrics?.shareOfVoice ?? null;
    const change =
      latestSov !== null && prevSov !== null ? latestSov - prevSov : null;

    return res.json({ shareOfVoice: latestSov, change });
  } catch (error) {
    console.error("[GET SHARE OF VOICE ERROR]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- Competitor Rankings (placeholder using pre-computed JSON) ---
export const getCompetitorRankings = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const { id: companyId } = req.params;
    const { aiModel } = req.query;
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ error: "User not authenticated" });

    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company)
      return res
        .status(404)
        .json({ error: "Company not found or unauthorized" });

    const { latestRun } = await findLatestRuns(companyId);
    if (!latestRun)
      return res.json({
        competitors: [],
        chartCompetitors: [],
        industryRanking: null,
        userCompany: null,
      });

    const metrics = await getFullReportMetrics(
      latestRun.id,
      (aiModel as string) || "all",
    );
    if (metrics?.competitorRankings) {
      return res.json(metrics.competitorRankings);
    }

    // Fallback empty
    return res.json({
      competitors: [],
      chartCompetitors: [],
      industryRanking: null,
      userCompany: null,
    });
  } catch (error) {
    console.error("[GET COMPETITOR RANKINGS ERROR]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- Placeholder stubs (to be implemented) ---
export const getSentimentData = async (_req: Request, res: Response) => {
  return res.json({ sentimentScore: null, change: null });
};

/**
 * Get all questions with responses and brand mentions for prompts page
 */
export const getPromptsWithResponses = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const prismaReadReplica = await getReadPrismaClient();
    const { id: companyId } = req.params;
    const userId = req.user?.id;

    console.log(`[GET_PROMPTS_WITH_RESPONSES] Request for company: ${companyId}`);

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify ownership
    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company) {
      return res
        .status(404)
        .json({ error: "Company not found or unauthorized" });
    }

    // Get all questions for this company (both answered and suggested)
    const questions = await prismaReadReplica.question.findMany({
      where: {
        companyId,
      },
      include: {
        responses: {
          include: {
            run: {
              select: {
                id: true,
                createdAt: true,
                status: true,
              },
            },
            mentions: {
              where: {
                companyId, // Only mentions of the user's company
              },
              select: {
                position: true,
              },
            },
          },
          where: {
            run: {
              status: "COMPLETED", // Only responses from completed runs
            },
          },
          orderBy: [{ run: { createdAt: "desc" } }, { model: "asc" }],
        },
      },
      orderBy: { query: "asc" },
    });

    // Helper function to extract brand mentions from response content
    const extractBrandMentions = (content: string): string[] => {
      const brandMentionRegex = /<brand(?:\s+position="(\d+)")?>([^<]+)<\/brand>/gi;
      const brands: string[] = [];
      let match;
      
      while ((match = brandMentionRegex.exec(content)) !== null) {
        const brandName = match[2].trim();
        if (!brands.includes(brandName)) {
          brands.push(brandName);
        }
      }
      
      return brands;
    };

    // Group questions by text across all runs to show historical responses
    const questionMap = new Map<string, {
      id: string;
      question: string;
      type: string;
      isActive: boolean;
      createdAt: string;
      source: string;
      responses: Array<{
        id: string;
        model: string;
        response: string;
        position: number | null;
        createdAt: string;
        runId: string;
        runDate: string;
        brands: string[];
      }>;
    }>();

    // Process all questions and aggregate responses by question text
    questions.forEach((question) => {
      const questionText = question.query || "Untitled Question";
      
      if (!questionMap.has(questionText)) {
        questionMap.set(questionText, {
          id: question.id,
          question: questionText,
          type: question.type || "unknown",
          isActive: question.isActive,
          createdAt: question.createdAt.toISOString(),
          source: question.source,
          responses: [],
        });
      }

      const questionData = questionMap.get(questionText)!;
      
      // Add all responses from this question (from this specific run)
      question.responses.forEach((response) => {
        // Calculate position from mentions
        const positions = response.mentions
          .map(m => m.position)
          .filter(p => p !== null && p !== undefined);
        const position = positions.length > 0 ? Math.min(...positions) : null;

        questionData.responses.push({
          id: response.id,
          model: response.model,
          response: response.content,
          position,
          createdAt: response.createdAt.toISOString(),
          runId: response.run.id,
          runDate: response.run.createdAt.toISOString(),
          brands: extractBrandMentions(response.content),
        });
      });
    });

    // Convert map to array and sort responses by run date (newest first)
    const transformedQuestions = Array.from(questionMap.values()).map(question => ({
      ...question,
      responses: question.responses.sort((a, b) => 
        new Date(b.runDate).getTime() - new Date(a.runDate).getTime()
      ),
    }));

    const endTime = Date.now();
    console.log(
      `[GET_PROMPTS_WITH_RESPONSES] Completed in ${endTime - startTime}ms. Found ${transformedQuestions.length} questions with ${transformedQuestions.reduce((total, q) => total + q.responses.length, 0)} total responses.`
    );

    res.json({
      questions: transformedQuestions,
    });
  } catch (error) {
    console.error("[GET PROMPTS WITH RESPONSES ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getTopRankingQuestions = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const { id: companyId } = req.params;
    const { aiModel, limit, questionType } = req.query;
    const userId = req.user?.id;

    console.log(
      "[GET_TOP_RANKING_QUESTIONS] Request for company:",
      companyId,
      "aiModel:",
      aiModel,
      "limit:",
      limit,
      "questionType:",
      questionType,
    );

    if (!userId)
      return res.status(401).json({ error: "User not authenticated" });

    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company)
      return res
        .status(404)
        .json({ error: "Company not found or unauthorized" });

    const { latestRun } = await findLatestRuns(companyId);
    if (!latestRun) {
      console.log(
        "[GET_TOP_RANKING_QUESTIONS] No latest run found for company:",
        companyId,
      );
      return res.json({
        questions: [],
        totalCount: 0,
        runId: null,
        runDate: null,
      });
    }

    // Parse limit properly: if 'all' or undefined, fetch everything (use large number)
    // Otherwise parse as integer
    let parsedLimit = 1000; // Default to large number for 'all'
    if (limit && limit !== "all") {
      const limitNum = parseInt(limit as string, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        parsedLimit = limitNum;
      }
    }

    console.log(
      "[GET_TOP_RANKING_QUESTIONS] Using limit:",
      parsedLimit,
      "(original:",
      limit,
      ")",
    );

    // 10x APPROACH: Use response-level granularity for proper display
    console.log(
      "[GET_TOP_RANKING_QUESTIONS] Using response-level calculation for accurate counts",
    );
    const { calculateTopResponses } = await import(
      "../services/dashboardService"
    );
    const calculationResult = await calculateTopResponses(
      latestRun.id,
      companyId,
      {
        aiModel: aiModel as string,
        questionType: questionType as string,
      },
      parsedLimit,
      0,
    );

    // Transform response format to match frontend expectations
    const responses = calculationResult?.responses || [];
    const totalCount = calculationResult?.totalCount || 0;

    console.log(
      "[GET_TOP_RANKING_QUESTIONS] Response-level calculation returned:",
      responses.length,
      "responses, totalCount:",
      totalCount,
    );

    // Transform to expected frontend format (backwards compatibility)
    const questions = responses.map((r: {
      id: string;
      questionId: string;
      question: string;
      questionType: string | null;
      model: string;
      response: string;
      position: number | null;
      totalMentions: number;
      questionBestPosition: number | null;
      createdAt: string;
    }) => ({
      id: r.id,
      question: r.question,
      type: r.questionType,
      bestPosition: r.questionBestPosition,
      totalMentions: r.position !== null ? 1 : 0, // Simplified for response-level
      averagePosition: r.position,
      bestResponse: r.response,
      bestResponseModel: r.model,
      responses: [
        {
          model: r.model,
          response: r.response,
          position: r.position,
          createdAt: r.createdAt,
        },
      ],
    }));

    res.json({
      questions,
      totalCount,
      runId: latestRun.id,
      runDate: latestRun.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[GET_TOP_RANKING_QUESTIONS] Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getSentimentOverTime = async (_req: Request, res: Response) => {
  return res.json([]);
};

export const getShareOfVoiceHistory = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const { id: companyId } = req.params;
    const { aiModel, timezone: _timezone, granularity, dateRange } = req.query;
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ error: "User not authenticated" });

    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company)
      return res
        .status(404)
        .json({ error: "Company not found or unauthorized" });

    // Use the dashboard service function to get the share of voice history
    const { calculateShareOfVoiceHistory } = await import(
      "../services/dashboardService"
    );
    const history = await calculateShareOfVoiceHistory("", companyId, {
      aiModel: aiModel as string,
      granularity: granularity as 'hour' | 'day' | 'week' | undefined,
      dateRange: dateRange as string,
    });

    return res.json(history);
  } catch (error) {
    console.error("[GET SHARE OF VOICE HISTORY ERROR]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getInclusionRateHistory = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const { id: companyId } = req.params;
    const { aiModel, timezone: _timezone, granularity, dateRange } = req.query;
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ error: "User not authenticated" });

    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });
    if (!company)
      return res
        .status(404)
        .json({ error: "Company not found or unauthorized" });

    // Use the dashboard service function to get the inclusion rate history
    const { calculateInclusionRateHistory } = await import(
      "../services/dashboardService"
    );
    const history = await calculateInclusionRateHistory("", companyId, {
      aiModel: aiModel as string,
      granularity: granularity as 'hour' | 'day' | 'week' | undefined,
      dateRange: dateRange as string,
    });

    return res.json(history);
  } catch (error) {
    console.error("[GET INCLUSION RATE HISTORY ERROR]", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Update a company profile
 */
export const updateCompany = async (req: Request, res: Response) => {
  try {
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const updateData = updateCompanySchema.parse(req.body);

    // First check if company exists at all
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Then check if user owns this company
    if (existingCompany.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update company with simplified fields only
    const company = await prisma.company.update({
      where: { id },
      data: {
        name: updateData.name,
        website: updateData.website,
        industry: updateData.industry,
      },
      include: {
        competitors: true,
      },
    });

    res.json({ company });
  } catch (error) {
    console.error("[UPDATE COMPANY ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }

    // Handle Prisma unique constraint violations
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002" && "meta" in error && error.meta) {
        const meta = error.meta as { target?: string[] };
        if (
          meta.target?.includes("website") &&
          meta.target?.includes("companyId")
        ) {
          return res.status(400).json({
            error:
              "A competitor with this website already exists for your company. Please use a different website or update the existing competitor.",
          });
        }
      }
    }

    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Delete a company profile
 */
export const deleteCompany = async (req: Request, res: Response) => {
  try {
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // First check if company exists at all
    const existingCompany = await prisma.company.findUnique({
      where: { id },
    });

    if (!existingCompany) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Then check if user owns this company
    if (existingCompany.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Delete company (competitors will be deleted due to cascade)
    await prisma.company.delete({
      where: { id },
    });

    res.json({ message: "Company deleted successfully" });
  } catch (error) {
    console.error("[DELETE COMPANY ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get accepted competitors for a company (user's company + manually accepted competitors)
 */
export const getCitations = async (req: Request, res: Response) => {
  try {
    const prisma = await getReadPrismaClient();
    const userId = req.user?.id;
    const { id: companyId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Get citations through Response model relationship since Citation model uses responseId
    const citations = await prisma.citation.findMany({
      where: {
        response: {
          question: {
            companyId: companyId
          }
        }
      },
      orderBy: { url: 'asc' },
    });

    res.json({ citations });
  } catch (error) {
    console.error("Error fetching citations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getAcceptedCompetitors = async (req: Request, res: Response) => {
  try {
    const prisma = await getReadPrismaClient();
    const userId = req.user?.id;
    const { id: companyId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Get accepted competitors (user's company + accepted auto-discovered + manually added)
    const acceptedCompetitors = await prisma.competitor.findMany({
      where: {
        companyId,
        OR: [
          { isGenerated: false }, // Manually added competitors
          { AND: [{ isGenerated: true }, { isAccepted: true }] }, // Accepted auto-discovered
        ],
      },
      orderBy: { name: 'asc' },
    });

    // Add user's company to the list
    const competitors = [
      {
        id: company.id,
        name: company.name,
        website: company.website,
        isGenerated: false,
        isAccepted: true,
      },
      ...acceptedCompetitors,
    ];

    res.json({ competitors });
  } catch (error) {
    console.error("[GET ACCEPTED COMPETITORS ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get suggested competitors for a company (auto-discovered but not yet accepted/declined)
 */
export const getSuggestedCompetitors = async (req: Request, res: Response) => {
  try {
    const prisma = await getReadPrismaClient();
    const userId = req.user?.id;
    const { id: companyId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Get suggested competitors (auto-discovered but not yet accepted/declined)
    const suggestedCompetitors = await prisma.competitor.findMany({
      where: {
        companyId,
        isGenerated: true,
        isAccepted: null, // Not yet accepted or declined
      },
      include: {
        mentions: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform to include mention counts
    const competitors = suggestedCompetitors.map(competitor => ({
      id: competitor.id,
      name: competitor.name,
      website: competitor.website,
      isGenerated: competitor.isGenerated,
      isAccepted: false,
      mentions: competitor.mentions.length,
    }));

    res.json({ competitors });
  } catch (error) {
    console.error("[GET SUGGESTED COMPETITORS ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Accept a suggested competitor
 */
export const acceptCompetitor = async (req: Request, res: Response) => {
  try {
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id: companyId, competitorId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Update competitor to accepted
    const updatedCompetitor = await prisma.competitor.update({
      where: {
        id: competitorId,
        companyId,
        isGenerated: true,
        isAccepted: null,
      },
      data: {
        isAccepted: true,
      },
    });

    res.json({ competitor: updatedCompetitor });
  } catch (error) {
    console.error("[ACCEPT COMPETITOR ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Decline a suggested competitor
 */
export const declineCompetitor = async (req: Request, res: Response) => {
  try {
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id: companyId, competitorId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Update competitor to declined
    const updatedCompetitor = await prisma.competitor.update({
      where: {
        id: competitorId,
        companyId,
        isGenerated: true,
        isAccepted: null,
      },
      data: {
        isAccepted: false,
      },
    });

    res.json({ competitor: updatedCompetitor });
  } catch (error) {
    console.error("[DECLINE COMPETITOR ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Add a new competitor manually
 */
export const addCompetitor = async (req: Request, res: Response) => {
  try {
    const addCompetitorSchema = z.object({
      name: z.string().min(1, "Name is required").max(100),
      website: flexibleUrlSchema,
    });

    const validatedData = addCompetitorSchema.parse(req.body);
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id: companyId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Create new competitor
    const newCompetitor = await prisma.competitor.create({
      data: {
        name: validatedData.name,
        website: validatedData.website,
        companyId,
        isGenerated: false,
        isAccepted: true, // Manually added competitors are automatically accepted
      },
    });

    res.json(newCompetitor);
  } catch (error) {
    console.error("[ADD COMPETITOR ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }

    // Handle Prisma unique constraint violations
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002" && "meta" in error && error.meta) {
        const meta = error.meta as { target?: string[] };
        if (meta.target?.includes("website") && meta.target?.includes("companyId")) {
          return res.status(400).json({
            error: "A competitor with this website already exists for your company.",
          });
        }
      }
    }

    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update a competitor
 */
export const updateCompetitor = async (req: Request, res: Response) => {
  try {
    const updateCompetitorSchema = z.object({
      name: z.string().min(1, "Name is required").max(100),
      website: flexibleUrlSchema,
    });

    const validatedData = updateCompetitorSchema.parse(req.body);
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id: companyId, competitorId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Update competitor
    const updatedCompetitor = await prisma.competitor.update({
      where: {
        id: competitorId,
        companyId,
      },
      data: {
        name: validatedData.name,
        website: validatedData.website,
      },
    });

    res.json(updatedCompetitor);
  } catch (error) {
    console.error("[UPDATE COMPETITOR ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }

    // Handle Prisma unique constraint violations
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2002" && "meta" in error && error.meta) {
        const meta = error.meta as { target?: string[] };
        if (meta.target?.includes("website") && meta.target?.includes("companyId")) {
          return res.status(400).json({
            error: "A competitor with this website already exists for your company.",
          });
        }
      }
    }

    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Delete a competitor
 */
export const deleteCompetitor = async (req: Request, res: Response) => {
  try {
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id: companyId, competitorId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Delete competitor
    await prisma.competitor.delete({
      where: {
        id: competitorId,
        companyId,
      },
    });

    res.json({ message: "Competitor deleted successfully" });
  } catch (error) {
    console.error("[DELETE COMPETITOR ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Add a new question manually
 */
export const addQuestion = async (req: Request, res: Response) => {
  try {
    const addQuestionSchema = z.object({
      query: z.string().min(1, "Question is required").max(500),
      isActive: z.boolean().default(false),
    });

    const validatedData = addQuestionSchema.parse(req.body);
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id: companyId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Check active question limit for free users
    if (validatedData.isActive) {
      const activeQuestions = await prisma.question.count({
        where: { companyId, isActive: true },
      });

      // Free users limited to 5 active questions
      const user = req.user;
      const hasActiveSubscription = user?.subscriptionStatus === "active";
      const isInActiveTrial = user?.subscriptionStatus === "trialing" && 
        user?.trialEndsAt && new Date() < new Date(user.trialEndsAt);
      
      // Admins have unlimited access
      const isAdmin = user?.role === "ADMIN";
      if (!isAdmin && !hasActiveSubscription && !isInActiveTrial && activeQuestions >= 5) {
        return res.status(403).json({ 
          error: "Free accounts are limited to 5 active questions",
          message: "Upgrade to add more active questions",
          currentActive: activeQuestions,
          limit: 5
        });
      }
    }

    // Create new question (source defaults to "user")
    const newQuestion = await prisma.question.create({
      data: {
        query: validatedData.query,
        isActive: validatedData.isActive,
        companyId,
        // type, intent, and source will use their defaults (null, null, "user")
      },
    });

    res.json(newQuestion);
  } catch (error) {
    console.error("[ADD QUESTION ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update a question
 */
export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const updateQuestionSchema = z.object({
      query: z.string().min(1, "Question is required").max(500).optional(),
      isActive: z.boolean().optional(),
    });

    const validatedData = updateQuestionSchema.parse(req.body);
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id: companyId, questionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Find the question first to check what we can update
    const existingQuestion = await prisma.question.findFirst({
      where: {
        id: questionId,
        companyId,
      },
    });

    if (!existingQuestion) {
      return res.status(404).json({ error: "Question not found" });
    }

    // Only allow updating query text for user questions, but allow isActive updates for all questions
    const updateData: any = {};
    
    if (validatedData.query !== undefined) {
      if (existingQuestion.source !== "user") {
        return res.status(403).json({ error: "Cannot edit query text for AI-generated questions" });
      }
      updateData.query = validatedData.query;
    }
    
    if (validatedData.isActive !== undefined) {
      updateData.isActive = validatedData.isActive;
    }

    const updatedQuestion = await prisma.question.update({
      where: {
        id: questionId,
        companyId,
      },
      data: updateData,
    });

    res.json(updatedQuestion);
  } catch (error) {
    console.error("[UPDATE QUESTION ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Check if company questions are ready for report generation
 */
export const getCompanyReadiness = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const userId = req.user?.id;
    const { id: companyId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company and get readiness status
    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
      select: {
        id: true,
        name: true,
        questionsReady: true,
        _count: {
          select: {
            questions: {
              where: { isActive: true }
            }
          }
        }
      },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    res.json({ 
      companyId: company.id,
      companyName: company.name,
      questionsReady: company.questionsReady,
      activeQuestionCount: company._count.questions,
      canGenerateReport: company.questionsReady && company._count.questions > 0,
    });
  } catch (error) {
    console.error("[GET COMPANY READINESS ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Delete a question
 */
export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const prisma = await getPrismaClient();
    const userId = req.user?.id;
    const { id: companyId, questionId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Delete question (allow deleting both user and AI-generated questions)
    await prisma.question.delete({
      where: {
        id: questionId,
        companyId,
      },
    });

    res.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("[DELETE QUESTION ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Get all questions for a company (both AI-generated and user-added)
 */
export const getCompanyQuestions = async (req: Request, res: Response) => {
  try {
    const prismaReadReplica = await getReadPrismaClient();
    const userId = req.user?.id;
    const { id: companyId } = req.params;
    const { source, isActive } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify user owns this company
    const company = await prismaReadReplica.company.findFirst({
      where: { id: companyId, userId },
    });

    if (!company) {
      return res.status(404).json({ error: "Company not found" });
    }

    // Build filter conditions
    const whereConditions: Record<string, unknown> = { companyId };
    if (source && typeof source === 'string') {
      whereConditions.source = source;
    }
    if (isActive !== undefined) {
      whereConditions.isActive = isActive === 'true';
    }

    const questions = await prismaReadReplica.question.findMany({
      where: whereConditions,
      orderBy: [
        { isActive: 'desc' }, // Active questions first
        { source: 'asc' },    // AI questions before user questions
        { createdAt: 'asc' }, // Oldest first within each group
      ],
    });

    res.json({ questions });
  } catch (error) {
    console.error("[GET COMPANY QUESTIONS ERROR]", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
