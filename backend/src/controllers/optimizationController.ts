/**
 * @file optimizationController.ts
 * @description This file contains the controllers for managing optimization tasks.
 * It provides endpoints for fetching, toggling completion, and updating the status of optimization tasks,
 * as well as retrieving the latest AI-generated visibility summary for a company. This is a key part of the system's
 * proactive, data-driven approach to SEO and content strategy.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - ../config/db: The singleton Prisma client instance for database interactions.
 * - ../services/optimizationTaskService: Service for handling the business logic of optimization tasks.
 *
 * @exports
 * - getCompanyOptimizationTasks: Controller for fetching all optimization tasks for a company.
 * - toggleOptimizationTaskCompletion: Controller for toggling the completion status of a task.
 * - updateOptimizationTaskStatus: Controller for updating the status of a task.
 * - getCompanyVisibilitySummary: Controller for fetching the latest AI-generated visibility summary.
 */
import { Request, Response } from 'express';
import prisma from '../config/db';
import { getOptimizationTasks, toggleTaskCompletion, updateTaskStatus, TaskStatus } from '../services/optimizationTaskService';

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

export const updateOptimizationTaskStatus = async (req: Request, res: Response) => {
    try {
        const { reportRunId, taskId } = req.params;
        const { status } = req.body;
        
        // Validate status
        if (!status || !Object.values(TaskStatus).includes(status)) {
            return res.status(400).json({ 
                error: 'Invalid status',
                details: `Status must be one of: ${Object.values(TaskStatus).join(', ')}`
            });
        }
        
        const updatedTask = await updateTaskStatus(taskId, reportRunId, status, prisma);
        
        res.json({ task: updatedTask });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ 
            error: 'Failed to update task status',
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