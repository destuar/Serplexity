/**
 * @file SeoAnalyticsPage.tsx
 * @description Website Analytics page matching Serplexity's minimal, tech-forward design system.
 * Clean interface for website performance metrics and integration management.
 */
import React, { useEffect, useState } from "react";
import { useNavigation } from "../hooks/useNavigation";
import IntegrationSetupWizard from "../components/analytics/IntegrationSetupWizard";
import AnalyticsDashboard from "../components/analytics/AnalyticsDashboard";

const SeoAnalyticsPage: React.FC = () => {
  const { setBreadcrumbs } = useNavigation();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [hasIntegrations, setHasIntegrations] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: 'SEO Performance' },
      { label: 'Website Analytics' }
    ]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const response = await fetch('/api/website-analytics/integrations');
        if (response.ok) {
          const integrations = await response.json();
          setHasIntegrations(integrations.length > 0);
        }
      } catch (error) {
        console.error('Failed to check integrations:', error);
      }
    };
    
    checkIntegrations();
  }, []);

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    setHasIntegrations(true);
  };

  const handleSetupCancel = () => {
    setShowSetupWizard(false);
  };

  if (showSetupWizard) {
    return (
      <div className="h-full flex flex-col">
        <IntegrationSetupWizard
          onComplete={handleSetupComplete}
          onCancel={handleSetupCancel}
        />
      </div>
    );
  }

  if (!hasIntegrations) {
    return (
      <div className="h-full flex flex-col">
        <IntegrationSetupWizard
          onComplete={handleSetupComplete}
          onCancel={handleSetupCancel}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Website Analytics</h1>
          <p className="text-sm text-gray-600">Performance metrics and insights</p>
        </div>
        <button
          onClick={() => setShowSetupWizard(true)}
          className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black transition-colors text-sm"
        >
          Manage
        </button>
      </div>
      
      <div className="flex-1 min-h-0">
        <AnalyticsDashboard />
      </div>
    </div>
  );
};

export default SeoAnalyticsPage;