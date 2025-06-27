import { useState, useEffect } from 'react';
import { useDashboard } from './useDashboard';
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import { generateCompetitors } from '../services/companyService';
import { Company } from '../types/schemas';

export const useReportGeneration = (selectedCompany: Company | null) => {
  const { refreshData } = useDashboard();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!isGenerating || !runId) {
      return;
    }

    const poll = setInterval(async () => {
      try {
        const statusRes = await getReportStatus(runId);
        setGenerationStatus(statusRes.stepStatus || 'Processing data...');

        if (statusRes.status === 'COMPLETED' || statusRes.status === 'FAILED') {
          setIsGenerating(false);
          setRunId(null);
          if (statusRes.status === 'COMPLETED') {
            setGenerationStatus('Report generated successfully');
            await refreshData();
          } else {
            setGenerationStatus('Report generation failed');
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

  const generateReport = async () => {
    if (!selectedCompany) return;

    setIsGenerating(true);
    setGenerationStatus('Analyzing competitor landscape...');
    try {
      const exampleCompetitor = selectedCompany.competitors[0]?.name;
      if (!exampleCompetitor) {
        setGenerationStatus('Error: Add one competitor to seed the list.');
        setIsGenerating(false);
        return;
      }

      await generateCompetitors(selectedCompany.id, exampleCompetitor);

      setGenerationStatus('Initializing report generation pipeline...');
      const { runId: newRunId } = await triggerReportGeneration(selectedCompany.id);
      setRunId(newRunId);
    } catch (error) {
        console.error("Failed to start report generation:", error);
        setIsGenerating(false);
        setGenerationStatus('Failed to start report generation.');
    }
  };

  return {
    isGenerating,
    generationStatus,
    generateReport,
  };
}; 