/**
 * @file dashboardService.ts
 * @description Service for managing dashboard data and analytics operations.
 * Provides dashboard metrics, analytics data, and performance tracking functionality.
 *
 * @dependencies
 * - ../lib/apiClient: For API communication.
 * - ../types/dashboard: For dashboard type definitions.
 *
 * @exports
 * - Various functions for dashboard data management.
 */
import { getLatestReport } from './reportService';
import { DashboardData, DashboardFilters, MODEL_CONFIGS } from '../types/dashboard';

export const getDashboardData = async (companyId: string, filters: Partial<DashboardFilters>): Promise<DashboardData | null> => {
  console.log(`[Dashboard] Fetching data for company ${companyId} with filters:`, filters);

  try {
    // The API now returns the complete, pre-computed data structure that matches what the frontend needs.
    // No transformation is needed here anymore. We just pass it through.
    const dashboardData = await getLatestReport(companyId, filters);
    
    console.log(`[Dashboard] Data received from API:`, dashboardData);

    if (!dashboardData) {
      console.log(`[Dashboard] No data returned from API.`);
      return null;
    }

    // 10x IMPROVEMENT: Handle degraded mode gracefully
    if (dashboardData._degradedMode) {
      console.warn(`[Dashboard] ⚠️  Degraded mode detected: ${dashboardData._reason}`);
      console.warn(`[Dashboard] Showing basic report data - some features may be limited`);
      
      // Still return the data - frontend can show warnings but remains functional
      return {
        ...dashboardData,
        _showDegradedWarning: true
      };
    }
    
    return dashboardData;

  } catch (error: unknown) {
    console.error(`[Dashboard] Error fetching data:`, error);
    
    interface AxiosError {
      response?: {
        status?: number;
      };
      status?: number;
      message?: string;
    }

    const isAxios404 = (err: unknown): boolean => {
      const axiosError = err as AxiosError;
      if (axiosError?.response?.status === 404) return true;
      if (axiosError?.status === 404) return true;
      if (typeof axiosError?.message === 'string' && axiosError.message.includes('404')) return true;
      if (typeof axiosError?.message === 'string' && axiosError.message.includes('No completed report')) return true;
      return false;
    };

    if (isAxios404(error)) {
      console.log('No report data found for company (404), returning null for welcome prompt.');
      return null;
    }
    
    console.error('Dashboard data fetch failed with a non-404 error:', error);
    throw error;
  }
};

/**
 * Fetch dashboard data for all individual AI models (excluding 'all')
 * Uses the existing dashboard infrastructure for consistency
 */
export const getAllModelsData = async (companyId: string, filters: Omit<DashboardFilters, 'aiModel'>): Promise<DashboardData[]> => {
  console.log(`[Dashboard] Fetching model comparison data for company ${companyId}`);

  try {
    // Get all individual model IDs (excluding 'all')
    const modelIds = Object.keys(MODEL_CONFIGS);
    
    // Fetch data for each model in parallel using existing infrastructure
    const modelDataPromises = modelIds.map(async (modelId) => {
      try {
        const data = await getLatestReport(companyId, { ...filters, aiModel: modelId as DashboardFilters['aiModel'] });
        if (data) {
          // Ensure aiModel is set on the returned data
          data.aiModel = modelId;
        }
        return data;
      } catch (error) {
        console.warn(`[Dashboard] Failed to fetch data for model ${modelId}:`, error);
        return null;
      }
    });

    const results = await Promise.all(modelDataPromises);
    
    // Filter out null results (models with no data)
    const validResults = results.filter((data): data is DashboardData => data !== null);
    
    console.log(`[Dashboard] Successfully fetched data for ${validResults.length}/${modelIds.length} models`);
    
    return validResults;

  } catch (error) {
    console.error(`[Dashboard] Error fetching model comparison data:`, error);
    throw error;
  }
}; 