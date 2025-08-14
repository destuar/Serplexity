/**
 * @file SeoAnalyticsPage.tsx
 * @description Website Analytics page matching Serplexity's minimal, tech-forward design system.
 * Clean interface for website performance metrics and integration management.
 */
import React, { useEffect, useState } from "react";
import AnalyticsDashboard from "../components/analytics/AnalyticsDashboard";
import IntegrationSetupWizard from "../components/analytics/IntegrationSetupWizard";
import { useNavigation } from "../hooks/useNavigation";

const SeoAnalyticsPage: React.FC = () => {
  const { setBreadcrumbs } = useNavigation();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [hasIntegrations, setHasIntegrations] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "SEO Performance" }, { label: "SEO Rankings" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const response = await fetch("/api/website-analytics/integrations");
        if (response.ok) {
          const data = await response.json();
          const list =
            (data as { integrations?: unknown })?.integrations ?? data;
          setHasIntegrations(
            Array.isArray(list)
              ? list.some(
                  (i: { integrationName?: string; status?: string }) =>
                    i.integrationName === "google_search_console" &&
                    i.status === "active"
                )
              : false
          );
        }
      } catch {
        // ignore
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
          mode="gsc"
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
          mode="gsc"
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
          <h1 className="text-xl font-medium text-gray-900">SEO Rankings</h1>
          <p className="text-sm text-gray-600">
            Google Search Console metrics: queries, clicks, impressions,
            positions
          </p>
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
