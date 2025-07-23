/**
 * @file FreemiumGuard.tsx
 * @description Component to handle freemium access control with trial management
 * Shows trial status and restricts access to premium features after trial expires
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../lib/apiClient';

interface TrialStatus {
  subscriptionStatus: string | null;
  isTrialing: boolean;
  trialExpired: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
  hasFullAccess: boolean;
  canModifyPrompts: boolean;
  canCreateReports: boolean;
  maxActiveQuestions: number | null;
  isAdmin: boolean;
}

interface FreemiumGuardProps {
  children: React.ReactNode;
  feature?: 'prompts' | 'dashboard' | 'competitors' | 'reports';
  fallback?: React.ReactNode;
}

const FreemiumGuard: React.FC<FreemiumGuardProps> = ({ 
  children, 
  feature = 'dashboard',
  fallback 
}) => {
  const { user, isLoading } = useAuth();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    const fetchTrialStatus = async () => {
      if (!user) {
        setStatusLoading(false);
        return;
      }

      try {
        const response = await apiClient.get('/api/users/me/trial-status');
        setTrialStatus(response.data);
      } catch (error) {
        console.error('Failed to fetch trial status:', error);
      } finally {
        setStatusLoading(false);
      }
    };

    fetchTrialStatus();
  }, [user]);

  if (isLoading || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !trialStatus) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Required</h2>
          <p className="text-gray-600">Please log in to access this feature.</p>
        </div>
      </div>
    );
  }

  // Check feature-specific access
  const hasAccess = (() => {
    switch (feature) {
      case 'prompts':
        return trialStatus.canModifyPrompts;
      case 'reports':
        return trialStatus.canCreateReports;
      case 'dashboard':
      case 'competitors':
      default:
        return true; // Always accessible
    }
  })();

  if (!hasAccess) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto text-center p-6 bg-white rounded-lg shadow-lg">
          <div className="mb-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {feature === 'prompts' ? 'Premium Feature' : 'Access Restricted'}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {trialStatus.trialExpired 
              ? `Your 7-day trial has expired. Subscribe to access ${feature} management.`
              : 'This feature requires an active subscription.'
            }
          </p>
          {trialStatus.trialExpired && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Good news!</strong> You can still view your dashboard and competitor data for free.
              </p>
            </div>
          )}
          <button 
            onClick={() => window.location.href = '/payment'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default FreemiumGuard;