/**
 * @file useReportGeneration.ts
 * @description Custom hook for managing report generation functionality and state.
 * Provides comprehensive report generation, including competitor analysis, sentiment analysis, and custom reports.
 *
 * @dependencies
 * - react: For state management and effects.
 * - ../lib/apiClient: For API communication.
 * - ../contexts/CompanyContext: For company data.
 * - ../types/dashboard: For type definitions.
 *
 * @exports
 * - useReportGeneration: Hook for report generation functionality.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
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

// Enhanced state management for production-ready race condition prevention
const GENERATION_LOCK_PREFIX = 'serplexity_generation_lock_';
const COMPLETION_STATE_PREFIX = 'serplexity_completion_state_';
const CROSS_TAB_SYNC_PREFIX = 'serplexity_tab_sync_';

// Generation states for better state management
enum GenerationState {
  IDLE = 'IDLE',
  REQUESTING = 'REQUESTING',
  GENERATING = 'GENERATING',
  COMPLETING = 'COMPLETING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

interface CompletionState {
  timestamp: number;
  companyId: string;
  reportCompleted: boolean;
  dashboardRefreshed: boolean;
}

/**
 * Enhanced progress mapping that matches backend phases more accurately
 * Addresses the long 98%-100% delay by better reflecting actual work distribution
 */
const STATUS_PROGRESS_RANGES: { [key: string]: { start: number; end: number } } = {
  // Initial phases
  'Creating Report': { start: 0, end: 5 },
  'Setting up report generation': { start: 0, end: 5 },
  
  // Question preparation phase  
  'Preparing Questions': { start: 5, end: 15 },
  'Expanding "Fan-Out" Questions': { start: 5, end: 15 },
  
  // Main LLM processing phase (40% of total time)
  'Analyzing Visibility Questions': { start: 15, end: 55 },
  'Analyzing Visibility': { start: 15, end: 55 },
  'Running Visibility Analysis': { start: 15, end: 55 },
  
  // Competitor analysis phase (previously hidden)
  'Analyzing Competitors': { start: 55, end: 65 },
  
  // Database operations
  'Streaming to Database': { start: 65, end: 82 },
  'Preparing Dashboard': { start: 65, end: 82 }, // Legacy compatibility
  
  // Metrics calculation
  'Calculating Metrics': { start: 82, end: 87 },
  'Computed dashboard metrics': { start: 82, end: 87 },
  
  // Optimization tasks (major bottleneck for first reports)
  'Generating Optimization Tasks': { start: 87, end: 97 },
  'Starting task generation': { start: 87, end: 89 },
  'Processing with AI models': { start: 89, end: 95 },
  'Tasks generated': { start: 95, end: 96 },
  'Tasks saved': { start: 96, end: 97 },
  'Optimization complete': { start: 97, end: 97 },
  
  // Final completion
  'Finalizing Report': { start: 97, end: 100 },
  'Report Complete': { start: 100, end: 100 },
  'COMPLETED': { start: 100, end: 100 },
  'Completed': { start: 100, end: 100 },
  'Failed': { start: 0, end: 0 },
};

/**
 * Enhanced progress calculation with smoothing and better phase transitions
 * Prevents jarring jumps and provides more accurate time estimation
 */
const calculateProgressFromStatus = (status: string | null, currentProgress: number): number => {
  if (!status) return currentProgress;

  console.log('[Progress] Calculating progress for status:', status, 'current:', currentProgress);

  // Find the matching stage first - try exact matches before partial matches
  let matchedStage: string | null = null;
  let stageRange: { start: number; end: number } | null = null;

  // First try exact status match
  if (STATUS_PROGRESS_RANGES[status]) {
    matchedStage = status;
    stageRange = STATUS_PROGRESS_RANGES[status];
  } else {
    // Then try partial matches (for backward compatibility)
    for (const [keyword, range] of Object.entries(STATUS_PROGRESS_RANGES)) {
      if (status.toLowerCase().includes(keyword.toLowerCase())) {
        matchedStage = keyword;
        stageRange = range;
        break;
      }
    }
  }

  if (!matchedStage || !stageRange) {
    console.log('[Progress] No stage matched, using fallback');
    // More conservative fallback - smaller increments to avoid large jumps
    return Math.min(currentProgress + 0.5, 95);
  }

  console.log('[Progress] Matched stage:', matchedStage, 'range:', stageRange);

  // Check for explicit percentage in status message (e.g., "Analyzing Competitors (75%)")
  const percentMatch = status.match(/\((\d+)%\)/);
  if (percentMatch) {
    const explicitPercent = parseInt(percentMatch[1], 10);
    console.log('[Progress] Found explicit percent:', explicitPercent);
    
    // Map the explicit percentage within the stage's range
    const stageProgress = (explicitPercent / 100) * (stageRange.end - stageRange.start) + stageRange.start;
    const finalProgress = Math.round(stageProgress * 10) / 10; // Round to 1 decimal place
    
    console.log('[Progress] Mapped', explicitPercent + '% to', finalProgress + '% within stage range');
    
    // Smooth transition - don't allow progress to jump more than 5% at once
    const maxJump = 5;
    const progressDiff = finalProgress - currentProgress;
    
    if (progressDiff > maxJump) {
      const smoothedProgress = currentProgress + maxJump;
      console.log('[Progress] Smoothing large jump from', currentProgress + '% to', finalProgress + '%, using', smoothedProgress + '%');
      return Math.round(smoothedProgress);
    }
    
    return Math.max(currentProgress, Math.round(finalProgress));
  }

  // No explicit percentage - use the start of the stage range with smoothing
  const stageStartProgress = stageRange.start;
  
  // Smooth transition to stage start
  if (stageStartProgress > currentProgress) {
    const progressDiff = stageStartProgress - currentProgress;
    if (progressDiff > 3) {
      // Large jump - smooth it out
      const smoothedProgress = currentProgress + 3;
      console.log('[Progress] Smoothing stage transition from', currentProgress + '% to', stageStartProgress + '%, using', smoothedProgress + '%');
      return Math.round(smoothedProgress);
    }
  }
  
  const finalProgress = Math.max(currentProgress, stageStartProgress);
  console.log('[Progress] No explicit percent, using stage start:', finalProgress);
  return Math.round(finalProgress);
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
  
  // Time-based estimation state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const lastProgressUpdate = useRef<{ progress: number; timestamp: number } | null>(null);

  // Initialise generationStatus from storage so we can show last known progress immediately.
  const initialStatus = () => {
    if (typeof window === 'undefined' || !selectedCompany) return null;
    return localStorage.getItem(`${STATUS_PREFIX}${selectedCompany.id}`);
  };

  const [generationStatus, setGenerationStatus] = useState<string | null>(initialStatus);

  // Enhanced state management for production-ready race condition prevention
  const [generationState, setGenerationState] = useState<GenerationState>(GenerationState.IDLE);
  const [completionState, setCompletionState] = useState<CompletionState | null>(null);
  const [crossTabLock, setCrossTabLock] = useState<boolean>(false);
  
  // Refs for cleanup and state management
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tabSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Time estimation function
  const updateTimeEstimation = useCallback((currentProgress: number) => {
    const now = Date.now();
    
    if (!startTime || currentProgress <= 0) return;
    
    const elapsedMs = now - startTime;
    
    // Use different estimation strategies based on progress phase
    let estimatedTotalTime: number;
    
    if (currentProgress < 15) {
      // Early phase - use conservative estimate
      estimatedTotalTime = (elapsedMs / currentProgress) * 100;
    } else if (currentProgress < 55) {
      // Main processing phase - more accurate estimate  
      estimatedTotalTime = (elapsedMs / currentProgress) * 100;
    } else if (currentProgress < 87) {
      // Database operations phase - usually fast
      const remainingProgress = 100 - currentProgress;
      const expectedRemainingMs = remainingProgress * (elapsedMs / currentProgress) * 0.6; // 40% faster than linear
      estimatedTotalTime = elapsedMs + expectedRemainingMs;
    } else {
      // Optimization phase - can be slow for first reports
      const remainingProgress = 100 - currentProgress;
      const isFirstReport = selectedCompany?.competitors?.length === 0; // Rough heuristic
      const optimizationMultiplier = isFirstReport ? 1.5 : 0.3; // First reports take longer
      const expectedRemainingMs = remainingProgress * (elapsedMs / currentProgress) * optimizationMultiplier;
      estimatedTotalTime = elapsedMs + expectedRemainingMs;
    }
    
    const remainingMs = Math.max(0, estimatedTotalTime - elapsedMs);
    setEstimatedTimeRemaining(remainingMs);
    
    // Update last progress tracking for rate calculation
    lastProgressUpdate.current = { progress: currentProgress, timestamp: now };
  }, [selectedCompany, startTime]);

  // Format time remaining for display
  const formatTimeRemaining = (ms: number): string => {
    if (ms < 60000) { // Less than 1 minute
      return 'Less than 1 minute remaining';
    } else if (ms < 3600000) { // Less than 1 hour
      const minutes = Math.ceil(ms / 60000);
      return `About ${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
    } else {
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.ceil((ms % 3600000) / 60000);
      return `About ${hours}h ${minutes}m remaining`;
    }
  };

  // Enhanced lock management
  const acquireGenerationLock = useCallback((companyId: string): boolean => {
    if (typeof window === 'undefined') return false;
    
    const lockKey = `${GENERATION_LOCK_PREFIX}${companyId}`;
    const existingLock = localStorage.getItem(lockKey);
    
    if (existingLock) {
      const lockData = JSON.parse(existingLock);
      const now = Date.now();
      
      // Lock expires after 10 minutes to prevent permanent locks
      if (now - lockData.timestamp < 600000) {
        console.log('[ReportGeneration] Generation lock already held for company:', companyId);
        return false;
      }
    }
    
    // Acquire lock
    localStorage.setItem(lockKey, JSON.stringify({
      timestamp: Date.now(),
      tabId: Math.random().toString(36).substr(2, 9)
    }));
    
    return true;
  }, []);

  const releaseGenerationLock = useCallback((companyId: string) => {
    if (typeof window === 'undefined') return;
    
    const lockKey = `${GENERATION_LOCK_PREFIX}${companyId}`;
    localStorage.removeItem(lockKey);
  }, []);

  // Cross-tab synchronization
  const syncCrossTab = useCallback((companyId: string, state: GenerationState, data?: unknown) => {
    if (typeof window === 'undefined') return;
    
    const syncKey = `${CROSS_TAB_SYNC_PREFIX}${companyId}`;
    const syncData = {
      state,
      timestamp: Date.now(),
      data,
      tabId: Math.random().toString(36).substr(2, 9)
    };
    
    localStorage.setItem(syncKey, JSON.stringify(syncData));
    
    // Dispatch custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent('reportGenerationSync', {
      detail: { companyId, ...syncData }
    }));
  }, []);

  // Listen for cross-tab synchronization
  useEffect(() => {
    if (!selectedCompany) return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key?.startsWith(CROSS_TAB_SYNC_PREFIX)) return;
      
      const companyId = e.key.replace(CROSS_TAB_SYNC_PREFIX, '');
      if (companyId !== selectedCompany.id) return;
      
      if (e.newValue) {
        const syncData = JSON.parse(e.newValue);
        console.log('[ReportGeneration] Cross-tab sync received:', syncData);
        
        // Update state based on sync data
        switch (syncData.state) {
          case GenerationState.GENERATING:
            setGenerationState(GenerationState.GENERATING);
            setCrossTabLock(true);
            break;
          case GenerationState.COMPLETING:
            setGenerationState(GenerationState.COMPLETING);
            setCrossTabLock(true);
            break;
          case GenerationState.COMPLETED:
            setGenerationState(GenerationState.COMPLETED);
            setCrossTabLock(true);
            break;
          case GenerationState.IDLE:
            setGenerationState(GenerationState.IDLE);
            setCrossTabLock(false);
            break;
        }
      }
    };
    
    const handleSyncEvent = (e: CustomEvent) => {
      if (e.detail.companyId !== selectedCompany.id) return;
      console.log('[ReportGeneration] Same-tab sync received:', e.detail);
      // Handle same-tab sync if needed
    };
    
    // Event listener for when dashboard has been refreshed post-completion
    const handleDashboardRefreshed = (e: CustomEvent<{ companyId: string }>) => {
      if (e.detail.companyId === selectedCompany?.id) {
        console.log('[useReportGen] Received dashboard refreshed event.');
        // Update local completion state to remove UI blocker
        const completionKey = `${COMPLETION_STATE_PREFIX}${selectedCompany.id}`;
        const stored = localStorage.getItem(completionKey);
        if (stored) {
          const completion = JSON.parse(stored) as CompletionState;
          completion.dashboardRefreshed = true;
          localStorage.setItem(completionKey, JSON.stringify(completion));
          setCompletionState(completion);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('reportGenerationSync', handleSyncEvent as EventListener);
    window.addEventListener('dashboardRefreshed', handleDashboardRefreshed as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('reportGenerationSync', handleSyncEvent as EventListener);
      window.removeEventListener('dashboardRefreshed', handleDashboardRefreshed as EventListener);
    };
  }, [selectedCompany, syncCrossTab]);

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
    
    // Check for completion state
    const completionKey = `${COMPLETION_STATE_PREFIX}${selectedCompany.id}`;
    const storedCompletion = localStorage.getItem(completionKey);
    if (storedCompletion) {
      const completion: CompletionState = JSON.parse(storedCompletion);
      setCompletionState(completion);
      setGenerationState(GenerationState.COMPLETED);
    }
  }, [selectedCompany]);

  // Enhanced completion state management
  const handleReportCompletion = useCallback(async (companyId: string) => {
    console.log('[ReportGeneration] Handling report completion for company:', companyId);
    
    setGenerationState(GenerationState.COMPLETING);
    syncCrossTab(companyId, GenerationState.COMPLETING);
    
    const completionData: CompletionState = {
      timestamp: Date.now(),
      companyId,
      reportCompleted: true,
      dashboardRefreshed: false
    };
    
    setCompletionState(completionData);
    localStorage.setItem(`${COMPLETION_STATE_PREFIX}${companyId}`, JSON.stringify(completionData));
    
    // Set final progress and status
    setProgress(100);
    progressRef.current = 100;
    setGenerationStatus('Report completed! Loading dashboard...');
    
    // Clean up generation state
    setIsGenerating(false);
    setRunId(null);
    
    // Clear polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    // Clear generation data but keep completion state
    localStorage.removeItem(`${RUN_ID_PREFIX}${companyId}`);
    localStorage.removeItem(`${STATUS_PREFIX}${companyId}`);
    localStorage.removeItem(`${PROGRESS_PREFIX}${companyId}`);
    
    // Notify other components about completion without refresh
    window.dispatchEvent(new CustomEvent('reportCompleted', {
      detail: { companyId }
    }));
    
    // Transition to completed state after brief delay
    setTimeout(() => {
      setGenerationState(GenerationState.COMPLETED);
      syncCrossTab(companyId, GenerationState.COMPLETED);
      
      // Release lock after completion
      releaseGenerationLock(companyId);
      
      // Auto-clear completion state after 30 seconds
      setTimeout(() => {
        setCompletionState(null);
        localStorage.removeItem(`${COMPLETION_STATE_PREFIX}${companyId}`);
        setGenerationState(GenerationState.IDLE);
        syncCrossTab(companyId, GenerationState.IDLE);
      }, 30000);
    }, 2000);
  }, [syncCrossTab, releaseGenerationLock]);

  // Enhanced status polling with better cleanup
  useEffect(() => {
    if (!isGenerating || !runId || !selectedCompany) {
      return;
    }

    // Create abort controller for this polling session
    abortControllerRef.current = new AbortController();
    
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
          
          // Update time estimation with new progress
          updateTimeEstimation(newProgress);
        }

        // Persist the latest status and progress
        localStorage.setItem(`${STATUS_PREFIX}${selectedCompany.id}`, newStatus);
        localStorage.setItem(`${PROGRESS_PREFIX}${selectedCompany.id}`, progressRef.current.toString());

        if (statusRes.status === 'COMPLETED') {
          await handleReportCompletion(selectedCompany.id);
        } else if (statusRes.status === 'FAILED') {
          setGenerationState(GenerationState.FAILED);
          setIsGenerating(false);
          setRunId(null);
          setGenerationStatus('Report generation failed');
          setProgress(0);
          progressRef.current = 0;
          
          // Clean up on failure
          localStorage.removeItem(`${STATUS_PREFIX}${selectedCompany.id}`);
          localStorage.removeItem(`${PROGRESS_PREFIX}${selectedCompany.id}`);
          releaseGenerationLock(selectedCompany.id);
          syncCrossTab(selectedCompany.id, GenerationState.FAILED);
        }
      } catch (error) {
        console.error('Status fetch failed:', error);

        // Enhanced error handling
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            setGenerationStatus('Report not found or has been cancelled.');
          } else if (error.response?.status === 401) {
            setGenerationStatus('Authentication expired. Please refresh the page.');
          } else {
            setGenerationStatus('An error occurred while fetching report status.');
          }
        }

        // Clean up on error
        setGenerationState(GenerationState.FAILED);
        setIsGenerating(false);
        setRunId(null);
        setProgress(0);
        progressRef.current = 0;

        // Clear all persisted data to stop the loop
        localStorage.removeItem(`${RUN_ID_PREFIX}${selectedCompany.id}`);
        localStorage.removeItem(`${STATUS_PREFIX}${selectedCompany.id}`);
        localStorage.removeItem(`${PROGRESS_PREFIX}${selectedCompany.id}`);
        releaseGenerationLock(selectedCompany.id);
        syncCrossTab(selectedCompany.id, GenerationState.FAILED);
      }
    };

    // Initial fetch
    fetchStatus();

    // Set up polling
    pollIntervalRef.current = setInterval(fetchStatus, 2000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isGenerating, runId, selectedCompany, handleReportCompletion, releaseGenerationLock, syncCrossTab, updateTimeEstimation]);

  // Enhanced generateReport function with comprehensive safeguards
  const generateReport = async () => {
    if (!selectedCompany) {
      console.error('[ReportGeneration] No company selected');
      return;
    }

    // Multiple layers of protection
    if (generationState !== GenerationState.IDLE) {
      console.warn('[ReportGeneration] Generation already in progress or completed');
      return;
    }

    if (crossTabLock) {
      console.warn('[ReportGeneration] Cross-tab generation lock active');
      return;
    }

    // Check for recent completion
    const completionKey = `${COMPLETION_STATE_PREFIX}${selectedCompany.id}`;
    const storedCompletion = localStorage.getItem(completionKey);
    if (storedCompletion) {
      const completion: CompletionState = JSON.parse(storedCompletion);
      const timeSinceCompletion = Date.now() - completion.timestamp;
      
      // Block generation for 30 seconds after completion
      if (timeSinceCompletion < 30000) {
        console.warn('[ReportGeneration] Recent completion detected, blocking generation');
        return;
      }
    }

    // Acquire generation lock
    if (!acquireGenerationLock(selectedCompany.id)) {
      console.warn('[ReportGeneration] Could not acquire generation lock');
      return;
    }

    try {
      setGenerationState(GenerationState.REQUESTING);
      syncCrossTab(selectedCompany.id, GenerationState.REQUESTING);
      
      setIsGenerating(true);
      setProgress(0);
      progressRef.current = 0;
      setGenerationStatus('Initializing report generation pipeline...');
      
      // Clear any existing completion state
      setCompletionState(null);
      localStorage.removeItem(`${COMPLETION_STATE_PREFIX}${selectedCompany.id}`);
      
      // Validate prerequisites
      const hasCompetitors = selectedCompany.competitors && selectedCompany.competitors.length > 0;
      if (!hasCompetitors) {
        setGenerationStatus('Error: Add at least one competitor to enable report generation.');
        setIsGenerating(false);
        setProgress(0);
        progressRef.current = 0;
        setGenerationState(GenerationState.FAILED);
        releaseGenerationLock(selectedCompany.id);
        return;
      }

      // Make the API request
      const { runId: newRunId } = await triggerReportGeneration(selectedCompany.id);
      
      // Update state for active generation
      setRunId(newRunId);
      setGenerationState(GenerationState.GENERATING);
      syncCrossTab(selectedCompany.id, GenerationState.GENERATING);

      // Persist initial state
      localStorage.setItem(`${STATUS_PREFIX}${selectedCompany.id}`, 'Initializing report generation pipeline...');
      localStorage.setItem(`${PROGRESS_PREFIX}${selectedCompany.id}`, '5');
      
      // Set initial progress
      setProgress(5);
      progressRef.current = 5;
      setStartTime(Date.now());
      
      console.log('[ReportGeneration] Successfully started report generation:', newRunId);
      
    } catch (error) {
      console.error('[ReportGeneration] Failed to start report generation:', error);
      
      // Handle different error types
      let errorMessage = 'Failed to start report generation.';
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 409) {
          errorMessage = 'A report is already being generated for this company.';
        } else if (error.response?.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      setGenerationState(GenerationState.FAILED);
      setIsGenerating(false);
      setProgress(0);
      progressRef.current = 0;
      setGenerationStatus(errorMessage);
      
      // Clean up on failure
      releaseGenerationLock(selectedCompany.id);
      syncCrossTab(selectedCompany.id, GenerationState.FAILED);
    }
  };

  // Enhanced button state logic
  const isButtonDisabled = useCallback(() => {
    if (!selectedCompany) return true;
    if (!selectedCompany.competitors?.length) return true;
    if (generationState !== GenerationState.IDLE) return true;
    if (crossTabLock) return true;
    if (completionState && !completionState.dashboardRefreshed) return true;
    
    return false;
  }, [selectedCompany, generationState, crossTabLock, completionState]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (tabSyncTimeoutRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        clearTimeout(tabSyncTimeoutRef.current);
      }
    };
  }, []);

  return {
    isGenerating,
    generationStatus,
    progress,
    generateReport,
    estimatedTimeRemaining,
    formatTimeRemaining,
    isButtonDisabled: isButtonDisabled(),
    generationState,
    completionState,
  };
}; 