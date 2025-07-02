import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOptimizationTasks, toggleTaskCompletion } from '../services/optimizationTaskService';

export const getCompanyOptimizationTasks = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        
        const tasks = await getOptimizationTasks(companyId, prisma);
        
        res.json({ tasks });
    } catch (error) {
        console.error('Error fetching optimization tasks:', error);
        res.status(500).json({ 
            error: 'Failed to fetch optimization tasks',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const toggleOptimizationTaskCompletion = async (req: Request, res: Response) => {
    try {
        const { reportRunId, taskId } = req.params;
        
        const updatedTask = await toggleTaskCompletion(taskId, reportRunId, prisma);
        
        res.json({ task: updatedTask });
    } catch (error) {
        console.error('Error toggling task completion:', error);
        res.status(500).json({ 
            error: 'Failed to toggle task completion',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export const getCompanyVisibilitySummary = async (req: Request, res: Response) => {
    try {
        const { companyId } = req.params;
        
        const latestReport = await prisma.reportRun.findFirst({
            where: { 
                companyId,
                status: 'COMPLETED',
                aiVisibilitySummary: { not: null }
            },
            select: { aiVisibilitySummary: true },
            orderBy: { createdAt: 'desc' }
        });
        
        res.json({ 
            summary: latestReport?.aiVisibilitySummary || null
        });
    } catch (error) {
        console.error('Error fetching visibility summary:', error);
        res.status(500).json({ 
            error: 'Failed to fetch visibility summary',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}; 