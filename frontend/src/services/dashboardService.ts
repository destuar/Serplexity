import { getLatestReport } from './reportService';
import { DashboardData, DashboardFilters } from '../types/dashboard';

export const getDashboardData = async (companyId: string, filters: Partial<DashboardFilters>): Promise<DashboardData | null> => {
  console.log(`[Dashboard] Fetching consolidated data for company ${companyId} with filters:`, filters);

  try {
    const dashboardData = await getLatestReport(companyId, filters);
    console.log(`[Dashboard] Consolidated data received:`, dashboardData);
    console.log(`[Dashboard] Data type:`, typeof dashboardData);
    console.log(`[Dashboard] Data keys:`, dashboardData ? Object.keys(dashboardData) : 'null');
    console.log(`[Dashboard] Has metrics:`, dashboardData?.metrics?.length || 0);

    if (!dashboardData) {
      console.log(`[Dashboard] No data returned, showing welcome prompt`);
      return null;
    }
    
    return dashboardData;

  } catch (error: unknown) {
    console.error(`[Dashboard] Error fetching data:`, error);
    
    const isAxios404 = (err: any): boolean => {
      if (err?.response?.status === 404) return true;
      if (err?.status === 404) return true;
      if (typeof err?.message === 'string' && err.message.includes('404')) return true;
      if (typeof err?.message === 'string' && err.message.includes('No completed report')) return true;
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