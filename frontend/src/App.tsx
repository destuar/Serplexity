import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CompanyProvider } from './contexts/CompanyContext';
import { DashboardProvider } from './contexts/DashboardContext';
import CompanyGuard from './components/company/CompanyGuard';
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
import './App.css';

// Protected Routes Wrapper Component
const ProtectedRoutes: React.FC = () => {
  return (
    <CompanyProvider>
      <CompanyGuard>
        <DashboardProvider>
          <Routes>
            <Route path="/onboarding" element={<CompanyOnboardingPage />} />
            <Route path="/overview" element={
              <DashboardLayout>
                <OverviewPage />
              </DashboardLayout>
            } />
            <Route path="/ai-rankings" element={
              <DashboardLayout>
                <AIRankingsPage />
              </DashboardLayout>
            } />
            <Route path="/tag-analysis" element={
              <DashboardLayout>
                <TagAnalysisPage />
              </DashboardLayout>
            } />
            <Route path="/sentiment-analysis" element={
              <DashboardLayout>
                <SentimentAnalysisPage />
              </DashboardLayout>
            } />
            <Route path="/concepts-analysis" element={
              <DashboardLayout>
                <ConceptsAnalysisPage />
              </DashboardLayout>
            } />
            <Route path="/source-analysis" element={
              <DashboardLayout>
                <SourceAnalysisPage />
              </DashboardLayout>
            } />
            <Route path="/competitor-rankings" element={
              <DashboardLayout>
                <CompetitorRankingsPage />
              </DashboardLayout>
            } />
            <Route path="/model-comparison" element={
              <DashboardLayout>
                <ModelComparisonPage />
              </DashboardLayout>
            } />
          </Routes>
        </DashboardProvider>
      </CompanyGuard>
    </CompanyProvider>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/*" element={<ProtectedRoutes />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
