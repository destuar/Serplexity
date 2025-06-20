import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';

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
      navigate('/onboarding', { replace: true });
    }

    // Case 2: User has companies but somehow landed on the onboarding page.
    if (hasCompanies && isOnboarding) {
      navigate('/overview', { replace: true });
    }
  }, [hasCompanies, loading, navigate, location.pathname]);

  // While loading, or if a redirect is imminent, show a loading screen.
  // This prevents rendering a page that the user will be navigated away from.
  if (loading || (!hasCompanies && location.pathname !== '/onboarding') || (hasCompanies && location.pathname === '/onboarding')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  // If we've passed the checks, the user is in the right place.
  return <>{children}</>;
};

export default CompanyGuard; 