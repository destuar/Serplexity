import React, { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';

const BenchmarkResultsPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { data, refreshData, loading, hasReport } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  // Remove old hasExistingData logic - now using hasReport from context

  // Handle report generation polling
  useEffect(() => {
    if (!isGenerating || !runId) {
      return;
    }

    const poll = setInterval(async () => {
      try {
        const statusRes = await getReportStatus(runId);
        
        // Keep the original stepStatus for percentage extraction
        setGenerationStatus(statusRes.stepStatus || 'Processing data...');
        
        if (statusRes.status === 'COMPLETED' || statusRes.status === 'FAILED') {
          setIsGenerating(false);
          setRunId(null);
          setGenerationStatus(statusRes.status === 'COMPLETED' ? 'Report generated successfully' : 'Report generation failed');
          if (statusRes.status === 'COMPLETED') {
            // Refresh the dashboard data
            await refreshData();
          }
        }
      } catch (pollError) {
        console.error("Status polling failed:", pollError);
        setIsGenerating(false);
        setRunId(null);
        setGenerationStatus('Connection error during generation');
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [isGenerating, runId, refreshData]);

  const handleGenerateReport = async () => {
    if (!selectedCompany) return;

    setIsGenerating(true);
    setGenerationStatus('Initializing report generation pipeline...');
    try {
      const { runId: newRunId } = await triggerReportGeneration(selectedCompany.id);
      setRunId(newRunId);
    } catch (error) {
        console.error("Failed to start report generation:", error);
        setIsGenerating(false);
        setGenerationStatus('Failed to start report generation.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {loading || hasReport === null ? (
        <BlankLoadingState message="Loading benchmark results..." />
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={handleGenerateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
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