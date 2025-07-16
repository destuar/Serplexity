/**
 * @file CompanyGuard.tsx
 * @description This component acts as a guard for routes, ensuring that the user has at least one company configured
 * before accessing certain parts of the application. If no companies are found, it redirects the user to the onboarding page.
 * It also handles cases where a user with companies might inadvertently land on the onboarding page, redirecting them to the dashboard.
 * This is crucial for guiding users through the initial setup process.
 *
 * @dependencies
 * - react: The core React library.
 * - react-router-dom: For navigation and routing (`useNavigate`, `useLocation`).
 * - ../../contexts/CompanyContext: Provides company-related data and state.
 * - ../ui/BlankLoadingState: A loading state component.
 *
 * @exports
 * - CompanyGuard: React functional component that guards routes based on company existence.
 */
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import BlankLoadingState from '../ui/BlankLoadingState';

interface CompanyGuardProps {
  children: React.ReactNode;
}

/**
 * CompanyGuard component that redirects users to onboarding
 * if they don't have any companies (except when already on onboarding page)
 */
const CompanyGuard: React.FC<CompanyGuardProps> = ({ children }) => {
  const { hasCompanies, loading } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) {
      return; // Do nothing while company data is loading
    }

    const isOnboarding = location.pathname === '/onboarding';

    // Case 1: User has no companies and is not on the onboarding page.
    if (!hasCompanies && !isOnboarding) {
      console.log('CompanyGuard: No companies, redirecting to onboarding');
      navigate('/onboarding', { replace: true });
    }

    // Case 2: User has companies but somehow landed on the onboarding page.
    if (hasCompanies && isOnboarding) {
      console.log('CompanyGuard: Has companies, redirecting to overview');
      navigate('/overview', { replace: true });
    }
  }, [hasCompanies, loading, navigate, location.pathname]);

  // While loading, or if a redirect is imminent, show a loading screen.
  // This prevents rendering a page that the user will be navigated away from.
  if (loading || (!hasCompanies && location.pathname !== '/onboarding') || (hasCompanies && location.pathname === '/onboarding')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <BlankLoadingState message="Loading dashboard data..." />
      </div>
    );
  }

  // If we've passed the checks, the user is in the right place.
  return <>{children}</>;
};

export default CompanyGuard; 