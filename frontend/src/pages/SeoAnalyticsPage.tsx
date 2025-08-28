/**
 * @file SeoAnalyticsPage.tsx
 * @description Website Analytics page matching Serplexity's minimal, tech-forward design system.
 * Clean interface for website performance metrics and integration management.
 */
import React, { useEffect, useState, useCallback } from "react";
import SeoRankingsAnalytics from "../components/analytics/SeoRankingsAnalytics";
import IntegrationSetupWizard from "../components/analytics/IntegrationSetupWizard";
import GSCPropertySelector from "../components/analytics/GSCPropertySelector";
import { useNavigation } from "../hooks/useNavigation";
import { useCompany } from "../hooks/useCompany";
import apiClient from "../lib/apiClient";

const SeoAnalyticsPage: React.FC = () => {
  const { setBreadcrumbs } = useNavigation();
  const { selectedCompany } = useCompany();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [hasIntegrations, setHasIntegrations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingIntegrationId, setPendingIntegrationId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "SEO Performance" }, { label: "SEO Rankings" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    const checkIntegrations = async () => {
      if (!selectedCompany) return;
      
      try {
        setIsLoading(true);
        console.log('[SeoAnalyticsPage] Checking GSC integrations...');
        const response = await apiClient.get("/website-analytics/integrations");
        const data = response.data;
        console.log('[SeoAnalyticsPage] Integration response:', data);
        const list = (data as { integrations?: unknown })?.integrations ?? data;
        
        if (Array.isArray(list)) {
          const gscIntegration = list.find(
            (i: { integrationName?: string; status?: string; id?: string }) =>
              i.integrationName === "google_search_console"
          );
          
          console.log('[SeoAnalyticsPage] GSC Integration found:', gscIntegration);
          
          if (gscIntegration) {
            if (gscIntegration.status === "active") {
              console.log('[SeoAnalyticsPage] GSC integration is active');
              setHasIntegrations(true);
              setPendingIntegrationId(null);
            } else if (gscIntegration.status === "pending_property_selection") {
              console.log('[SeoAnalyticsPage] GSC integration pending property selection');
              setHasIntegrations(false);
              setPendingIntegrationId(gscIntegration.id || null);
            } else {
              console.log('[SeoAnalyticsPage] GSC integration status:', gscIntegration.status);
              setHasIntegrations(false);
              setPendingIntegrationId(null);
            }
          } else {
            console.log('[SeoAnalyticsPage] No GSC integration found');
            setHasIntegrations(false);
            setPendingIntegrationId(null);
          }
        }
      } catch (error) {
        console.error("Failed to check GSC integrations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkIntegrations();
  }, [selectedCompany]);

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    setHasIntegrations(true);
  };

  const handlePropertySelectionComplete = () => {
    setHasIntegrations(true);
    setPendingIntegrationId(null);
  };

  const handlePropertySelectionCancel = () => {
    setPendingIntegrationId(null);
    setShowSetupWizard(true);
  };

  const handleSetupCancel = () => {
    setShowSetupWizard(false);
  };

  if (isLoading || !selectedCompany) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (pendingIntegrationId) {
    return (
      <div className="h-full flex flex-col">
        <GSCPropertySelector
          integrationId={pendingIntegrationId}
          onComplete={handlePropertySelectionComplete}
          onCancel={handlePropertySelectionCancel}
        />
      </div>
    );
  }

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
      <div className="flex-1 min-h-0">
        <SeoRankingsAnalytics onManageIntegrations={() => setShowSetupWizard(true)} />
      </div>
    </div>
  );
};

export default SeoAnalyticsPage;
