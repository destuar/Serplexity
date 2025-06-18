import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import OverviewPage from './pages/OverviewPage';
import AIRankingsPage from './pages/AIRankingsPage';
import TagAnalysisPage from './pages/TagAnalysisPage';
import SentimentAnalysisPage from './pages/SentimentAnalysisPage';
import ConceptsAnalysisPage from './pages/ConceptsAnalysisPage';
import SourceAnalysisPage from './pages/SourceAnalysisPage';
import CompetitorRankingsPage from './pages/CompetitorRankingsPage';
import ModelComparisonPage from './pages/ModelComparisonPage';
import './App.css';

function App() {
  return (
    <Router>
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
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
    </Router>
  );
}

export default App;
