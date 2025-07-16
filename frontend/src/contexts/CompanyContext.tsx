/**
 * @file CompanyContext.tsx
 * @description React context for managing company data and settings throughout the application.
 * Provides company information, logo management, and company-related state management.
 *
 * @dependencies
 * - react: For context creation and state management.
 * - ../services/companyService: For company-related API calls.
 * - ../lib/logoService: For logo management functionality.
 *
 * @exports
 * - CompanyContext: The company context.
 * - CompanyProvider: Provider component for company state.
 * - useCompany: Hook for accessing company context.
 */
import React, { useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import apiClient from '../lib/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Company } from '../types/schemas';
import { CompanyContext, CompanyFormData } from '../hooks/useCompany';

interface ApiError {
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
  message: string;
}

interface CompanyProviderProps {
  children: ReactNode;
}

// Key for localStorage
const SELECTED_COMPANY_KEY = 'selectedCompanyId';

export const CompanyProvider: React.FC<CompanyProviderProps> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to get stored company ID
  const getStoredCompanyId = useCallback((): string | null => {
    try {
      return localStorage.getItem(SELECTED_COMPANY_KEY);
    } catch {
      return null;
    }
  }, []);

  // Helper function to store company ID
  const storeCompanyId = useCallback((companyId: string | null): void => {
    try {
      if (companyId) {
        localStorage.setItem(SELECTED_COMPANY_KEY, companyId);
      } else {
        localStorage.removeItem(SELECTED_COMPANY_KEY);
      }
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    if (authLoading || !user) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ companies: Company[] }>('/companies');
      const newCompanies = response.data.companies;
      setCompanies(newCompanies);
      
      if (newCompanies.length > 0) {
        // Try to restore the previously selected company
        const storedCompanyId = getStoredCompanyId();
        let companyToSelect: Company | null = null;

        if (storedCompanyId) {
          // Try to find the stored company
          companyToSelect = newCompanies.find(c => c.id === storedCompanyId) || null;
        }

        // If no stored company or stored company not found, default to first company
        if (!companyToSelect) {
          companyToSelect = newCompanies[0];
        }

        setSelectedCompany(companyToSelect);
        // Ensure the localStorage is updated with the actual selected company
        if (companyToSelect) {
          storeCompanyId(companyToSelect.id);
        }
      } else {
        setSelectedCompany(null);
        storeCompanyId(null);
      }

    } catch (err) {
      const apiErr = err as ApiError;
      console.error('Failed to fetch companies:', apiErr);
      setError(apiErr.response?.data?.error || 'Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, getStoredCompanyId, storeCompanyId]);

  useEffect(() => {
    if (user && !authLoading) {
      fetchCompanies();
    } else if (!authLoading) {
      // User is not logged in, clear all company data
      setCompanies([]);
      setSelectedCompany(null);
      storeCompanyId(null);
      setLoading(false);
    }
  }, [user, authLoading, fetchCompanies, storeCompanyId]);

  const createCompany = useCallback(async (data: CompanyFormData): Promise<Company> => {
    try {
      setError(null);
      const response = await apiClient.post<{ company: Company }>('/companies', data);
      const { company } = response.data;
      
      setCompanies(prev => [company, ...prev]);
      setSelectedCompany(company);
      storeCompanyId(company.id);
      
      return company;
    } catch (err) {
      const apiErr = err as ApiError;
      let errorMessage = 'Failed to create company';
      
      if (apiErr.response?.data?.error === 'Maximum company limit reached') {
        errorMessage = apiErr.response.data.message || 'You can only create up to 3 company profiles. Please delete an existing company to create a new one.';
      } else if (apiErr.response?.data?.error) {
        errorMessage = apiErr.response.data.error;
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [storeCompanyId]);

  const updateCompany = useCallback(async (id: string, data: Partial<CompanyFormData>): Promise<Company> => {
    try {
      setError(null);
      const response = await apiClient.put<{ company: Company }>(`/companies/${id}`, data);
      const { company } = response.data;
      
      setCompanies(prev => prev.map(c => c.id === id ? company : c));
      
      if (selectedCompany?.id === id) {
        setSelectedCompany(company);
        storeCompanyId(company.id);
      }
      
      return company;
    } catch (err) {
      const apiErr = err as ApiError;
      const errorMessage = apiErr.response?.data?.error || 'Failed to update company';
      setError(errorMessage);
      throw apiErr;
    }
  }, [selectedCompany, storeCompanyId]);

  const deleteCompany = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await apiClient.delete(`/companies/${id}`);
      
      const remainingCompanies = companies.filter(c => c.id !== id);
      setCompanies(remainingCompanies);
      
      if (selectedCompany?.id === id) {
        const newSelectedCompany = remainingCompanies.length > 0 ? remainingCompanies[0] : null;
        setSelectedCompany(newSelectedCompany);
        storeCompanyId(newSelectedCompany?.id || null);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      const errorMessage = apiErr.response?.data?.error || 'Failed to delete company';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [selectedCompany, companies, storeCompanyId]);

  const selectCompany = useCallback((company: Company | null) => {
    setSelectedCompany(company);
    storeCompanyId(company?.id || null);
  }, [storeCompanyId]);

  const maxCompanies = 3;

  const value = useMemo(() => ({
    companies,
    selectedCompany,
    loading,
    error,
    createCompany,
    updateCompany,
    deleteCompany,
    selectCompany,
    refreshCompanies: fetchCompanies,
    hasCompanies: companies.length > 0,
    canCreateMore: companies.length < maxCompanies,
    maxCompanies,
  }), [companies, selectedCompany, loading, error, createCompany, updateCompany, deleteCompany, selectCompany, fetchCompanies]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

// Re-export the useCompany hook and related types for convenience
// eslint-disable-next-line react-refresh/only-export-components
export { useCompany, type CompanyFormData } from '../hooks/useCompany';
export type { Company } from '../types/schemas'; 