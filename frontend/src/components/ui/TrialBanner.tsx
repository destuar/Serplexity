/**
 * @file TrialBanner.tsx
 * @description Banner component to show trial status and encourage upgrades
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

const TrialBanner: React.FC = () => {
  const { user } = useAuth();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchTrialStatus = async () => {
      if (!user) return;

      try {
        const response = await apiClient.get('/users/me/trial-status');
        setTrialStatus(response.data);
      } catch (error) {
        console.error('Failed to fetch trial status:', error);
      }
    };

    fetchTrialStatus();
  }, [user]);

  if (!trialStatus || dismissed || trialStatus.isAdmin || trialStatus.subscriptionStatus === 'active') {
    return null;
  }

  // Show banner for trialing users or expired trial users
  const showBanner = trialStatus.isTrialing || trialStatus.trialExpired;
  if (!showBanner) return null;

  const isExpired = trialStatus.trialExpired;
  const daysLeft = trialStatus.daysRemaining;

  return (
    <div className="relative bg-white border-gray-200 border-b px-4 py-4">
      <div className="max-w-7xl mx-auto">
        {/* Centered text - responsive padding */}
        <div className="text-center pl-0 sm:pl-16 lg:pl-32 pr-24 sm:pr-32 lg:pr-48">
          <p className="text-sm font-medium text-gray-900">
            {isExpired ? (
              <>
                <strong>Free Trial Expired</strong> - You can still access your dashboard data, but future reports will no longer update.
              </>
            ) : (
              <>
                <strong>Free Trial Active</strong> - {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining with full access to all features.
              </>
            )}
          </p>
        </div>
        
        {/* Right-aligned buttons - responsive positioning */}
        <div className="absolute top-1/2 right-2 sm:right-4 transform -translate-y-1/2 flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={() => window.location.href = '/payment'}
            className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md bg-gray-900 hover:bg-black text-white transition-colors whitespace-nowrap"
          >
            <span className="hidden sm:inline">Upgrade to Pro</span>
            <span className="sm:hidden">Upgrade</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;