import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/db';

// Validation schemas
const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.string().url('Invalid website URL').optional(),
  industry: z.string().min(1, 'Industry is required'),
  competitors: z.array(z.string().min(1, 'Competitor name cannot be empty')).min(1, 'At least one competitor is required').max(5, 'Maximum 5 competitors allowed'),
});

const updateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').optional(),
  website: z.string().url('Invalid website URL').optional(),
  industry: z.string().min(1, 'Industry is required').optional(),
  competitors: z.array(z.string().min(1, 'Competitor name cannot be empty')).min(1, 'At least one competitor is required').max(5, 'Maximum 5 competitors allowed').optional(),
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

    const { name, website, industry, competitors } = createCompanySchema.parse(req.body);

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
      await tx.competitor.createMany({
        data: competitors.map(competitorName => ({
          name: competitorName,
          companyId: newCompany.id,
        })),
      });

      // Return company with competitors
      return await tx.company.findUnique({
        where: { id: newCompany.id },
        include: {
          competitors: true,
        },
      });
    });

    res.status(201).json({ company });
  } catch (error) {
    console.error('[CREATE COMPANY ERROR]', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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

    const companies = await prisma.company.findMany({
      where: { userId },
      include: {
        competitors: true,
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

    const company = await prisma.company.findFirst({
      where: {
        id,
        userId, // Ensure user owns this company
      },
      include: {
        competitors: true,
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (error) {
    console.error('[GET COMPANY ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
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

    // Check if company exists and belongs to user
    const existingCompany = await prisma.company.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingCompany) {
      return res.status(404).json({ error: 'Company not found' });
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

      // If competitors are provided, replace all existing competitors
      if (updateData.competitors) {
        // Delete existing competitors
        await tx.competitor.deleteMany({
          where: { companyId: id },
        });

        // Create new competitors
        await tx.competitor.createMany({
          data: updateData.competitors.map(competitorName => ({
            name: competitorName,
            companyId: id,
          })),
        });
      }

      // Return updated company with competitors
      return await tx.company.findUnique({
        where: { id },
        include: {
          competitors: true,
        },
      });
    });

    res.json({ company });
  } catch (error) {
    console.error('[UPDATE COMPANY ERROR]', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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

    // Check if company exists and belongs to user
    const existingCompany = await prisma.company.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingCompany) {
      return res.status(404).json({ error: 'Company not found' });
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