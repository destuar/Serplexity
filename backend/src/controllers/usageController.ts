/**
 * @file usageController.ts
 * @description Controller for usage analytics and report history endpoints
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { getPrismaClient } from '../config/dbCache';

// Request schemas
const reportHistoryQuerySchema = z.object({
  days: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
});

/**
 * Get report history for the authenticated user
 */
export async function getReportHistory(req: Request, res: Response) {
  try {
    const { days = 30, limit = 50 } = reportHistoryQuerySchema.parse(req.query);
    const userId = req.user!.id;
    const prisma = await getPrismaClient();

    // Calculate date filter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's companies to filter reports
    const userCompanies = await prisma.company.findMany({
      where: { userId },
      select: { id: true, name: true }
    });

    const companyIds = userCompanies.map((c: { id: string; name: string }) => c.id);
    const companyNameMap = new Map(userCompanies.map((c: { id: string; name: string }) => [c.id, c.name]));

    if (companyIds.length === 0) {
      return res.json([]);
    }

    // Fetch report runs with aggregated data
    const reportRuns = await prisma.reportRun.findMany({
      where: {
        companyId: { in: companyIds },
        createdAt: { gte: startDate }
      },
      include: {
        responses: {
          select: { 
            id: true,
            question: {
              select: { id: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Transform data for frontend
    const reportHistory = reportRuns.map((run: any) => {
      // Calculate unique prompt count from responses
      const uniqueQuestionIds = new Set(
        run.responses.map((response: any) => response.question.id)
      );

      return {
        id: run.id,
        createdAt: run.createdAt,
        companyName: companyNameMap.get(run.companyId) || 'Unknown',
        promptCount: uniqueQuestionIds.size,
        responseCount: run.responses.length
      };
    });

    res.json(reportHistory);
  } catch (error) {
    console.error('Error fetching report history:', error);
    res.status(500).json({ error: 'Failed to fetch report history' });
  }
}

/**
 * Get usage statistics summary for the authenticated user
 */
export async function getUsageStatistics(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const prisma = await getPrismaClient();

    // Get user's companies
    const userCompanies = await prisma.company.findMany({
      where: { userId },
      select: { id: true }
    });

    const companyIds = userCompanies.map((c: { id: string }) => c.id);

    if (companyIds.length === 0) {
      return res.json({
        totalReports: 0,
        totalResponses: 0,
        avgSentiment: null,
        totalCost: 0
      });
    }

    // Get aggregate statistics
    const [
      totalReports,
      totalResponses,
      totalActivePrompts
    ] = await Promise.all([
      // Total report runs
      prisma.reportRun.count({
        where: { companyId: { in: companyIds } }
      }),

      // Total responses across all reports
      prisma.response.count({
        where: {
          run: { companyId: { in: companyIds } }
        }
      }),

      // Total active prompts across all user companies
      prisma.question.count({
        where: {
          companyId: { in: companyIds },
          isActive: true
        }
      })
    ]);

    const usageStats = {
      totalWorkspaces: companyIds.length,
      totalReports,
      totalActivePrompts,
      totalResponses
    };

    res.json(usageStats);
  } catch (error) {
    console.error('Error fetching usage statistics:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
}