/**
 * @file reportService.ts
 * @description Service for managing report generation and report-related operations.
 * Provides report creation, data retrieval, and report management functionality.
 *
 * @dependencies
 * - ../lib/apiClient: For API communication.
 *
 * @exports
 * - Various functions for report management operations.
 */
import apiClient from '../lib/apiClient';
import { DashboardData, DashboardFilters } from '../types/dashboard';

interface TriggerReportResponse {
  message: string;
  runId: string;
  status?: string;
}

/**
 * Triggers the generation of a new report for a given company.
 * @param companyId The ID of the company to generate the report for.
 * @param force Optional flag to force generation even if one exists today.
 * @returns An object containing the message and the runId of the report job.
 */
export const triggerReportGeneration = async (companyId: string, force?: boolean): Promise<TriggerReportResponse> => {
  const params = force ? { force: 'true' } : {};
  const { data } = await apiClient.post(`/reports/companies/${companyId}`, {}, { params });
  return data;
};


interface ReportStatus {
    status: string;
    stepStatus: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * Fetches the status of a specific report run.
 * @param runId The ID of the report run to check.
 * @returns The status of the report.
 */
export const getReportStatus = async (runId: string): Promise<ReportStatus> => {
  const { data } = await apiClient.get(`/reports/${runId}/status`);
  return data;
};

/**
 * Fetches the latest report for a company, optionally applying filters.
 * @param companyId The ID of the company.
 * @param filters Optional filters for the report data.
 * @returns The latest dashboard data.
 */
export const getLatestReport = async (companyId: string, filters?: Partial<DashboardFilters>): Promise<DashboardData> => {
  const { data } = await apiClient.get(`/reports/latest/${companyId}`, { params: filters });
  return data;
};

export interface CompetitorRanking {
  id: string;
  name: string;
  website?: string;
  shareOfVoice: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'stable';
  isUserCompany: boolean;
}

export interface CompetitorRankingsResponse {
  competitors: CompetitorRanking[];
  chartCompetitors: CompetitorRanking[];
  industryRanking: number | null;
  userCompany: CompetitorRanking | null;
}

export const getCompetitorRankingsForReport = async (runId: string, companyId: string, aiModel?: string): Promise<CompetitorRankingsResponse> => {
  const { data } = await apiClient.get(`/reports/${runId}/competitor-rankings`, {
    params: { companyId, aiModel }
  });
  return data;
};



export interface ReportResponse {
  question: string;
  position: number;
  response: string;
  model: string;
}

export const getReportResponses = async (runId: string, companyId: string, aiModel?: string, page?: number, limit?: number): Promise<ReportResponse[]> => {
  const { data } = await apiClient.get(`/reports/${runId}/responses`, {
    params: { companyId, aiModel, page, limit }
  });
  return data;
};

// Optimization Tasks API
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface OptimizationTask {
  id: string;
  taskId: string;
  reportRunId: string;
  title: string;
  description: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  impactMetric: string;
  dependencies: string[];
  status: TaskStatus;
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const getOptimizationTasks = async (companyId: string): Promise<OptimizationTask[]> => {
  const { data } = await apiClient.get(`/reports/companies/${companyId}/optimization-tasks`);
  return data.tasks;
};

export const toggleTaskCompletion = async (reportRunId: string, taskId: string): Promise<OptimizationTask> => {
  const { data } = await apiClient.patch(`/reports/reports/${reportRunId}/tasks/${taskId}/toggle`);
  return data.task;
};

export const updateTaskStatus = async (reportRunId: string, taskId: string, status: TaskStatus): Promise<OptimizationTask> => {
  const { data } = await apiClient.patch(`/reports/reports/${reportRunId}/tasks/${taskId}/status`, { status });
  return data.task;
};

export const getVisibilitySummary = async (companyId: string): Promise<string | null> => {
  const { data } = await apiClient.get(`/reports/companies/${companyId}/visibility-summary`);
  return data.summary;
}; 