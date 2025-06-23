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

export const CompanyProvider: React.FC<CompanyProviderProps> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const currentSelectedId = selectedCompany?.id;
        const updatedSelected = currentSelectedId ? newCompanies.find(c => c.id === currentSelectedId) : null;
        setSelectedCompany(updatedSelected || newCompanies[0]);
      } else {
        setSelectedCompany(null);
      }

    } catch (err) {
      const apiErr = err as ApiError;
      console.error('Failed to fetch companies:', apiErr);
      setError(apiErr.response?.data?.error || 'Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, authLoading, user]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (user?.companies) {
      const userCompanies = user.companies;
      // Only update local state if we don't already have companies
      // This prevents overriding locally created companies before the user object is updated
      setCompanies(prev => prev.length === 0 ? userCompanies : prev);
      if (userCompanies.length > 0 && !selectedCompany) {
        setSelectedCompany(userCompanies[0]);
      } else if (userCompanies.length === 0 && companies.length === 0) {
        setSelectedCompany(null);
      }
    } else {
      // Only clear companies if we're sure the user has no companies
      setCompanies(prev => prev.length === 0 ? [] : prev);
      setSelectedCompany(null);
    }
    setLoading(false);
  }, [user, authLoading, selectedCompany, companies.length]);

  const createCompany = useCallback(async (data: CompanyFormData): Promise<Company> => {
    try {
      setError(null);
      const response = await apiClient.post<{ company: Company }>('/companies', data);
      const { company } = response.data;
      
      setCompanies(prev => [company, ...prev]);
      setSelectedCompany(company);
      
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
  }, []);

  const updateCompany = useCallback(async (id: string, data: Partial<CompanyFormData>): Promise<Company> => {
    try {
      setError(null);
      const response = await apiClient.put<{ company: Company }>(`/companies/${id}`, data);
      const { company } = response.data;
      
      setCompanies(prev => prev.map(c => c.id === id ? company : c));
      
      if (selectedCompany?.id === id) {
        setSelectedCompany(company);
      }
      
      return company;
    } catch (err) {
      const apiErr = err as ApiError;
      const errorMessage = apiErr.response?.data?.error || 'Failed to update company';
      setError(errorMessage);
      throw apiErr;
    }
  }, [selectedCompany]);

  const deleteCompany = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await apiClient.delete(`/companies/${id}`);
      
      const remainingCompanies = companies.filter(c => c.id !== id);
      setCompanies(remainingCompanies);
      
      if (selectedCompany?.id === id) {
        setSelectedCompany(remainingCompanies.length > 0 ? remainingCompanies[0] : null);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      const errorMessage = apiErr.response?.data?.error || 'Failed to delete company';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [selectedCompany, companies]);

  const selectCompany = useCallback((company: Company | null) => {
    setSelectedCompany(company);
  }, []);

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