/**
 * @file IntegrationSetupWizard.tsx
 * @description Minimal setup wizard matching Serplexity's tech-forward design
 */

import React, { useState } from 'react';
import GoogleSearchConsoleConnector from './GoogleSearchConsoleConnector';
import ManualTrackingSetup from './ManualTrackingSetup';

interface IntegrationSetupWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

type IntegrationType = 'google_search_console' | 'manual_tracking' | null;

const IntegrationSetupWizard: React.FC<IntegrationSetupWizardProps> = ({
  onComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState<'selection' | 'setup'>('selection');
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationType>(null);

  const handleIntegrationSelect = (type: IntegrationType) => {
    setSelectedIntegration(type);
    setCurrentStep('setup');
  };

  const handleSetupComplete = () => {
    onComplete();
  };

  const handleBack = () => {
    if (currentStep === 'setup') {
      setCurrentStep('selection');
      setSelectedIntegration(null);
    } else {
      onCancel();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {currentStep === 'selection' && (
        <div className="flex-1 min-h-0 p-1 flex items-center justify-center">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-xl font-medium text-gray-900 mb-2">
                Connect Analytics
              </h1>
              <p className="text-sm text-gray-600">
                Choose your preferred integration method
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {/* Import from GSC */}
              <div 
                onClick={() => handleIntegrationSelect('google_search_console')}
                className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 cursor-pointer transition-all p-6"
              >
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Import from GSC
                </h3>
                <div className="space-y-1 text-xs text-gray-500 mb-4">
                  <div>• Automatic ownership verification</div>
                  <div>• Quick and seamless integration</div>
                  <div>• Edit project settings later</div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/20">
                  <button className="w-full px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors">
                    Import
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    We'll ask you to connect your Google Account and select which projects to import
                  </p>
                </div>
              </div>

              {/* Add manually */}
              <div 
                onClick={() => handleIntegrationSelect('manual_tracking')}
                className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 cursor-pointer transition-all p-6"
              >
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Add manually
                </h3>
                <div className="space-y-1 text-xs text-gray-500 mb-4">
                  <div>• Manual ownership verification required</div>
                  <div>• Granular configuration control</div>
                  <div>• Fully configure project during creation</div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/20">
                  <button className="w-full px-4 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors">
                    Add manually
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {currentStep === 'setup' && (
        <div className="h-full flex flex-col">
          <div className="flex-shrink-0 mb-4">
            <button
              onClick={handleBack}
              className="px-3 py-1 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black transition-colors text-xs text-gray-600"
            >
              ← Back
            </button>
          </div>

          <div className="flex-1 min-h-0">
            {selectedIntegration === 'google_search_console' && (
              <GoogleSearchConsoleConnector
                onComplete={handleSetupComplete}
                onCancel={handleBack}
              />
            )}

            {selectedIntegration === 'manual_tracking' && (
              <ManualTrackingSetup
                onComplete={handleSetupComplete}
                onCancel={handleBack}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationSetupWizard;