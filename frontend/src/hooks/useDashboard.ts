/**
 * @file useDashboard.ts
 * @description Custom hook for accessing dashboard context and dashboard-related data.
 * Provides a convenient interface for dashboard functionality.
 *
 * @dependencies
 * - react: For context access.
 * - ../contexts/DashboardContext: For dashboard context.
 *
 * @exports
 * - useDashboard: Hook for dashboard functionality.
 */
import { createContext, useContext } from 'react';
import { DashboardData, DashboardFilters } from '../types/dashboard';
import { TopRankingQuestion, CompetitorData } from '../services/companyService';

export interface DashboardContextType {
  data: DashboardData | null;
  detailedQuestions: TopRankingQuestion[];
  acceptedCompetitors: CompetitorData[];
  filters: DashboardFilters;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refreshTrigger: number;
  updateFilters: (newFilters: Partial<DashboardFilters>) => void;
  refreshData: () => Promise<void>;
  lastUpdated: string | null;
  hasReport: boolean | null;
}

export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}; 