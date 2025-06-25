import React, { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import { generateCompetitors } from '../services/companyService';
import WelcomePrompt from '../components/ui/WelcomePrompt';

const BenchmarkResultsPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { data, refreshData } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  // Check if we have data to show
  const hasExistingData = data && Object.keys(data).length > 0;

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
    setGenerationStatus('Analyzing competitor landscape...');
    try {
      // Step 1: Generate competitors
      const exampleCompetitor = selectedCompany.competitors[0]?.name;
      if (!exampleCompetitor) {
        setGenerationStatus('Error: Add one competitor to seed the list.');
        setIsGenerating(false);
        return;
      }

      await generateCompetitors(selectedCompany.id, exampleCompetitor);

      // Step 2: Trigger report generation
      setGenerationStatus('Initializing report generation pipeline...');
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
      {!hasExistingData ? (
        <WelcomePrompt
          onGenerateReport={handleGenerateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
        />
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