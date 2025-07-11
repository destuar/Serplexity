import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CompanyProvider } from './contexts/CompanyContext';
import { DashboardProvider } from './contexts/DashboardContext';
import CompanyGuard from './components/company/CompanyGuard';
import PaymentGuard from './components/auth/PaymentGuard';
import DashboardLayout from './components/layout/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import VisibilityReportPage from './pages/VisibilityReportPage';
import VisibilityTasksPage from './pages/VisibilityTasksPage';
import SentimentAnalysisPage from './pages/SentimentAnalysisPage';
import ResponseDetailsPage from './pages/ResponseDetailsPage';
import CompetitorRankingsPage from './pages/CompetitorRankingsPage';
import ModelComparisonPage from './pages/ModelComparisonPage';
import AiOptimizationToolPage from './pages/AiOptimizationToolPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import CompanyOnboardingPage from './pages/CompanyOnboardingPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import PaymentPage from './pages/PaymentPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import ExperimentalSearchPage from './pages/ExperimentalSearchPage';
import { usePageTracking, useSessionTracking } from './hooks/useAnalytics';

const DashboardRoutes: React.FC = () => (
  <DashboardLayout>
    <Routes>
      <Route path="/overview" element={<OverviewPage />} />
      <Route path="/progress-report" element={<VisibilityReportPage />} />
      <Route path="/visibility-tasks" element={<VisibilityTasksPage />} />
      <Route path="/sentiment-analysis" element={<SentimentAnalysisPage />} />
      <Route path="/response-details" element={<ResponseDetailsPage />} />
      <Route path="/competitor-rankings" element={<CompetitorRankingsPage />} />
      <Route path="/model-comparison" element={<ModelComparisonPage />} />
      <Route path="/ai-optimization-tool" element={<AiOptimizationToolPage />} />
      <Route path="/experimental-search" element={<ExperimentalSearchPage />} />
    </Routes>
  </DashboardLayout>
);

const ProtectedArea: React.FC = () => (
  <CompanyProvider>
    <CompanyGuard>
      <Routes>
        <Route path="/onboarding" element={<CompanyOnboardingPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route
          path="/*"
          element={
            <PaymentGuard>
              <DashboardProvider>
                <DashboardRoutes />
              </DashboardProvider>
            </PaymentGuard>
          }
        />
      </Routes>
    </CompanyGuard>
  </CompanyProvider>
);

const AnalyticsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
          <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<ProtectedArea />} />
          </Route>
        </Routes>
      </AnalyticsWrapper>
    </Router>
  );
}

export default App;
