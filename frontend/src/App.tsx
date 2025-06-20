import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CompanyProvider } from './contexts/CompanyContext';
import { DashboardProvider } from './contexts/DashboardContext';
import CompanyGuard from './components/company/CompanyGuard';
import PaymentGuard from './components/auth/PaymentGuard';
import DashboardLayout from './components/layout/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import AIRankingsPage from './pages/AIRankingsPage';
import TagAnalysisPage from './pages/TagAnalysisPage';
import SentimentAnalysisPage from './pages/SentimentAnalysisPage';
import ConceptsAnalysisPage from './pages/ConceptsAnalysisPage';
import SourceAnalysisPage from './pages/SourceAnalysisPage';
import CompetitorRankingsPage from './pages/CompetitorRankingsPage';
import ModelComparisonPage from './pages/ModelComparisonPage';
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
  <DashboardProvider>
    <DashboardLayout>
      <Routes>
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/ai-rankings" element={<AIRankingsPage />} />
        <Route path="/tag-analysis" element={<TagAnalysisPage />} />
        <Route path="/sentiment-analysis" element={<SentimentAnalysisPage />} />
        <Route path="/concepts-analysis" element={<ConceptsAnalysisPage />} />
        <Route path="/source-analysis" element={<SourceAnalysisPage />} />
        <Route path="/competitor-rankings" element={<CompetitorRankingsPage />} />
        <Route path="/model-comparison" element={<ModelComparisonPage />} />
      </Routes>
    </DashboardLayout>
  </DashboardProvider>
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
              <DashboardRoutes />
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
