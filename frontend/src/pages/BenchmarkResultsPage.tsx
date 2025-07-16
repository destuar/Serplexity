/**
 * @file BenchmarkResultsPage.tsx
 * @description Benchmark results page for viewing and analyzing benchmark performance data.
 * Provides benchmark comparisons, performance metrics, and competitive analysis.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - lucide-react: For icons.
 *
 * @exports
 * - BenchmarkResultsPage: The main benchmark results page component.
 */
import React from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { useReportGeneration } from '../hooks/useReportGeneration';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';

const BenchmarkResultsPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { data, loading, hasReport } = useDashboard();
  const { 
    isGenerating, 
    generationStatus, 
    progress, 
    generateReport, 
    isButtonDisabled, 
    generationState, 
    completionState 
  } = useReportGeneration(selectedCompany);

  return (
    <div className="h-full flex flex-col">
      {loading || hasReport === null ? (
        <BlankLoadingState message="Loading benchmark results..." />
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={generateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
          progress={progress}
          isButtonDisabled={isButtonDisabled}
          generationState={generationState}
          completionState={completionState}
        />
      ) : !data || Object.keys(data).length === 0 ? (
        <BlankLoadingState message="Processing benchmark data..." />
      ) : (
        <div className="p-4">
          <h1 className="text-2xl font-bold">Benchmark Results</h1>
          <p>This page is under construction.</p>
        </div>
      )}
    </div>
  );
};

export default BenchmarkResultsPage; 