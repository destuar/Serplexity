import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { CompanyProvider, useCompany } from '../../contexts/CompanyContext';
import { AuthProvider } from '../../contexts/AuthContext';
import apiClient from '../../lib/apiClient';

// Mock the API client
vi.mock('../../lib/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: {
      headers: {
        common: {}
      }
    }
  }
}));

// Mock the useAuth hook directly
const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };
const mockAuthContext = {
  user: mockUser,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  loginWithGoogle: vi.fn(),
  handleOAuthToken: vi.fn(),
  updateUser: vi.fn(),
  error: null,
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockAuthContext,
}));

// Mock the AuthContext provider
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Test component to access company context
const TestComponent = () => {
  const { 
    companies, 
    selectedCompany, 
    loading, 
    error, 
    createCompany, 
    updateCompany, 
    deleteCompany, 
    selectCompany,
    hasCompanies,
    canCreateMore,
    maxCompanies
  } = useCompany();
  
  return (
    <div>
      <div data-testid="companies-count">{companies.length}</div>
      <div data-testid="selected-company">{selectedCompany?.name || 'none'}</div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="has-companies">{hasCompanies ? 'yes' : 'no'}</div>
      <div data-testid="can-create-more">{canCreateMore ? 'yes' : 'no'}</div>
      <div data-testid="max-companies">{maxCompanies}</div>
      <button onClick={() => createCompany({ 
        name: 'New Company', 
        website: 'https://example.com',
        industry: 'Technology',
        competitors: [],
        benchmarkingQuestions: [],
        products: []
      })}>
        Create Company
      </button>
      <button onClick={() => updateCompany('1', { name: 'Updated Company' })}>
        Update Company
      </button>
      <button onClick={() => deleteCompany('1')}>
        Delete Company
      </button>
      <button onClick={() => selectCompany(companies[0])}>
        Select First Company
      </button>
      <button onClick={() => selectCompany(null)}>
        Clear Selection
      </button>
    </div>
  );
};

// Wrapper component for testing
const TestWrapper = () => (
  <AuthProvider>
    <CompanyProvider>
      <TestComponent />
    </CompanyProvider>
  </AuthProvider>
);

describe('CompanyContext', () => {
  const mockApiClient = apiClient as typeof apiClient & {
    post: Mock;
    get: Mock;
    put: Mock;
    delete: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockImplementation(() => {});
    localStorageMock.removeItem.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with loading state and fetch companies', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company 1', website: 'https://company1.com' },
        { id: '2', name: 'Company 2', website: 'https://company2.com' }
      ];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      
      render(<TestWrapper />);
      
      expect(screen.getByTestId('loading').textContent).toBe('loading');
      expect(screen.getByTestId('companies-count').textContent).toBe('0');
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      expect(screen.getByTestId('companies-count').textContent).toBe('2');
      expect(screen.getByTestId('selected-company').textContent).toBe('Company 1');
      expect(screen.getByTestId('has-companies').textContent).toBe('yes');
      expect(screen.getByTestId('can-create-more').textContent).toBe('yes');
      expect(screen.getByTestId('max-companies').textContent).toBe('3');
    });

    it('should restore previously selected company from localStorage', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company 1', website: 'https://company1.com' },
        { id: '2', name: 'Company 2', website: 'https://company2.com' }
      ];
      
      localStorageMock.getItem.mockReturnValue('2');
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-company').textContent).toBe('Company 2');
      });
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('selectedCompanyId');
    });

    it('should handle empty companies list', async () => {
      mockApiClient.get.mockResolvedValue({ data: { companies: [] } });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      expect(screen.getByTestId('companies-count').textContent).toBe('0');
      expect(screen.getByTestId('selected-company').textContent).toBe('none');
      expect(screen.getByTestId('has-companies').textContent).toBe('no');
      expect(screen.getByTestId('can-create-more').textContent).toBe('yes');
    });

    it('should handle fetch companies error', async () => {
      mockApiClient.get.mockRejectedValue({ 
        response: { data: { error: 'Network error' } } 
      });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
        expect(screen.getByTestId('error').textContent).toBe('Network error');
      });
    });
  });

  describe('Create Company', () => {
    it('should successfully create a company', async () => {
      const mockCompanies = [{ id: '1', name: 'Existing Company', website: 'https://existing.com' }];
      const newCompany = { id: '2', name: 'New Company', website: 'https://example.com' };
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      mockApiClient.post.mockResolvedValue({ data: { company: newCompany } });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const createButton = screen.getByText('Create Company');
      
      await act(async () => {
        createButton.click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('companies-count').textContent).toBe('2');
        expect(screen.getByTestId('selected-company').textContent).toBe('New Company');
      });
      
      expect(mockApiClient.post).toHaveBeenCalledWith('/companies', {
        name: 'New Company',
        website: 'https://example.com',
        industry: 'Technology',
        competitors: [],
        benchmarkingQuestions: [],
        products: []
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('selectedCompanyId', '2');
    });

    it('should handle company creation error', async () => {
      const mockCompanies = [{ id: '1', name: 'Existing Company', website: 'https://existing.com' }];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      mockApiClient.post.mockRejectedValue({ 
        response: { data: { error: 'Company name already exists' } } 
      });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const createButton = screen.getByText('Create Company');
      
      await act(async () => {
        createButton.click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('Company name already exists');
      });
    });

    it('should handle maximum company limit error', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company 1', website: 'https://company1.com' },
        { id: '2', name: 'Company 2', website: 'https://company2.com' },
        { id: '3', name: 'Company 3', website: 'https://company3.com' }
      ];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      mockApiClient.post.mockRejectedValue({ 
        response: { 
          data: { 
            error: 'Maximum company limit reached',
            message: 'You can only create up to 3 company profiles.'
          } 
        } 
      });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
        expect(screen.getByTestId('can-create-more').textContent).toBe('no');
      });
      
      const createButton = screen.getByText('Create Company');
      
      await act(async () => {
        createButton.click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('You can only create up to 3 company profiles.');
      });
    });
  });

  describe('Update Company', () => {
    it('should successfully update a company', async () => {
      const mockCompanies = [{ id: '1', name: 'Original Company', website: 'https://original.com' }];
      const updatedCompany = { id: '1', name: 'Updated Company', website: 'https://updated.com' };
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      mockApiClient.put.mockResolvedValue({ data: { company: updatedCompany } });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const updateButton = screen.getByText('Update Company');
      
      await act(async () => {
        updateButton.click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-company').textContent).toBe('Updated Company');
      });
      
      expect(mockApiClient.put).toHaveBeenCalledWith('/companies/1', {
        name: 'Updated Company'
      });
    });

    it('should handle update error', async () => {
      const mockCompanies = [{ id: '1', name: 'Original Company', website: 'https://original.com' }];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      mockApiClient.put.mockRejectedValue({ 
        response: { data: { error: 'Company not found' } } 
      });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const updateButton = screen.getByText('Update Company');
      
      await act(async () => {
        updateButton.click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('Company not found');
      });
    });
  });

  describe('Delete Company', () => {
    it('should successfully delete a company', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company 1', website: 'https://company1.com' },
        { id: '2', name: 'Company 2', website: 'https://company2.com' }
      ];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      mockApiClient.delete.mockResolvedValue({});
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const deleteButton = screen.getByText('Delete Company');
      
      await act(async () => {
        deleteButton.click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('companies-count').textContent).toBe('1');
        expect(screen.getByTestId('selected-company').textContent).toBe('Company 2');
      });
      
      expect(mockApiClient.delete).toHaveBeenCalledWith('/companies/1');
    });

    it('should handle deleting the last company', async () => {
      const mockCompanies = [{ id: '1', name: 'Last Company', website: 'https://last.com' }];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      mockApiClient.delete.mockResolvedValue({});
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const deleteButton = screen.getByText('Delete Company');
      
      await act(async () => {
        deleteButton.click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('companies-count').textContent).toBe('0');
        expect(screen.getByTestId('selected-company').textContent).toBe('none');
        expect(screen.getByTestId('has-companies').textContent).toBe('no');
      });
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('selectedCompanyId');
    });

    it('should handle delete error', async () => {
      const mockCompanies = [{ id: '1', name: 'Company 1', website: 'https://company1.com' }];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      mockApiClient.delete.mockRejectedValue({ 
        response: { data: { error: 'Cannot delete company with active reports' } } 
      });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const deleteButton = screen.getByText('Delete Company');
      
      await act(async () => {
        deleteButton.click();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('error').textContent).toBe('Cannot delete company with active reports');
      });
    });
  });

  describe('Select Company', () => {
    it('should successfully select a company', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company 1', website: 'https://company1.com' },
        { id: '2', name: 'Company 2', website: 'https://company2.com' }
      ];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const selectButton = screen.getByText('Select First Company');
      
      await act(async () => {
        selectButton.click();
      });
      
      expect(screen.getByTestId('selected-company').textContent).toBe('Company 1');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('selectedCompanyId', '1');
    });

    it('should handle selecting null company', async () => {
      const mockCompanies = [{ id: '1', name: 'Company 1', website: 'https://company1.com' }];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      const clearButton = screen.getByText('Clear Selection');
      
      await act(async () => {
        clearButton.click();
      });
      
      expect(screen.getByTestId('selected-company').textContent).toBe('none');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('selectedCompanyId');
    });
  });

  describe('Company Limits', () => {
    it('should correctly calculate company limits', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company 1', website: 'https://company1.com' },
        { id: '2', name: 'Company 2', website: 'https://company2.com' }
      ];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      expect(screen.getByTestId('companies-count').textContent).toBe('2');
      expect(screen.getByTestId('can-create-more').textContent).toBe('yes');
      expect(screen.getByTestId('max-companies').textContent).toBe('3');
    });

    it('should prevent creating more companies when at limit', async () => {
      const mockCompanies = [
        { id: '1', name: 'Company 1', website: 'https://company1.com' },
        { id: '2', name: 'Company 2', website: 'https://company2.com' },
        { id: '3', name: 'Company 3', website: 'https://company3.com' }
      ];
      
      mockApiClient.get.mockResolvedValue({ data: { companies: mockCompanies } });
      
      render(<TestWrapper />);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('not-loading');
      });
      
      expect(screen.getByTestId('companies-count').textContent).toBe('3');
      expect(screen.getByTestId('can-create-more').textContent).toBe('no');
    });
  });
}); 