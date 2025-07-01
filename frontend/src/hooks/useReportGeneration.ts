import { useState, useEffect, useRef } from 'react';
import { triggerReportGeneration, getReportStatus } from '../services/reportService';
import { Company } from '../types/schemas';

/**
 * Key prefix used for persisting the current report runId in localStorage.
 * We append the company id so simultaneous reports for different companies
 * (in rare multi-tenant scenarios) are tracked independently.
 */
const RUN_ID_PREFIX = 'serplexity_report_runId_';
const STATUS_PREFIX = 'serplexity_report_status_';
const PROGRESS_PREFIX = 'serplexity_report_progress_';

/**
 * Maps status keywords to progress ranges for smooth progression
 * Each stage defines a start and end range for proper sub-progress mapping
 */
const STATUS_PROGRESS_RANGES: { [key: string]: { start: number; end: number } } = {
  'Creating Report': { start: 0, end: 5 },
  'Preparing Questions': { start: 5, end: 15 },
  'Analyzing Sentiment': { start: 15, end: 22 },
  'Running Visibility Analysis': { start: 20, end: 22 },
  'Analyzing Visibility': { start: 22, end: 60 },
  'Analyzing Competitors': { start: 60, end: 80 },
  'Preparing Dashboard': { start: 80, end: 100 },
  'COMPLETED': { start: 100, end: 100 },
  'Completed': { start: 100, end: 100 },
  'Failed': { start: 0, end: 0 },
};

/**
 * Calculates progress percentage from status message with proper stage-aware mapping
 */
const calculateProgressFromStatus = (status: string | null, currentProgress: number): number => {
  if (!status) return currentProgress;

  console.log('[Progress] Calculating progress for status:', status, 'current:', currentProgress);

  // Find the matching stage first
  let matchedStage: string | null = null;
  let stageRange: { start: number; end: number } | null = null;

  for (const [keyword, range] of Object.entries(STATUS_PROGRESS_RANGES)) {
    if (status.toLowerCase().includes(keyword.toLowerCase())) {
      matchedStage = keyword;
      stageRange = range;
      break; // Use first match to avoid conflicts
    }
  }

  if (!matchedStage || !stageRange) {
    console.log('[Progress] No stage matched, using fallback');
    // Fallback: small increment but don't exceed 90%
    return Math.min(currentProgress + 1, 90);
  }

  console.log('[Progress] Matched stage:', matchedStage, 'range:', stageRange);

  // Check for explicit percentage in status message (e.g., "Analyzing Competitors (75%)")
  const percentMatch = status.match(/\((\d+)%\)/);
  if (percentMatch) {
    const explicitPercent = parseInt(percentMatch[1], 10);
    console.log('[Progress] Found explicit percent:', explicitPercent);
    
    // Map the explicit percentage within the stage's range
    const stageProgress = (explicitPercent / 100) * (stageRange.end - stageRange.start) + stageRange.start;
    const finalProgress = Math.round(stageProgress);
    
    console.log('[Progress] Mapped', explicitPercent + '% to', finalProgress + '% within stage range');
    return Math.max(currentProgress, finalProgress);
  }

  // No explicit percentage - use the start of the stage range
  const stageStartProgress = Math.max(currentProgress, stageRange.start);
  console.log('[Progress] No explicit percent, using stage start:', stageStartProgress);
  return stageStartProgress;
};

export const useReportGeneration = (selectedCompany: Company | null) => {

  // Initialise from localStorage so we restore state after reload/navigation
  const initialRunId = () => {
    if (typeof window === 'undefined' || !selectedCompany) return null;
    return localStorage.getItem(`${RUN_ID_PREFIX}${selectedCompany.id}`);
  };

  const initialProgress = () => {
    if (typeof window === 'undefined' || !selectedCompany) return 0;
    const stored = localStorage.getItem(`${PROGRESS_PREFIX}${selectedCompany.id}`);
    return stored ? parseInt(stored, 10) : 0;
  };

  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [isGenerating, setIsGenerating] = useState<boolean>(() => initialRunId() !== null);
  const [progress, setProgress] = useState<number>(initialProgress);
  const progressRef = useRef<number>(initialProgress());

  // Initialise generationStatus from storage so we can show last known progress immediately.
  const initialStatus = () => {
    if (typeof window === 'undefined' || !selectedCompany) return null;
    return localStorage.getItem(`${STATUS_PREFIX}${selectedCompany.id}`);
  };

  const [generationStatus, setGenerationStatus] = useState<string | null>(initialStatus);

  /**
   * Whenever runId or progress changes, persist (or clear) it in localStorage
   */
  useEffect(() => {
    if (!selectedCompany) return;

    const runKey = `${RUN_ID_PREFIX}${selectedCompany.id}`;
    const statusKey = `${STATUS_PREFIX}${selectedCompany.id}`;
    const progressKey = `${PROGRESS_PREFIX}${selectedCompany.id}`;

    if (runId) {
      localStorage.setItem(runKey, runId);
      localStorage.setItem(progressKey, progress.toString());
    } else {
      localStorage.removeItem(runKey);
      localStorage.removeItem(statusKey);
      localStorage.removeItem(progressKey);
    }
  }, [runId, selectedCompany, progress]);

  /**
   * If the selected company changes, load any persisted runId for that company
   * so that switching companies mid-generation continues to reflect progress.
   */
  useEffect(() => {
    if (!selectedCompany) return;

    const storedRunId = localStorage.getItem(`${RUN_ID_PREFIX}${selectedCompany.id}`);
    const storedStatus = localStorage.getItem(`${STATUS_PREFIX}${selectedCompany.id}`);
    const storedProgress = localStorage.getItem(`${PROGRESS_PREFIX}${selectedCompany.id}`);
    
    setRunId(storedRunId);
    setGenerationStatus(storedStatus);
    const progressValue = storedProgress ? parseInt(storedProgress, 10) : 0;
    setProgress(progressValue);
    progressRef.current = progressValue;
    setIsGenerating(!!storedRunId);
  }, [selectedCompany]);

  /**
   * Poll the backend for status updates while a report is generating.
   * This effect re-attaches on navigation/reload because runId is restored
   * from localStorage in the initial state logic above.
   */
  useEffect(() => {
    if (!isGenerating || !runId) {
      return;
    }

    // Immediately fetch status so UI updates without waiting for first interval tick
    const fetchStatus = async () => {
      try {
        const statusRes = await getReportStatus(runId);
        const newStatus = statusRes.stepStatus || 'Processing data...';
        setGenerationStatus(newStatus);

        // Calculate new progress ensuring it never goes backwards
        const newProgress = calculateProgressFromStatus(newStatus, progressRef.current);
        if (newProgress > progressRef.current) {
          setProgress(newProgress);
          progressRef.current = newProgress;
        }

        // Persist the latest status and progress
        if (selectedCompany) {
          localStorage.setItem(`${STATUS_PREFIX}${selectedCompany.id}`, newStatus);
          localStorage.setItem(`${PROGRESS_PREFIX}${selectedCompany.id}`, progressRef.current.toString());
        }

        if (statusRes.status === 'COMPLETED' || statusRes.status === 'FAILED') {
          setIsGenerating(false);
          setRunId(null);
          
          if (statusRes.status === 'COMPLETED') {
            // Set progress to 100% and show completion message
            setProgress(100);
            progressRef.current = 100;
            setGenerationStatus('Report completed! Refreshing dashboard...');
            
            // Wait for database to commit, then refresh the page
            setTimeout(() => {
              // Clear persisted data before refresh
              if (selectedCompany) {
                localStorage.removeItem(`${RUN_ID_PREFIX}${selectedCompany.id}`);
                localStorage.removeItem(`${STATUS_PREFIX}${selectedCompany.id}`);
                localStorage.removeItem(`${PROGRESS_PREFIX}${selectedCompany.id}`);
              }
              // Full page refresh to load the new dashboard
              window.location.reload();
            }, 3000); // 3 seconds to ensure database commit
          } else {
            setGenerationStatus('Report generation failed');
            setProgress(0);
            progressRef.current = 0;
            
            // Clear persisted data on failure
            if (selectedCompany) {
              localStorage.removeItem(`${STATUS_PREFIX}${selectedCompany.id}`);
              localStorage.removeItem(`${PROGRESS_PREFIX}${selectedCompany.id}`);
            }
          }
        }
      } catch (error) {
        console.error('Initial status fetch failed:', error);
      }
    };

    fetchStatus();

    const poll = setInterval(fetchStatus, 2000);
    return () => clearInterval(poll);
  }, [isGenerating, runId, selectedCompany]);





  const generateReport = async () => {
    if (!selectedCompany) return;

    setIsGenerating(true);
    setProgress(0);
    progressRef.current = 0;
    setGenerationStatus('Initializing report generation pipeline...');
    
    try {
      const hasCompetitors = selectedCompany.competitors && selectedCompany.competitors.length > 0;
      if (!hasCompetitors) {
        setGenerationStatus('Error: Add at least one competitor to enable report generation.');
        setIsGenerating(false);
        setProgress(0);
        progressRef.current = 0;
        return;
      }

      const { runId: newRunId } = await triggerReportGeneration(selectedCompany.id);
      setRunId(newRunId);

      if (selectedCompany) {
        localStorage.setItem(`${STATUS_PREFIX}${selectedCompany.id}`, 'Initializing report generation pipeline...');
        localStorage.setItem(`${PROGRESS_PREFIX}${selectedCompany.id}`, '5');
      }
      
      // Set initial progress
      setProgress(5);
      progressRef.current = 5;
    } catch (error) {
        console.error("Failed to start report generation:", error);
        setIsGenerating(false);
        setProgress(0);
        progressRef.current = 0;
        setGenerationStatus('Failed to start report generation.');
    }
  };

  return {
    isGenerating,
    generationStatus,
    progress,
    generateReport,
  };
}; 