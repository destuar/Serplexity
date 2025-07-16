/**
 * @file MockDashboardLayout.tsx
 * @description This component provides a mock layout for the dashboard preview, simulating the main structure
 * of the application's dashboard including a sidebar and header. It also sets up a mock `CompanyContext`
 * to provide sample company data for the preview, and includes an `ErrorBoundary` for robust rendering.
 * This layout is essential for presenting a realistic dashboard experience on the landing page.
 *
 * @dependencies
 * - react: For core React functionalities, including `Component` for the ErrorBoundary.
 * - ./MockSidebar: Mock sidebar component for navigation within the preview.
 * - ./MockHeader: Mock header component for the top bar of the preview dashboard.
 * - ../../../hooks/useCompany: The actual `useCompany` hook and related types, used here to mock its context.
 * - ../../../types/schemas: Type definitions for `Company`.
 *
 * @exports
 * - MockDashboardLayout: The React functional component that provides the layout for the mock dashboard.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import MockSidebar from './MockSidebar';
import MockHeader from './MockHeader';
import { CompanyContext, CompanyFormData } from '../../../hooks/useCompany';
import { Company } from '../../../types/schemas';

// Mock Company Context value for the dashboard preview
const mockCompanyValue = {
  selectedCompany: {
    id: 'mock-company-id',
    name: 'Serplexity',
    website: 'https://serplexity.com',
    industry: 'Technology',
    userId: 'mock-user-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    competitors: [],
    benchmarkingQuestions: [],
    products: []
  },
  companies: [],
  loading: false,
  error: null,
  createCompany: (data: CompanyFormData): Promise<Company> => Promise.resolve({ ...data, id: 'new-mock-id', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: 'mock-user-id', competitors: [], benchmarkingQuestions: [], products: [] }),
  updateCompany: (id: string, data: Partial<CompanyFormData>): Promise<Company> => Promise.resolve({ id, name: 'Updated Serplexity', website: 'https://serplexity.com', industry: 'Tech', ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: 'mock-user-id', competitors: [], benchmarkingQuestions: [], products: [] }),
  deleteCompany: () => Promise.resolve(),
  selectCompany: () => {},
  refreshCompanies: () => Promise.resolve(),
  hasCompanies: true,
  canCreateMore: false,
  maxCompanies: 3,
};

interface MockDashboardLayoutProps {
  children: ReactNode;
  activePage: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Error Boundary for robust error handling
class MockDashboardErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Mock Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Dashboard Preview</h3>
            <p className="text-gray-600 max-w-md">
              This is a preview of our comprehensive analytics dashboard with real-time AI visibility tracking.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const MockDashboardLayout: React.FC<MockDashboardLayoutProps> = ({ children, activePage }) => {
  return (
    <CompanyContext.Provider value={mockCompanyValue}>
      <MockDashboardErrorBoundary>
        <div className="flex h-full w-full bg-gray-50 overflow-visible">
          <MockSidebar activePage={activePage} />
          <div className="flex flex-col flex-1 min-w-0 h-full">
            <MockHeader />
            <main className="flex-1 flex flex-col overflow-visible p-4 min-h-0">
              <div className="flex-1 min-h-0 overflow-visible flex flex-col">
                {children}
              </div>
            </main>
                     </div>
         </div>
       </MockDashboardErrorBoundary>
     </CompanyContext.Provider>
  );
};

export default React.memo(MockDashboardLayout);