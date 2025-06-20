import { Request, Response } from 'express';
import { z } from 'zod';
import { reportGenerationQueue } from '../queues/reportGenerationQueue';
import prisma from '../config/db';
import { trace } from '@opentelemetry/api';

const createReportSchema = z.object({
  companyId: z.string(),
});

export const createReport = async (req: Request, res: Response) => {
  try {
    const { companyId } = createReportSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      // This should technically be caught by the authenticate middleware, but it's good practice
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify the user has access to this company before proceeding
    const company = await prisma.company.findFirst({
      where: { id: companyId, userId: userId },
    });

    if (!company) {
      return res.status(403).json({ error: 'Access to this company is denied or company does not exist' });
    }

    const span = trace.getActiveSpan();
    const traceId = span?.spanContext().traceId;

    // Create a record for the report run
    const reportRun = await prisma.reportRun.create({
      data: {
        companyId,
        status: 'PENDING',
        traceId: traceId,
      },
    });

    // Add job to the queue with retry options
    await reportGenerationQueue.add('generate-report', {
      runId: reportRun.id,
      companyId: companyId,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5 seconds
      },
    });

    res.status(202).json({
      message: 'Report generation has been queued',
      runId: reportRun.id,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('[CREATE REPORT ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReportStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const report = await prisma.reportRun.findFirst({
      where: {
        id: id,
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
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    res.status(200).json(report);
  } catch (error) {
    console.error('[GET REPORT STATUS ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLatestReport = async (req: Request, res: Response) => {
  const { companyId } = req.params;
  // TODO: Add filtering logic based on query params (req.query)

  try {
    const report = await prisma.report.findFirst({
      where: {
        companyId: companyId,
        status: 'COMPLETED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!report || !report.data) {
      return res.status(404).json({ message: 'No report found for this company.' });
    }

    // The report.data is stored as a JSON string, so we need to parse it.
    const reportData = JSON.parse(report.data as string);

    res.status(200).json(reportData);
  } catch (error) {
    console.error(`Failed to get latest report for companyId ${companyId}:`, error);
    res.status(500).json({ error: 'Failed to retrieve report' });
  }
}; 