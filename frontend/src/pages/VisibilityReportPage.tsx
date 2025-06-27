import React, { useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import { triggerReportGeneration } from '../services/reportService';
import { generateCompetitors } from '../services/companyService';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';

const VisibilityReportPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { data, loading, hasReport } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  // Remove old hasExistingData logic - now using hasReport from context

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
      await triggerReportGeneration(selectedCompany.id);
    } catch (error) {
        console.error("Failed to start report generation:", error);
        setIsGenerating(false);
        setGenerationStatus('Failed to start report generation.');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {loading || hasReport === null ? (
        <BlankLoadingState message="Loading visibility report..." />
      ) : hasReport === false ? (
        <WelcomePrompt
          onGenerateReport={handleGenerateReport}
          isGenerating={isGenerating}
          generationStatus={generationStatus}
        />
      ) : !data || Object.keys(data).length === 0 ? (
        <BlankLoadingState message="Processing visibility data..." />
      ) : (
        <div className="p-4">
          <h1 className="text-2xl font-bold">Visibility Report</h1>
          <p>This page is under construction.</p>
        </div>
      )}
    </div>
  );
};

export default VisibilityReportPage; 