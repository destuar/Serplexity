/**
 * @file WelcomePrompt.tsx
 * @description Welcome prompt component that displays onboarding messages and helpful tips for new users.
 * Provides contextual guidance and welcome information throughout the application.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - lucide-react: For icons.
 * - ../../lib/utils: For utility functions.
 *
 * @exports
 * - WelcomePrompt: The main welcome prompt component.
 */
import React from 'react';
import { Sparkles, Loader, CheckCircle } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';

interface CompletionState {
  timestamp: number;
  companyId: string;
  reportCompleted: boolean;
  dashboardRefreshed: boolean;
}

interface WelcomePromptProps {
  onGenerateReport: () => void;
  isGenerating: boolean;
  generationStatus?: string | null;
  progress?: number;
  isButtonDisabled?: boolean;
  generationState?: string;
  completionState?: CompletionState | null;
}

const WelcomePrompt: React.FC<WelcomePromptProps> = ({
  onGenerateReport,
  isGenerating,
  generationStatus,
  progress = 0,
  isButtonDisabled = false,
  generationState,
  completionState
}) => {
  const { selectedCompany: _selectedCompany } = useCompany();

  // Use the progress value directly from the hook (which already handles monotonic progression)
  const currentProgress = progress;

  // Enhanced button state logic
  const getButtonContent = () => {
    if (completionState && !completionState.dashboardRefreshed) {
      return (
        <div className="flex items-center justify-center gap-3">
          <CheckCircle size={20} className="text-green-400" />
          <span>Report completed! Loading dashboard...</span>
        </div>
      );
    }

    if (isGenerating) {
      return (
        <>
          <div className="flex items-center justify-center gap-3">
            <Loader size={20} className="animate-spin" />
            <span>{generationStatus || 'Generating your first report...'}</span>
          </div>
          
          {/* Progress Bar */}
          {currentProgress > 0 && (
            <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-white/80 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${currentProgress}%` }}
              ></div>
            </div>
          )}
        </>
      );
    }

    if (generationState === 'COMPLETED') {
      return (
        <div className="flex items-center justify-center gap-3">
          <CheckCircle size={20} className="text-green-400" />
          <span>Report completed! Refresh to view dashboard</span>
        </div>
      );
    }

    if (generationState === 'FAILED') {
      return (
        <div className="flex items-center justify-center gap-3">
          <Sparkles size={20} />
          <span>Generate Your First Report</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center gap-3">
        <Sparkles size={20} />
        <span>Generate Your First Report</span>
      </div>
    );
  };

  // Enhanced button class logic
  const getButtonClass = () => {
    const baseClass = "w-full flex flex-col gap-2 px-6 py-3 rounded-lg transition-all text-lg font-medium shadow-lg hover:shadow-xl relative overflow-hidden";
    
    if (completionState && !completionState.dashboardRefreshed) {
      return `${baseClass} bg-green-600 text-white cursor-not-allowed opacity-90`;
    }

    if (isButtonDisabled) {
      return `${baseClass} bg-gray-400 text-white cursor-not-allowed opacity-50`;
    }

    if (generationState === 'COMPLETED') {
      return `${baseClass} bg-green-600 text-white cursor-not-allowed opacity-90`;
    }

    if (generationState === 'FAILED') {
      return `${baseClass} bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white hover:from-[#6650e6] hover:to-[#8a47e6]`;
    }

    return `${baseClass} bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white hover:from-[#6650e6] hover:to-[#8a47e6]`;
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center p-8">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-gray-200/50 p-8 shadow-lg">
          <div className="w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <img
              src="/Serplexity.svg"
              alt="Serplexity Logo"
              className="w-16 h-16"
            />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Ready to boost your visibility?
          </h2>
          
          <p className="text-gray-600 mb-6 leading-relaxed">
            Get started by generating your first competitive intelligence report. 
            We'll analyze your market position, track competitor mentions, and provide 
            insights across multiple AI platforms.
          </p>

          <div className="space-y-3">
            <button 
              onClick={onGenerateReport}
              disabled={isButtonDisabled}
              className={getButtonClass()}
            >
              {getButtonContent()}
            </button>
            
            {!isGenerating && !completionState && (
              <p className="text-xs text-gray-500">
                Report generation typically takes 2-5 minutes depending on market complexity.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePrompt; 