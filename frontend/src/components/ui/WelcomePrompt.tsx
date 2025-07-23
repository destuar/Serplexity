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
import { Sparkles, Loader } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';


interface WelcomePromptProps {
  onGenerateReport: () => void;
  isGenerating: boolean;
  generationStatus?: string | null;
  progress?: number;
  isButtonDisabled?: boolean;
  generationState?: string;
}

const WelcomePrompt: React.FC<WelcomePromptProps> = ({
  onGenerateReport,
  isGenerating,
  generationStatus,
  progress = 0,
  isButtonDisabled = false
}) => {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-6 max-w-md w-full text-center">
        <div className="w-12 h-12 mx-auto mb-4">
          <img
            src="/Serplexity.svg"
            alt="Serplexity"
            className="w-12 h-12"
          />
        </div>
        
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Ready to get started?
        </h2>
        
        <p className="text-sm text-gray-500 mb-6">
          Generate your first competitive intelligence report
        </p>

        <button 
          onClick={onGenerateReport}
          disabled={isButtonDisabled}
          className="w-full relative overflow-hidden flex items-center justify-center gap-3 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isGenerating && (
            <div 
              className="absolute inset-0 bg-white/20 transition-all duration-700 ease-out"
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          )}
          <div className="relative z-10 flex items-center gap-3">
            {isGenerating ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <>
                <Sparkles size={16} />
                <span>Generate Report</span>
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};

export default WelcomePrompt; 