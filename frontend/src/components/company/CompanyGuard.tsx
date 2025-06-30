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