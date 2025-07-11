import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateAndValidate, generateChatCompletion } from './llmService';
import { ModelTask, ModelEngine, getModelsByTask } from '../config/models';
import { OPTIMIZATION_TASKS_PROMPT, SUMMARY_PROMPT, PRESET_TASKS } from '../prompts/visibilityOptimizationPrompts';

function replacePlaceholders(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = context[trimmedKey];
    if (value !== undefined && value !== null) {
      if (typeof value === 'number') {
        return Number(value.toFixed(2)).toString();
      }
      return String(value);
    }
    return match;
  });
}

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(['Technical SEO', 'Third-Party Citations', 'Content Creation', 'PR & Thought Leadership', 'Measurement']),
  priority: z.enum(['High', 'Medium', 'Low']),
  impact_metric: z.enum(['shareOfVoice', 'inclusionRate', 'averagePosition', 'sentimentScore']),
});

const TasksArraySchema = z.array(TaskSchema);

interface OptimizationTasksResult {
  tasks: z.infer<typeof TaskSchema>[];
  summary: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface CompanyContext {
  name: string;
  industry: string | null;
  website: string;
  competitors: string[];
  hasFirstReport: boolean;
  productKeywords: string[];
}

interface ReportMetricsContext {
  shareOfVoice: number;
  shareOfVoiceChange?: number | null;
  averageInclusionRate: number;
  averageInclusionChange?: number | null;
  averagePosition: number;
  averagePositionChange?: number | null;
  sentimentScore?: number | null;
  sentimentChange?: number | null;
  competitorRankings?: any;
  topQuestions?: any;
}

// Prompts are now centralized in backend/src/prompts/visibilityOptimizationPrompts.ts

// Preset tasks have been moved to prompts/visibilityOptimizationPrompts.ts
type PresetTask = z.infer<typeof TaskSchema>;

export async function generateOptimizationTasksAndSummary(
  runId: string,
  companyId: string,
  prisma: PrismaClient,
  forceTaskGeneration: boolean = false,
): Promise<OptimizationTasksResult> {
  
  // Check if this is the first report for the company
  const reportCount = await prisma.reportRun.count({
    where: { 
      companyId,
      status: 'COMPLETED',
      id: { not: runId } // Exclude current run
    }
  });
  
  const isFirstReport = reportCount === 0;
  
  // Get company context
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { competitors: true }
  });
  
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  
  // Get latest report metrics (aggregated across models for now)
  const latestMetric = await prisma.reportMetric.findFirst({
    where: { reportId: runId, aiModel: 'all' },
  });
  
  if (!latestMetric) {
    throw new Error(`No metrics found for report: ${runId}`);
  }
  
  const companyContext: CompanyContext = {
    name: company.name,
    industry: company.industry,
    website: company.website,
    competitors: company.competitors.map(c => c.name),
    hasFirstReport: isFirstReport,
    productKeywords: [],
  };
  
  const metricsContext: ReportMetricsContext = {
    shareOfVoice: latestMetric.shareOfVoice,
    shareOfVoiceChange: latestMetric.shareOfVoiceChange,
    averageInclusionRate: latestMetric.averageInclusionRate,
    averageInclusionChange: latestMetric.averageInclusionChange,
    averagePosition: latestMetric.averagePosition,
    averagePositionChange: latestMetric.averagePositionChange,
    sentimentScore: latestMetric.sentimentScore,
    sentimentChange: latestMetric.sentimentChange,
    competitorRankings: latestMetric.competitorRankings,
    topQuestions: latestMetric.topQuestions
  };
  
  // Create a lean version of metrics for task generation to reduce token usage
  const { competitorRankings, topQuestions, ...leanMetricsContext } = metricsContext;
  
  // Create a flattened context for placeholder replacement.
  // Get top competitor by share of voice from metrics data
  const topCompetitorByShareOfVoice = metricsContext.competitorRankings?.competitors?.[0]?.name || 
                                      metricsContext.competitorRankings?.chartCompetitors?.find((c: any) => !c.isUserCompany)?.name ||
                                      company.competitors[0]?.name || 
                                      'N/A';
  
  const fullTemplateContext = {
    ...companyContext,
    ...metricsContext,
    topCompetitor: topCompetitorByShareOfVoice,
  };
  const leanTemplateContext = {
    ...companyContext,
    ...leanMetricsContext,
  };

  let tasks: z.infer<typeof TaskSchema>[] = [];
  let tasksTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  
  // Prefer a Gemini (Google) model for optimization tasks if available
  const optimizationModels = getModelsByTask(ModelTask.OPTIMIZATION_TASKS);
  const taskModel = optimizationModels.find(m => m.engine === ModelEngine.GOOGLE) || optimizationModels[0];
  if (!taskModel) throw new Error('No LLM configured for OPTIMIZATION_TASKS');

  // For the summary, prefer an OpenAI model as requested.
  const summaryModels = getModelsByTask(ModelTask.OPTIMIZATION_TASKS);
  const summaryModel = summaryModels.find(m => m.engine === ModelEngine.OPENAI) || summaryModels[0];
  if (!summaryModel) throw new Error('No LLM configured for AI Visibility Summary generation');

  // Generate tasks only for first report, iteratively requesting ONE at a time to avoid duplicates
  if (isFirstReport || forceTaskGeneration) {
    const createdTasks: z.infer<typeof TaskSchema>[] = [];
    const accumulatedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const TARGET_TASK_COUNT = 10;
    const MAX_ATTEMPTS = 30; // safeguard against infinite loops
    let attempts = 0;

    while (createdTasks.length < TARGET_TASK_COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      
      // Progress logging for better visibility
      const progressPercent = Math.round((createdTasks.length / TARGET_TASK_COUNT) * 100);
      console.log(`[OptimizationTasks] Progress: ${createdTasks.length}/${TARGET_TASK_COUNT} tasks generated (${progressPercent}%) - Attempt ${attempts}`);
      
      // 1. Replace placeholders in the prompt template
      const finalTaskPrompt = replacePlaceholders(OPTIMIZATION_TASKS_PROMPT, leanTemplateContext);

      // 2. Create the minimal context needed for the model's instructions
      const tasksPayload = {
        disallowedTitles: [...PRESET_TASKS, ...createdTasks].map(t => t.title),
        disallowedIds: [...createdTasks].map(t => t.id),
      };

      const promptWithPayload = `${finalTaskPrompt}\n\n<CONTEXT>${JSON.stringify(tasksPayload)}`;

      try {
        const { data: generatedTask, usage } = await generateAndValidate<
          z.infer<typeof TaskSchema>,
          z.infer<typeof TaskSchema>
        >(
          promptWithPayload,
          TaskSchema,
          taskModel,
          ModelTask.OPTIMIZATION_TASKS,
          undefined, // No transform function
          (data: any) => { // Rescue function
            if (data && data.impact_metric === 'averageInclusionRate') {
              data.impact_metric = 'inclusionRate';
            }
            return data;
          }
        );

        // Ensure uniqueness by ID and Title before pushing
        const isDuplicate = createdTasks.some(t => t.id === generatedTask.id || t.title === generatedTask.title);
        if (!isDuplicate) {
          createdTasks.push(generatedTask);
          console.log(`[OptimizationTasks] Generated task: "${generatedTask.title}" (${createdTasks.length}/${TARGET_TASK_COUNT})`);
        } else {
          console.log(`[OptimizationTasks] Duplicate task detected, skipping: "${generatedTask.title}"`);
        }
        
        accumulatedUsage.promptTokens += usage.promptTokens;
        accumulatedUsage.completionTokens += usage.completionTokens;
        accumulatedUsage.totalTokens += usage.totalTokens;

        // Reduced delay for faster generation
        await new Promise(res => setTimeout(res, 100)); // Reduced from 250ms to 100ms
        
      } catch (error) {
        console.error(`[OptimizationTasks] Error generating task on attempt ${attempts}:`, error);
        // Continue to next attempt on error
        await new Promise(res => setTimeout(res, 500)); // Brief delay on error
      }
    }

    console.log(`[OptimizationTasks] Task generation complete: ${createdTasks.length}/${TARGET_TASK_COUNT} tasks in ${attempts} attempts`);
    tasks = createdTasks;
    tasksTokenUsage = accumulatedUsage;
  }
  
  // Append universal preset tasks
  if (isFirstReport || forceTaskGeneration) {
    const priorityRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    const selectedPreset = [...PRESET_TASKS].sort((a, b) => {
      if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
      return a.id.localeCompare(b.id);
    });

    tasks = [...tasks, ...selectedPreset];
  }
  
  // Replace placeholders and call the model to generate the summary.
  const finalSummaryPrompt = replacePlaceholders(SUMMARY_PROMPT, fullTemplateContext);

  const { content: summaryText, usage: summaryUsage } = await generateChatCompletion(
    summaryModel,
    finalSummaryPrompt
  );
  
  if (!summaryText) {
    throw new Error('Failed to generate AI visibility summary text.');
  }
  
  return {
    tasks,
    summary: summaryText,
    tokenUsage: {
      promptTokens: tasksTokenUsage.promptTokens + summaryUsage.promptTokens,
      completionTokens: tasksTokenUsage.completionTokens + summaryUsage.completionTokens,
      totalTokens: tasksTokenUsage.totalTokens + summaryUsage.totalTokens
    }
  };
}

export async function persistOptimizationTasks(
  tasks: z.infer<typeof TaskSchema>[],
  runId: string,
  companyId: string,
  prisma: PrismaClient
): Promise<void> {
  if (tasks.length === 0) return;
  
  // Ensure idempotency by deleting any existing tasks for this run before creating new ones.
  await prisma.visibilityOptimizationTask.deleteMany({
    where: { reportRunId: runId },
  });
  
  // Deduplicate tasks in-memory to prevent unique constraint errors from the model itself
  const seenTaskIds = new Set<string>();
  const uniqueTasks = tasks.filter(task => {
    if (seenTaskIds.has(task.id)) {
      return false;
    } else {
      seenTaskIds.add(task.id);
      return true;
    }
  });

  if (uniqueTasks.length < tasks.length) {
    console.warn(`[Data Integrity] Removed ${tasks.length - uniqueTasks.length} duplicate task(s) for runId: ${runId}`);
  }

  await prisma.visibilityOptimizationTask.createMany({
    data: uniqueTasks.map(task => ({
      taskId: task.id,
      reportRunId: runId,
      companyId,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      impactMetric: task.impact_metric,
      dependencies: [],
    }))
  });
}

export async function getOptimizationTasks(
  companyId: string,
  prisma: PrismaClient
) {
  // Get the latest tasks for the company
  const latestReport = await prisma.reportRun.findFirst({
    where: { 
      companyId,
      status: 'COMPLETED',
      optimizationTasks: { some: {} }
    },
    include: {
      optimizationTasks: {
        orderBy: { taskId: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return latestReport?.optimizationTasks || [];
}

export async function toggleTaskCompletion(
  taskId: string,
  reportRunId: string,
  prisma: PrismaClient
) {
  const task = await prisma.visibilityOptimizationTask.findUnique({
    where: { 
      reportRunId_taskId: { reportRunId, taskId }
    }
  });
  
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  const newStatus = task.isCompleted ? 'NOT_STARTED' : 'COMPLETED';
  
  return prisma.visibilityOptimizationTask.update({
    where: { 
      reportRunId_taskId: { reportRunId, taskId }
    },
    data: {
      status: newStatus,
      isCompleted: !task.isCompleted,
      completedAt: !task.isCompleted ? new Date() : null
    }
  });
}

export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export async function updateTaskStatus(
  taskId: string,
  reportRunId: string,
  newStatus: TaskStatus,
  prisma: PrismaClient
) {
  const task = await prisma.visibilityOptimizationTask.findUnique({
    where: { 
      reportRunId_taskId: { reportRunId, taskId }
    }
  });
  
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  // Validate the new status
  if (!Object.values(TaskStatus).includes(newStatus)) {
    throw new Error(`Invalid task status: ${newStatus}`);
  }
  
  return prisma.visibilityOptimizationTask.update({
    where: { 
      reportRunId_taskId: { reportRunId, taskId }
    },
    data: {
      status: newStatus,
      isCompleted: newStatus === TaskStatus.COMPLETED,
      completedAt: newStatus === TaskStatus.COMPLETED ? new Date() : null
    }
  });
} 