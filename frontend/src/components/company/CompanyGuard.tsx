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
    // Don't redirect if still loading or already on onboarding page
    if (loading || location.pathname === '/onboarding') {
      return;
    }

    // Redirect to onboarding if user has no companies
    if (!hasCompanies) {
      navigate('/onboarding', { replace: true });
    }
  }, [hasCompanies, loading, navigate, location.pathname]);

  // Show loading state while checking companies
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  // If on onboarding page or user has companies, render children
  if (location.pathname === '/onboarding' || hasCompanies) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
};

export default CompanyGuard; 