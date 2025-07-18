/**
 * @file optimizationTaskService.ts
 * @description Optimization task service using hardcoded preset tasks
 * 
 * This service provides database management and predefined optimization tasks for the report system.
 * The system now uses hardcoded preset tasks instead of AI-generated tasks for better reliability.
 * 
 * @description This file provides task management and database operations for optimization tasks.
 * Uses proven, hardcoded optimization tasks that provide consistent value to clients.
 *
 * @current_status
 * - ❌ generateOptimizationTasksAndSummary: DEPRECATED (was causing reliability issues)
 * - ✅ persistOptimizationTasks: USED for database persistence
 * - ✅ getOptimizationTasks: USED for task retrieval
 * - ✅ toggleTaskCompletion: USED for task management
 * - ✅ updateTaskStatus: USED for task management
 * - ✅ PRESET_TASKS: PRIMARY SOURCE for optimization tasks
 */
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
// NOTE: LLM imports removed - now using hardcoded preset tasks
import { ModelTask, ModelEngine, getModelsByTask } from '../config/models';

// NOTE: Now using hardcoded preset tasks for reliability and consistency

const PRESET_TASKS = [
    {
        id: 'S01',
        title: 'Verify robots.txt & llms.txt',
        description: '1. Navigate to https://<domain>/robots.txt in your browser; 2. If the file is missing or blocks key directories, copy a best-practice template from any reputable robots.txt generator; 3. In a text editor, create "llms.txt" with a one-sentence brand description and "Allow: /"; 4. Upload both files via your CMS file manager or hosting control panel; 5. Reload both URLs to confirm they return a 200 status.',
        category: 'Technical SEO' as const,
        priority: 'High' as const,
        impact_metric: 'inclusionRate' as const,
    },
    {
        id: 'S02',
        title: 'Implement Comprehensive Schema Markup',
        description: '1. Use an online schema markup generator and choose "Organization", "Product" and "Article"; 2. Fill in your company details and copy the JSON-LD; 3. In your CMS, paste the code into the global "Header / Custom HTML" field; 4. Save, publish and test three URLs in a rich-results testing tool; 5. If errors appear, edit and retest until green; 6. Resubmit the pages in your search console for faster indexing.',
        category: 'Technical SEO',
        priority: 'High',
        impact_metric: 'averagePosition',
    },
    {
        id: 'S03',
        title: 'Create Brand-Specific Landing Pages',
        description: '1. Research the top 10 queries where competitors rank but you don\'t; 2. For each query, create a 500+ word landing page with title tag including the exact query; 3. Include your brand name naturally 3-5 times; 4. Add internal links to your main product/service pages; 5. Submit the new URLs to your search console; 6. Monitor for visibility improvements over 2-4 weeks.',
        category: 'Content & Messaging',
        priority: 'High',
        impact_metric: 'visibility',
    },
    {
        id: 'S04',
        title: 'Optimize Core Service Pages for AI Mentions',
        description: '1. Identify your 5 most important service/product pages; 2. For each page, add a FAQ section with 3-5 questions customers actually ask; 3. Write clear, direct answers using natural language; 4. Include your brand name in 2-3 FAQ answers; 5. Update the page title to include your primary service keyword; 6. Test the updated pages using AI search tools to verify improved mentions.',
        category: 'Content & Messaging',
        priority: 'High',
        impact_metric: 'inclusionRate',
    },
    {
        id: 'S05',
        title: 'Establish Thought Leadership Content Hub',
        description: '1. Choose 3 topics where your company has genuine expertise; 2. Create a dedicated resource page for each topic with 5+ in-depth articles; 3. Include case studies, statistics, and unique insights; 4. Link to authoritative external sources to build trust; 5. Share the content on professional networks; 6. Monitor AI search results for mentions in industry-related queries.',
        category: 'Brand Positioning',
        priority: 'Medium',
        impact_metric: 'visibility',
    }
];

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export const TASK_CATEGORIES = {
  'Technical SEO': 'Technical SEO',
  'Content & Messaging': 'Content & Messaging',
  'Brand Positioning': 'Brand Positioning',
  'Link Building': 'Link Building',
  'Local SEO': 'Local SEO'
} as const;

export type TaskCategory = keyof typeof TASK_CATEGORIES;

const TaskPriorityEnum = z.enum(['High', 'Medium', 'Low']);
const TaskCategoryEnum = z.enum(['Technical SEO', 'Content & Messaging', 'Brand Positioning', 'Link Building', 'Local SEO']);
const ImpactMetricEnum = z.enum(['visibility', 'averagePosition', 'inclusionRate']);

const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(1000),
  category: TaskCategoryEnum,
  priority: TaskPriorityEnum,
  impact_metric: ImpactMetricEnum,
});

export interface OptimizationTasksResult {
  tasks: z.infer<typeof TaskSchema>[];
  summary: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * @deprecated REPLACED by hardcoded preset tasks
 * This function throws an error to prevent accidental usage
 */
export async function generateOptimizationTasksAndSummary(
  runId: string,
  companyId: string,
  prisma: PrismaClient,
  forceTaskGeneration: boolean = false,
): Promise<OptimizationTasksResult> {
  // DEPRECATED: This function should not be used - throw explicit error
  throw new Error(
    'DEPRECATED: generateOptimizationTasksAndSummary has been replaced by hardcoded preset tasks. ' +
    'Use the preset tasks directly in reportWorker.ts instead. ' +
    'See reportWorker.ts for the current implementation pattern.'
  );
}

// ===== TASK PERSISTENCE FUNCTIONS (STILL USED) =====

export async function persistOptimizationTasks(
  tasks: z.infer<typeof TaskSchema>[],
  runId: string,
  companyId: string,
  prisma: PrismaClient
): Promise<void> {
  const optimizationTasks = tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    impact_metric: task.impact_metric,
    status: TaskStatus.PENDING,
    reportId: runId,
    companyId: companyId,
  }));

  // Use upsert to handle potential duplicates gracefully
  for (const task of optimizationTasks) {
    await prisma.visibilityOptimizationTask.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        impactMetric: task.impact_metric,
      },
      create: {
        id: task.id,
        taskId: task.id, // Use task.id as taskId for the compound unique constraint
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        impactMetric: task.impact_metric,
        dependencies: {}, // Default empty dependencies JSON
        status: task.status,
        reportRunId: runId,
        companyId: companyId,
      },
    });
  }
}

export async function getOptimizationTasks(companyId: string, prisma: PrismaClient) {
  return prisma.visibilityOptimizationTask.findMany({
    where: { companyId },
    orderBy: [
      { priority: 'asc' }, // High priority first (enum ordering)
      { createdAt: 'desc' }
    ],
  });
}

export async function toggleTaskCompletion(taskId: string, prisma: PrismaClient) {
  const task = await prisma.visibilityOptimizationTask.findFirst({ where: { taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);
  
  const newStatus = task.status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED;
  
  return prisma.visibilityOptimizationTask.update({
    where: { id: task.id },
    data: { 
      status: newStatus,
      completedAt: newStatus === TaskStatus.COMPLETED ? new Date() : null
    },
  });
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, prisma: PrismaClient) {
  const task = await prisma.visibilityOptimizationTask.findFirst({ where: { taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);
  
  return prisma.visibilityOptimizationTask.update({
    where: { id: task.id },
    data: { 
      status,
      completedAt: status === TaskStatus.COMPLETED ? new Date() : null
    },
  });
} 