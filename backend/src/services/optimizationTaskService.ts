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
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { z } from "zod";
// NOTE: LLM imports removed - now using hardcoded preset tasks

// NOTE: Now using hardcoded preset tasks for reliability and consistency

interface PresetTask {
  id: string;
  title: string;
  description: string;
  category:
    | "Technical SEO"
    | "Content & Messaging"
    | "Brand Positioning"
    | "Link Building"
    | "Local SEO";
  priority: "High" | "Medium" | "Low";
  impact_metric: "inclusionRate" | "averagePosition" | "visibility";
}

// DEPRECATED: Hardcoded preset visibility tasks have been removed.
// Keeping the export for backward compatibility, but empty to disable auto-seeding.
export const PRESET_TASKS: PresetTask[] = [];

export enum TaskStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export const TASK_CATEGORIES = {
  "Technical SEO": "Technical SEO",
  "Content & Messaging": "Content & Messaging",
  "Brand Positioning": "Brand Positioning",
  "Link Building": "Link Building",
  "Local SEO": "Local SEO",
} as const;

export type TaskCategory = keyof typeof TASK_CATEGORIES;

const TaskPriorityEnum = z.enum(["High", "Medium", "Low"]);
const TaskCategoryEnum = z.enum([
  "Technical SEO",
  "Content & Messaging",
  "Brand Positioning",
  "Link Building",
  "Local SEO",
]);
const ImpactMetricEnum = z.enum([
  "visibility",
  "averagePosition",
  "inclusionRate",
]);

const __TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(1000),
  category: TaskCategoryEnum,
  priority: TaskPriorityEnum,
  impact_metric: ImpactMetricEnum,
});

export interface OptimizationTasksResult {
  tasks: z.infer<typeof __TaskSchema>[];
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
  _forceTaskGeneration: boolean = false
): Promise<OptimizationTasksResult> {
  // DEPRECATED: This function should not be used - throw explicit error
  throw new Error(
    "DEPRECATED: generateOptimizationTasksAndSummary has been replaced by hardcoded preset tasks. " +
      "Use the preset tasks directly in reportWorker.ts instead. " +
      "See reportWorker.ts for the current implementation pattern."
  );
}

// ===== TASK PERSISTENCE FUNCTIONS (STILL USED) =====

export async function persistOptimizationTasks(
  tasks: z.infer<typeof __TaskSchema>[],
  runId: string,
  companyId: string,
  prisma: PrismaClient
): Promise<void> {
  const optimizationTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    impact_metric: task.impact_metric,
    status: TaskStatus.NOT_STARTED,
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

export async function getOptimizationTasks(
  companyId: string,
  prisma: PrismaClient
) {
  return prisma.visibilityOptimizationTask.findMany({
    where: { companyId },
    orderBy: [
      { priority: "asc" }, // High priority first (enum ordering)
      { createdAt: "desc" },
    ],
  });
}

export async function toggleTaskCompletion(
  taskId: string,
  prisma: PrismaClient
) {
  const task = await prisma.visibilityOptimizationTask.findFirst({
    where: { taskId },
  });
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const newStatus =
    task.status === TaskStatus.COMPLETED
      ? TaskStatus.NOT_STARTED
      : TaskStatus.COMPLETED;

  return prisma.visibilityOptimizationTask.update({
    where: { id: task.id },
    data: {
      status: newStatus,
      completedAt: newStatus === TaskStatus.COMPLETED ? new Date() : null,
    },
  });
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  prisma: PrismaClient
) {
  const task = await prisma.visibilityOptimizationTask.findFirst({
    where: { taskId },
  });
  if (!task) throw new Error(`Task not found: ${taskId}`);

  return prisma.visibilityOptimizationTask.update({
    where: { id: task.id },
    data: {
      status,
      completedAt: status === TaskStatus.COMPLETED ? new Date() : null,
    },
  });
}

export async function createOptimizationTask(
  params: {
    companyId: string;
    reportRunId?: string;
    title: string;
    description: string;
    category: string;
    priority: "High" | "Medium" | "Low";
    impactMetric: "visibility" | "averagePosition" | "inclusionRate";
    dependencies?: string[];
  },
  prisma: PrismaClient
) {
  const {
    companyId,
    reportRunId,
    title,
    description,
    category,
    priority,
    impactMetric,
    dependencies = [],
  } = params;

  let targetRunId = reportRunId;
  if (!targetRunId) {
    // Prefer the most recent COMPLETED report so tasks appear in dashboard latest report data
    const latestCompleted = await prisma.reportRun.findFirst({
      where: { companyId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });
    if (latestCompleted) {
      targetRunId = latestCompleted.id;
    } else {
      // Fallback to most recent run of any status
      const latestAny = await prisma.reportRun.findFirst({
        where: { companyId },
        orderBy: { createdAt: "desc" },
      });
      if (latestAny) {
        targetRunId = latestAny.id;
      } else {
        // As a last resort, create a manual run container
        const created = await prisma.reportRun.create({
          data: {
            companyId,
            status: "manual",
          },
        });
        targetRunId = created.id;
      }
    }
  }

  const taskId = `WA-${randomUUID()}`;

  const createdTask = await prisma.visibilityOptimizationTask.create({
    data: {
      taskId,
      reportRunId: targetRunId!,
      companyId,
      title,
      description,
      category,
      priority,
      impactMetric,
      dependencies: dependencies as unknown as object,
      status: TaskStatus.NOT_STARTED,
    },
  });

  return createdTask;
}
