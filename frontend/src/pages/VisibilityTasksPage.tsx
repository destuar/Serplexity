/**
 * @file VisibilityTasksPage.tsx
 * @description Visibility tasks page for managing and tracking AI visibility optimization tasks.
 * Provides task management, progress tracking, and optimization recommendations.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation.
 * - lucide-react: For icons.
 * - ../contexts/DashboardContext: For dashboard data.
 *
 * @exports
 * - VisibilityTasksPage: The main visibility tasks page component.
 */
import React, { useState, useEffect } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { RefreshCw, Loader } from 'lucide-react';
import KanbanBoard from '../components/dashboard/KanbanBoard';
import { OptimizationTask, TaskStatus, updateTaskStatus } from '../services/reportService';

const VisibilityTasksPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { data, loading, hasReport, refreshing, refreshData, lastUpdated } = useDashboard();
  const { 
    isGenerating, 
    generationStatus, 
    progress, 
    generateReport, 
    isButtonDisabled, 
    generationState, 
    completionState 
  } = useReportGeneration(selectedCompany);

  const [tasks, setTasks] = useState<OptimizationTask[]>([]);

  // Sync tasks from dashboard data
  useEffect(() => {
    if (data?.optimizationTasks) {
      setTasks(data.optimizationTasks);
    } else {
      setTasks([]);
    }
  }, [data?.optimizationTasks]);

  const handleRefresh = () => {
    refreshData();
    // The tasks will be automatically refreshed when new reports are generated
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (!data?.optimizationTasks) return;
    
    const task = tasks.find(t => t.taskId === taskId);
    if (!task) return;

    // Store original state for potential rollback
    const originalStatus = task.status;
    const originalIsCompleted = task.isCompleted;
    
    // Immediate optimistic update - no loading state
    setTasks(prev => prev.map(t => 
      t.taskId === taskId 
        ? { ...t, status: newStatus, isCompleted: newStatus === TaskStatus.COMPLETED }
        : t
    ));

    try {
      // Background API call
      await updateTaskStatus(task.reportRunId, taskId, newStatus);
      
      // Silent refresh to ensure consistency - no loading state
      refreshData();
    } catch (error) {
      console.error('Error updating task status:', error);
      
      // Revert optimistic update on error
      setTasks(prev => prev.map(t => 
        t.taskId === taskId 
          ? { ...t, status: originalStatus, isCompleted: originalIsCompleted }
          : t
      ));
      
      // Show error toast or notification here if needed
      // For now, we'll just log the error
    }
  };

  return (
    <div className="h-full flex flex-col">
      {loading || hasReport === null ? (
        <BlankLoadingState message="Loading visibility tasks..." />
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
      ) : (
        <>
          <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Visibility Tasks</h1>
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing || isGenerating}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#7762ff] text-white rounded-lg hover:bg-[#6650e6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {refreshing ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>Refreshing...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    <span>Refresh Data</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {!data || Object.keys(data).length === 0 ? (
            <BlankLoadingState message="Processing visibility tasks..." />
          ) : (
            <div className="flex-1 min-h-0 p-1 relative" style={{ overflow: 'visible' }}>
              <KanbanBoard 
                tasks={tasks}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VisibilityTasksPage; 