import { createContext, useContext } from 'react';
import { DashboardData, DashboardFilters } from '../types/dashboard';

export interface DashboardContextType {
  data: DashboardData | null;
  filters: DashboardFilters;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refreshTrigger: number;
  updateFilters: (newFilters: Partial<DashboardFilters>) => void;
  refreshData: () => Promise<void>;
  lastUpdated: string | null;
}

export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}; 