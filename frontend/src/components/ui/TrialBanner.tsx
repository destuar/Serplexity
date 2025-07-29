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
    <div className={`relative ${isExpired ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'} border-b px-4 py-3`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">

          <div className="flex-1">
            <p className={`text-sm font-medium ${isExpired ? 'text-red-800' : 'text-blue-800'}`}>
              {isExpired ? (
                <>
                  <strong>Trial Expired</strong> - You can still view your dashboard and competitors, but prompt management requires a subscription.
                </>
              ) : (
                <>
                  <strong>Free Trial Active</strong> - {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining with full access to all features.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.location.href = '/payment'}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              isExpired 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } transition-colors`}
          >
            {isExpired ? 'Subscribe Now' : 'Upgrade Early'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className={`p-1 rounded-md ${isExpired ? 'text-red-400 hover:text-red-600' : 'text-blue-400 hover:text-blue-600'}`}
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