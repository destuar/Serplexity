/**
 * @file IntegrationSetupWizard.tsx
 * @description Minimal setup wizard matching Serplexity's tech-forward design
 */

import React, { useState } from "react";
import GoogleAnalyticsConnector from "./GoogleAnalyticsConnector";
import GoogleSearchConsoleConnector from "./GoogleSearchConsoleConnector";
import GscManualVerification from "./GscManualVerification";
import ManualTrackingSetup from "./ManualTrackingSetup";

interface IntegrationSetupWizardProps {
  onComplete: () => void;
  onCancel: () => void;
  mode?: "gsc" | "ga4";
}

type IntegrationType =
  | "google_search_console"
  | "google_analytics_4"
  | "manual_tracking"
  | "gsc_manual"
  | null;

const IntegrationSetupWizard: React.FC<IntegrationSetupWizardProps> = ({
  onComplete,
  onCancel,
  mode = "gsc",
}) => {
  const [currentStep, setCurrentStep] = useState<"selection" | "setup">(
    "selection"
  );
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationType>(null);

  const handleIntegrationSelect = (type: IntegrationType) => {
    setSelectedIntegration(type);
    setCurrentStep("setup");
  };

  const handleSetupComplete = () => {
    onComplete();
  };

  const handleBack = () => {
    if (currentStep === "setup") {
      setCurrentStep("selection");
      setSelectedIntegration(null);
    } else {
      onCancel();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {currentStep === "selection" && (
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
              {mode === "gsc" && (
                <>
                  <div
                    onClick={() =>
                      handleIntegrationSelect("google_search_console")
                    }
                    className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 cursor-pointer transition-all p-6"
                  >
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      Connect Google
                    </h3>
                    <div className="space-y-1 text-xs text-gray-500 mb-4">
                      <div>
                        • OAuth to read rankings from verified properties
                      </div>
                      <div>• Uses company website by default</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <button className="w-full px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors">
                        Connect
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => handleIntegrationSelect("gsc_manual")}
                    className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 cursor-pointer transition-all p-6"
                  >
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      Verify Manually
                    </h3>
                    <div className="space-y-1 text-xs text-gray-500 mb-4">
                      <div>• URL-prefix: HTML meta tag or HTML file</div>
                      <div>• Domain: DNS TXT</div>
                      <div>• Then connect Google to fetch data</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <button className="w-full px-4 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors">
                        Start manual verification
                      </button>
                    </div>
                  </div>
                </>
              )}

              {mode === "ga4" && (
                <>
                  <div
                    onClick={() =>
                      handleIntegrationSelect("google_analytics_4")
                    }
                    className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 cursor-pointer transition-all p-6"
                  >
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      Connect GA4
                    </h3>
                    <div className="space-y-1 text-xs text-gray-500 mb-4">
                      <div>• OAuth to read visitor metrics</div>
                      <div>• Optional property selection</div>
                      <div>• Or manual Measurement ID</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <button className="w-full px-4 py-2 bg-black text-white text-xs rounded-lg hover:bg-gray-900 transition-colors">
                        Connect
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => handleIntegrationSelect("manual_tracking")}
                    className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 cursor-pointer transition-all p-6"
                  >
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      Serplexity Web Analytics Tag
                    </h3>
                    <div className="space-y-1 text-xs text-gray-500 mb-4">
                      <div>• Lightweight pageview/session tracking</div>
                      <div>• Time-on-page, top pages, device & country</div>
                      <div>• No Google account required</div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <button className="w-full px-4 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors">
                        Add manually
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {currentStep === "setup" && (
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
            {selectedIntegration === "google_search_console" && (
              <GoogleSearchConsoleConnector
                onComplete={handleSetupComplete}
                onCancel={handleBack}
              />
            )}

            {selectedIntegration === "google_analytics_4" && (
              <GoogleAnalyticsConnector
                onComplete={handleSetupComplete}
                onCancel={handleBack}
              />
            )}

            {selectedIntegration === "manual_tracking" && (
              <ManualTrackingSetup
                onComplete={handleSetupComplete}
                onCancel={handleBack}
              />
            )}

            {selectedIntegration === "gsc_manual" && (
              <GscManualVerification
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
