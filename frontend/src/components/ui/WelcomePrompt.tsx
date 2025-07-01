import React from 'react';
import { Sparkles, Loader } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';

interface WelcomePromptProps {
  onGenerateReport: () => void;
  isGenerating: boolean;
  generationStatus?: string | null;
  progress?: number;
}

const WelcomePrompt: React.FC<WelcomePromptProps> = ({
  onGenerateReport,
  isGenerating,
  generationStatus,
  progress = 0
}) => {
  const { selectedCompany } = useCompany();

  // Use the progress value directly from the hook (which already handles monotonic progression)
  const currentProgress = progress;

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

          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 mb-6 border border-gray-200/40 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Your report will include:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#7762ff] rounded-full mr-3"></div>
                Brand visibility analysis
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#7762ff] rounded-full mr-3"></div>
                Competitor ranking
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#7762ff] rounded-full mr-3"></div>
                Sentiment analysis
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#7762ff] rounded-full mr-3"></div>
                Share of voice metrics
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#7762ff] rounded-full mr-3"></div>
                AI platform performance data
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-[#7762ff] rounded-full mr-3"></div>
                Strategic insights
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={onGenerateReport}
              disabled={isGenerating || !selectedCompany?.competitors?.length || generationStatus === 'Report generated successfully'}
              className="w-full flex flex-col gap-2 px-6 py-3 bg-gradient-to-r from-[#7762ff] to-[#9e52ff] text-white rounded-lg hover:from-[#6650e6] hover:to-[#8a47e6] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg font-medium shadow-lg hover:shadow-xl relative overflow-hidden"
            >
              {isGenerating ? (
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
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <Sparkles size={20} />
                  <span>Generate Your First Report</span>
                </div>
              )}
            </button>

            {(!selectedCompany?.competitors?.length) && (
              <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 rounded-lg p-3 shadow-sm">
                <p className="text-sm text-amber-700">
                  <strong>Note:</strong> Add at least one competitor to your company profile before generating a report.
                </p>
              </div>
            )}
            
            <p className="text-xs text-gray-500">
              Report generation typically takes 2-5 minutes depending on market complexity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePrompt; 