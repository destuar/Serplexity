import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView, trackSerplexityEvents, initGA } from '../utils/analytics';
import { useAuth } from './useAuth';

// Hook to automatically track page views
export const usePageTracking = () => {
  const location = useLocation();
  const { user } = useAuth();
  const previousPath = useRef<string>('');
  const pageStartTime = useRef<number>(Date.now());

  useEffect(() => {
    // Initialize GA with user ID if logged in
    if (user?.id) {
      initGA(user.id);
    }

    // Track time on previous page
    if (previousPath.current) {
      const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);
      if (timeOnPage > 5) { // Only track if user spent more than 5 seconds
        trackSerplexityEvents.timeOnPage(previousPath.current, timeOnPage);
      }
    }

    // Track new page view
    const pageName = getPageName(location.pathname);
    trackPageView(location.pathname, pageName);
    trackSerplexityEvents.pageVisited(pageName);

    // Update references
    previousPath.current = pageName;
    pageStartTime.current = Date.now();
  }, [location, user]);
};

// Hook for tracking user events
export const useEventTracking = () => {
  return {
    trackLogin: (method: 'google' | 'email') => trackSerplexityEvents.login(method),
    trackSignup: (method: 'google' | 'email') => trackSerplexityEvents.signup(method),
    trackLogout: () => trackSerplexityEvents.logout(),
    trackReportGenerated: (type?: string) => trackSerplexityEvents.reportGenerated(type),
    trackDashboardView: (pageType?: string) => trackSerplexityEvents.dashboardViewed(pageType),
    trackCompetitorAdded: (method?: 'manual' | 'auto-generated') => trackSerplexityEvents.competitorAdded(method),
    trackSubscriptionStarted: (plan: 'monthly' | 'annual', value: number) => trackSerplexityEvents.subscriptionStarted(plan, value),
    trackPaymentCompleted: (amount: number, plan: string) => trackSerplexityEvents.paymentCompleted(amount, plan),
    trackOptimizationTask: (action: 'viewed' | 'completed', taskType: string) => {
      if (action === 'viewed') {
        trackSerplexityEvents.optimizationTaskViewed(taskType);
      } else {
        trackSerplexityEvents.optimizationTaskCompleted(taskType);
      }
    },
    trackSearchPerformed: (searchType: string, query?: string) => trackSerplexityEvents.searchPerformed(searchType, query),
    trackFilterApplied: (filterType: string, filterValue: string) => trackSerplexityEvents.filterApplied(filterType, filterValue),
    trackError: (errorType: string, errorMessage?: string) => trackSerplexityEvents.errorEncountered(errorType, errorMessage),
    trackExperimentalFeature: (featureName: string) => trackSerplexityEvents.experimentalFeatureUsed(featureName),
  };
};

// Hook for session duration tracking
export const useSessionTracking = () => {
  const sessionStartTime = useRef<number>(Date.now());

  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionDuration = Math.round((Date.now() - sessionStartTime.current) / 1000);
      if (sessionDuration > 30) { // Only track sessions longer than 30 seconds
        trackSerplexityEvents.sessionDuration(sessionDuration);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
};

// Helper function to get user-friendly page names
const getPageName = (pathname: string): string => {
  const pageMap: Record<string, string> = {
    '/': 'Landing Page',
    '/login': 'Login',
    '/register': 'Register',
    '/terms': 'Terms of Service',
    '/privacy': 'Privacy Policy',
    '/oauth-callback': 'OAuth Callback',
    '/onboarding': 'Company Onboarding',
    '/payment': 'Payment',
    '/overview': 'Dashboard Overview',
    '/progress-report': 'Visibility Report',
    '/visibility-tasks': 'Visibility Tasks',
    '/sentiment-analysis': 'Sentiment Analysis',
    '/response-details': 'Response Details',
    '/competitor-rankings': 'Competitor Rankings',
    '/model-comparison': 'Model Comparison',
    '/ai-optimization-tool': 'AI Optimization Tool',
    '/experimental-search': 'Experimental Search',
  };

  return pageMap[pathname] || pathname;
};