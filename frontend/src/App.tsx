/**
 * @file App.tsx
 * @description This is the main application component, responsible for setting up the routing structure
 * and integrating various contexts and guards. It defines public routes, protected routes (requiring authentication),
 * and routes that further require company setup and payment. It also incorporates analytics tracking
 * for page views and user sessions.
 *
 * @dependencies
 * - react: The core React library.
 * - react-router-dom: For declarative routing in React applications.
 * - ./contexts/CompanyContext: Provides company-related data and state.
 * - ./contexts/DashboardContext: Provides dashboard-related data and state.
 * - ./components/company/CompanyGuard: Protects routes that require company setup.
 * - ./components/auth/PaymentGuard: Protects routes that require an active subscription.
 * - ./components/layout/DashboardLayout: Layout component for dashboard pages.
 * - ./pages/*: Various page components for different routes.
 * - ./components/auth/ProtectedRoute: Protects routes that require user authentication.
 * - ./hooks/useAnalytics: Custom hooks for analytics tracking.
 *
 * @exports
 * - App: The main React application component.
 */
import React from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import CompanyGuard from "./components/company/CompanyGuard";
import { DashboardProvider } from "./contexts/DashboardContext";
import { NavigationProvider } from "./contexts/NavigationContext";
import { PageCacheProvider } from "./contexts/PageCacheContext";
// PaymentGuard can be used for subscription-gated routes if needed
import DashboardLayout from "./components/layout/DashboardLayout";
import TrialBanner from "./components/ui/TrialBanner";
import OverviewPage from "./pages/OverviewPage";

import CompetitorsPage from "./pages/CompetitorsPage";
import PromptsPage from "./pages/PromptsPage";
import SeoAnalyticsPage from "./pages/SeoAnalyticsPage";
import VisibilityReportPage from "./pages/VisibilityReportPage";
import VisibilityTasksPage from "./pages/VisibilityTasksPage";
import WebAnalyticsPage from "./pages/WebAnalyticsPage";
import WebAuditPage from "./pages/WebAuditPage";

import ProtectedRoute from "./components/auth/ProtectedRoute";
import { usePageTracking, useSessionTracking } from "./hooks/useAnalytics";
import BillingPage from "./pages/BillingPage";
import BlogEditorPage from "./pages/BlogEditorPage";
import BlogPostPage from "./pages/BlogPostPage";
import CompanyOnboardingPage from "./pages/CompanyOnboardingPage";
import ExperimentalSearchPage from "./pages/ExperimentalSearchPage";
import GA4SetupPage from "./pages/GA4SetupPage";
import IntegrationErrorPage from "./pages/IntegrationErrorPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import PaymentPage from "./pages/PaymentPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import RegisterPage from "./pages/RegisterPage";
import ResearchPage from "./pages/ResearchPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";

const DashboardRoutes: React.FC = () => (
  <NavigationProvider>
    <div className="h-screen flex flex-col">
      <TrialBanner />
      <div className="flex-1 min-h-0">
        <DashboardLayout>
          <Routes>
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/dashboard" element={<OverviewPage />} />
            <Route path="/visibility-tasks" element={<VisibilityTasksPage />} />
            <Route
              path="/visibility-report"
              element={<VisibilityReportPage />}
            />
            <Route path="/web-audit" element={<WebAuditPage />} />
            <Route path="/web-analytics" element={<WebAnalyticsPage />} />
            {/* Canonical SEO Rankings route */}
            <Route path="/seo-rankings" element={<SeoAnalyticsPage />} />
            {/* Backward-compat alias for older links */}
            <Route
              path="/visibility-analytics"
              element={<SeoAnalyticsPage />}
            />
            <Route path="/response-details" element={<PromptsPage />} />
            <Route path="/prompts" element={<PromptsPage />} />
            <Route path="/competitors" element={<CompetitorsPage />} />

            <Route
              path="/experimental-search"
              element={<ExperimentalSearchPage />}
            />
            <Route path="/analytics/ga4-setup" element={<GA4SetupPage />} />
          </Routes>
        </DashboardLayout>
      </div>
    </div>
  </NavigationProvider>
);

const ProtectedArea: React.FC = () => (
  <CompanyGuard>
    <PageCacheProvider>
      <Routes>
        <Route path="/onboarding" element={<CompanyOnboardingPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route
          path="/*"
          element={
            <DashboardProvider>
              <DashboardRoutes />
            </DashboardProvider>
          }
        />
      </Routes>
    </PageCacheProvider>
  </CompanyGuard>
);

const AnalyticsWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  usePageTracking();
  useSessionTracking();
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <AnalyticsWrapper>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/research/new" element={<BlogEditorPage />} />
          <Route path="/research/edit/:id" element={<BlogEditorPage />} />
          <Route path="/research/:slug" element={<BlogPostPage />} />
          <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
          <Route
            path="/analytics/integration/error"
            element={<IntegrationErrorPage />}
          />
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<ProtectedArea />} />
          </Route>
        </Routes>
      </AnalyticsWrapper>
    </Router>
  );
}

export default App;
