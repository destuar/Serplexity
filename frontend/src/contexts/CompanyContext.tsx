import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import axios from 'axios';
import { z } from 'zod';

// API URL
const API_URL = '/api/companies';

// Company and Competitor schemas
const CompetitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  companyId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  userId: z.string(),
  competitors: z.array(CompetitorSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

type Company = z.infer<typeof CompanySchema>;
type Competitor = z.infer<typeof CompetitorSchema>;

// Company creation form data
interface CompanyFormData {
  name: string;
  website?: string;
  industry: string;
  competitors: string[];
}

interface CompanyContextType {
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
}

interface CompanyProviderProps {
  children: ReactNode;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

// Create axios instance with auth interceptor
const apiClient = axios.create({
  baseURL: API_URL,
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const CompanyProvider: React.FC<CompanyProviderProps> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get companies from API
  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/');
      const { companies } = response.data;
      setCompanies(companies);
      
      // Auto-select the first company if none is selected and companies exist
      if (companies.length > 0 && !selectedCompany) {
        setSelectedCompany(companies[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch companies:', err);
      setError(err.response?.data?.error || 'Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  // Load companies on mount
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Create a new company
  const createCompany = useCallback(async (data: CompanyFormData): Promise<Company> => {
    try {
      setError(null);
      const response = await apiClient.post('/', data);
      const { company } = response.data;
      
      setCompanies(prev => [company, ...prev]);
      setSelectedCompany(company);
      
      return company;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to create company';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Update an existing company
  const updateCompany = useCallback(async (id: string, data: Partial<CompanyFormData>): Promise<Company> => {
    try {
      setError(null);
      const response = await apiClient.put(`/${id}`, data);
      const { company } = response.data;
      
      setCompanies(prev => prev.map(c => c.id === id ? company : c));
      
      // Update selected company if it's the one being updated
      if (selectedCompany?.id === id) {
        setSelectedCompany(company);
      }
      
      return company;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to update company';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [selectedCompany]);

  // Delete a company
  const deleteCompany = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await apiClient.delete(`/${id}`);
      
      setCompanies(prev => prev.filter(c => c.id !== id));
      
      // Clear selected company if it was deleted
      if (selectedCompany?.id === id) {
        const remainingCompanies = companies.filter(c => c.id !== id);
        setSelectedCompany(remainingCompanies.length > 0 ? remainingCompanies[0] : null);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to delete company';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [selectedCompany, companies]);

  // Select a company
  const selectCompany = useCallback((company: Company | null) => {
    setSelectedCompany(company);
  }, []);

  // Refresh companies
  const refreshCompanies = useCallback(async () => {
    await fetchCompanies();
  }, [fetchCompanies]);



  // Check if user has any companies
  const hasCompanies = companies.length > 0;

  const value = useMemo(() => ({
    companies,
    selectedCompany,
    loading,
    error,
    createCompany,
    updateCompany,
    deleteCompany,
    selectCompany,
    refreshCompanies,
    hasCompanies,
  }), [
    companies,
    selectedCompany,
    loading,
    error,
    createCompany,
    updateCompany,
    deleteCompany,
    selectCompany,
    refreshCompanies,
    hasCompanies,
  ]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

// Hook to use the CompanyContext
export const useCompany = (): CompanyContextType => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};

export type { Company, Competitor, CompanyFormData }; 