/**
 * @file analytics.ts
 * @description Utility functions for analytics and data processing.
 * Provides analytics calculations, data formatting, and statistical analysis functions.
 *
 * @dependencies
 * - None (pure utility functions).
 *
 * @exports
 * - Various utility functions for analytics and data processing.
 */
// Google Analytics 4 implementation for Serplexity
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export const GA_TRACKING_ID = 'G-J5R6K4M5SR';

// Check if GA is available
const isGAAvailable = () => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

// Initialize Google Analytics (already loaded via HTML, just set user properties)
export const initGA = (userId?: string) => {
  if (!isGAAvailable()) return;

  // Set user ID if provided (for logged-in users)
  if (userId) {
    window.gtag('config', GA_TRACKING_ID, {
      user_id: userId,
    });
  }
};

// Track page views
export const trackPageView = (path: string, title?: string) => {
  if (!isGAAvailable()) return;
  
  window.gtag('event', 'page_view', {
    page_title: title || document.title,
    page_location: window.location.origin + path,
    page_path: path,
  });
};

// Track custom events
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (!isGAAvailable()) return;
  
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// Track user properties
export const setUserProperty = (property: string, value: string) => {
  if (!isGAAvailable()) return;
  
  window.gtag('set', { [property]: value });
};

// Track conversion events (for subscription tracking)
export const trackConversion = (eventName: string, value?: number, currency: string = 'USD') => {
  if (!isGAAvailable()) return;
  
  window.gtag('event', eventName, {
    currency: currency,
    value: value,
  });
};

// Serplexity-specific event tracking
export const trackSerplexityEvents = {
  // Authentication events
  login: (method: 'google' | 'email') => {
    trackEvent('login', 'auth', method);
    setUserProperty('login_method', method);
  },
  
  signup: (method: 'google' | 'email') => {
    trackEvent('sign_up', 'auth', method);
    setUserProperty('signup_method', method);
  },
  
  logout: () => trackEvent('logout', 'auth'),
  
  // Onboarding events
  companyOnboardingStarted: () => 
    trackEvent('onboarding_started', 'onboarding'),
  
  companyOnboardingCompleted: (industry: string) => {
    trackEvent('onboarding_completed', 'onboarding', industry);
    setUserProperty('company_industry', industry);
  },
  
  // Business events
  reportGenerated: (reportType: string = 'standard') => 
    trackEvent('report_generated', 'business', reportType),
  
  reportViewed: (reportId: string) => 
    trackEvent('report_viewed', 'engagement', reportId),
  
  dashboardViewed: (pageType: string = 'overview') => 
    trackEvent('dashboard_view', 'engagement', pageType),
  
  // Navigation events
  pageVisited: (pageName: string) => 
    trackEvent('page_visit', 'navigation', pageName),
  
  // Feature usage
  competitorAdded: (method: 'manual' | 'auto-generated' = 'manual') => 
    trackEvent('competitor_added', 'feature', method),
  
  competitorRemoved: () => 
    trackEvent('competitor_removed', 'feature'),
  
  optimizationTaskViewed: (taskType: string) => 
    trackEvent('optimization_viewed', 'feature', taskType),
  
  optimizationTaskCompleted: (taskType: string) => 
    trackEvent('optimization_completed', 'feature', taskType),
  
  // Subscription events
  subscriptionStarted: (plan: 'monthly' | 'annual', value: number) => {
    trackConversion('purchase', value);
    trackEvent('subscription_started', 'conversion', plan, value);
    setUserProperty('subscription_plan', plan);
  },
  
  paymentCompleted: (amount: number, plan: string) => {
    trackConversion('purchase', amount);
    trackEvent('payment_completed', 'conversion', plan, amount);
  },
  
  trialStarted: () => 
    trackEvent('trial_started', 'conversion'),
  
  // Engagement events
  searchPerformed: (searchType: string, _query?: string) => 
    trackEvent('search_performed', 'engagement', searchType),
  
  filterApplied: (filterType: string, filterValue: string) => 
    trackEvent('filter_applied', 'engagement', `${filterType}:${filterValue}`),
  
  exportAction: (exportType: string, dataType: string) => 
    trackEvent('data_exported', 'feature', `${exportType}:${dataType}`),
  
  // Time tracking
  timeOnPage: (pageName: string, seconds: number) => 
    trackEvent('time_on_page', 'engagement', pageName, seconds),
  
  sessionDuration: (seconds: number) => 
    trackEvent('session_duration', 'engagement', 'total', seconds),
  
  // Error tracking
  errorEncountered: (errorType: string, _errorMessage?: string) => 
    trackEvent('error_encountered', 'error', errorType),
  
  // Settings and configuration
  settingsUpdated: (settingType: string) => 
    trackEvent('settings_updated', 'configuration', settingType),
  
  profileUpdated: () => 
    trackEvent('profile_updated', 'configuration'),
  
  // Experimental features
  experimentalFeatureUsed: (featureName: string) => 
    trackEvent('experimental_feature', 'feature', featureName),
};