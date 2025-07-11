import React from 'react';
import { useCompany } from '../contexts/CompanyContext';
import { useDashboard } from '../hooks/useDashboard';
import WelcomePrompt from '../components/ui/WelcomePrompt';
import BlankLoadingState from '../components/ui/BlankLoadingState';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { RefreshCw, Loader } from 'lucide-react';
import OptimizationChecklistCard from '../components/dashboard/OptimizationChecklistCard';

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

  const handleRefresh = () => {
    refreshData();
    // The tasks will be automatically refreshed when new reports are generated
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
            <div className="flex-1 min-h-0 pt-1">
              <OptimizationChecklistCard />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VisibilityTasksPage; 