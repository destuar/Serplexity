/**
 * @file IntegrationSetupWizard.tsx
 * @description Multi-step wizard for setting up website analytics integrations
 */

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
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
    <div className="max-w-4xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 ${
            currentStep === 'selection' ? 'text-blue-600' : 'text-gray-500'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'selection' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              1
            </div>
            <span>Choose Integration</span>
          </div>
          <div className="flex-1 h-px bg-gray-200"></div>
          <div className={`flex items-center space-x-2 ${
            currentStep === 'setup' ? 'text-blue-600' : 'text-gray-500'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'setup' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}>
              2
            </div>
            <span>Setup & Configure</span>
          </div>
        </div>
      </div>

      {currentStep === 'selection' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Connect Your Website Analytics
            </h2>
            <p className="text-gray-600">
              Choose how you'd like to track your website's search performance and visitor analytics.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Google Search Console Option */}
            <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200">
              <div 
                onClick={() => handleIntegrationSelect('google_search_console')}
                className="space-y-4"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Google Search Console
                    </h3>
                    <span className="text-sm text-blue-600 font-medium">Recommended</span>
                  </div>
                </div>

                <p className="text-gray-600">
                  Connect directly to Google Search Console to get comprehensive search performance data including:
                </p>

                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Search queries and rankings</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Click-through rates (CTR)</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Impressions and clicks</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Device and country breakdown</span>
                  </li>
                </ul>

                <div className="pt-2">
                  <Button className="w-full">
                    Connect with Google Search Console
                  </Button>
                </div>
              </div>
            </Card>

            {/* Manual Tracking Option */}
            <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200">
              <div 
                onClick={() => handleIntegrationSelect('manual_tracking')}
                className="space-y-4"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Manual Tracking
                    </h3>
                    <span className="text-sm text-purple-600 font-medium">Custom Setup</span>
                  </div>
                </div>

                <p className="text-gray-600">
                  Add a tracking script to your website for comprehensive visitor analytics and custom event tracking:
                </p>

                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Page views and sessions</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Custom event tracking</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>User behavior insights</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Real-time data collection</span>
                  </li>
                </ul>

                <div className="pt-2">
                  <Button variant="outline" className="w-full">
                    Set Up Manual Tracking
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {currentStep === 'setup' && (
        <div>
          <div className="mb-6 flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </Button>
          </div>

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
      )}
    </div>
  );
};

export default IntegrationSetupWizard;