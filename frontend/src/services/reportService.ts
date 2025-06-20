import apiClient from '../lib/apiClient';
import { DashboardData, DashboardFilters } from '../types/dashboard';

interface TriggerReportResponse {
  message: string;
  runId: string;
}

/**
 * Triggers the generation of a new report for a given company.
 * @param companyId The ID of the company to generate the report for.
 * @returns An object containing the message and the runId of the report job.
 */
export const triggerReportGeneration = async (companyId: string): Promise<TriggerReportResponse> => {
  const { data } = await apiClient.post('/reports', { companyId });
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