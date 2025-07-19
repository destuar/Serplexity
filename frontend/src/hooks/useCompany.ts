/**
 * @file useCompany.ts
 * @description Custom hook for accessing company context and company-related data.
 * Provides a convenient interface for company-related functionality.
 *
 * @dependencies
 * - react: For context access.
 * - ../contexts/CompanyContext: For company context.
 *
 * @exports
 * - useCompany: Hook for company functionality.
 */
import { createContext, useContext } from 'react';
import { Company } from '../types/schemas';

// Company creation form data - simplified to only required fields
export interface CompanyFormData {
  name: string;
  website: string;
  industry: string;
}

export interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  loading: boolean;
  error: string | null;
  createCompany: (data: CompanyFormData) => Promise<Company>;
  updateCompany: (id: string, data: Partial<CompanyFormData>) => Promise<Company>;
  deleteCompany: (id: string) => Promise<void>;
  selectCompany: (company: Company | null) => void;
  refreshCompanies: () => Promise<void>;
  hasCompanies: boolean;
  canCreateMore: boolean;
  maxCompanies: number;
}

export const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const useCompany = (): CompanyContextType => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}; 