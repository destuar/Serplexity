import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CompanyProvider } from './contexts/CompanyContext';
import { DashboardProvider } from './contexts/DashboardContext';
import CompanyGuard from './components/company/CompanyGuard';
import PaymentGuard from './components/auth/PaymentGuard';
import DashboardLayout from './components/layout/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import BenchmarkResultsPage from './pages/BenchmarkResultsPage';
import VisibilityReportPage from './pages/VisibilityReportPage';
import SentimentAnalysisPage from './pages/SentimentAnalysisPage';
import ResponseDetailsPage from './pages/ResponseDetailsPage';
import CompetitorRankingsPage from './pages/CompetitorRankingsPage';
import ModelComparisonPage from './pages/ModelComparisonPage';
import JsonTranslationToolPage from './pages/JsonTranslationToolPage';
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

const DashboardRoutes: React.FC = () => (
  <DashboardLayout>
    <Routes>
      <Route path="/overview" element={<OverviewPage />} />
      <Route path="/benchmark-results" element={<BenchmarkResultsPage />} />
      <Route path="/visibility-report" element={<VisibilityReportPage />} />
      <Route path="/sentiment-analysis" element={<SentimentAnalysisPage />} />
      <Route path="/response-details" element={<ResponseDetailsPage />} />
      <Route path="/competitor-rankings" element={<CompetitorRankingsPage />} />
      <Route path="/model-comparison" element={<ModelComparisonPage />} />
      <Route path="/json-translation-tool" element={<JsonTranslationToolPage />} />
      <Route path="/ai-optimization-tool" element={<AiOptimizationToolPage />} />
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

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;
