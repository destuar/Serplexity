/**
 * @file SeoAnalyticsPage.tsx
 * @description Website Analytics page matching Serplexity's minimal, tech-forward design system.
 * Clean interface for website performance metrics and integration management.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import GSCPropertySelector from "../components/analytics/GSCPropertySelector";
import IntegrationSetupWizard from "../components/analytics/IntegrationSetupWizard";
import SeoRankingsAnalytics from "../components/analytics/SeoRankingsAnalytics";
import { InlineSpinner } from "../components/ui/InlineSpinner";
import { useCompany } from "../hooks/useCompany";
import { useNavigation } from "../hooks/useNavigation";
import { usePageCache } from "../hooks/usePageCache";
import apiClient from "../lib/apiClient";

interface IntegrationStatus {
  hasIntegrations: boolean;
  pendingIntegrationId: string | null;
}

const SeoAnalyticsPage: React.FC = () => {
  const { setBreadcrumbs } = useNavigation();
  const { selectedCompany } = useCompany();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  // Track component mount state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Set breadcrumbs; no cleanup needed here
  useEffect(() => {
    setBreadcrumbs([{ label: "SEO Performance" }, { label: "SEO Rankings" }]);
  }, [setBreadcrumbs]);

  // Mark component as unmounted only on true unmount
  useEffect(() => {
    // On first client mount, mark as ready and mounted
    isMountedRef.current = true;
    setClientReady(true);
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const integrationIdParam = searchParams.get("integrationId");

  // Cache-aware integration status checking (30 minute cache - integrations don't change often)
  const integrationCache = usePageCache<IntegrationStatus>({
    fetcher: async (): Promise<IntegrationStatus> => {
      if (!selectedCompany?.id) {
        throw new Error("No company selected");
      }

      console.log("[SeoAnalyticsPage] Checking GSC integrations...");

      // Proceed without throwing on transient unmounts; hook handles cancellations

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("[SeoAnalyticsPage] Request timeout, aborting...");
        controller.abort();
      }, 10000); // 10 second timeout

      try {
        const response = await apiClient.get(
          `/website-analytics/companies/${selectedCompany.id}/integrations`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        // Don't throw on transient unmounts; allow caching for next mount

        const data = response.data;
        console.log("[SeoAnalyticsPage] Integration response:", data);
        const list = (data as { integrations?: unknown })?.integrations ?? data;

        if (Array.isArray(list)) {
          const gscIntegration = list.find(
            (i: { integrationName?: string; status?: string; id?: string }) =>
              i.integrationName === "google_search_console"
          );

          console.log(
            "[SeoAnalyticsPage] GSC Integration found:",
            gscIntegration
          );

          if (gscIntegration) {
            if (gscIntegration.status === "active") {
              console.log("[SeoAnalyticsPage] GSC integration is active");
              return {
                hasIntegrations: true,
                pendingIntegrationId: null,
              };
            } else if (gscIntegration.status === "pending_property_selection") {
              console.log(
                "[SeoAnalyticsPage] GSC integration pending property selection"
              );
              return {
                hasIntegrations: false,
                pendingIntegrationId: gscIntegration.id || null,
              };
            } else {
              console.log(
                "[SeoAnalyticsPage] GSC integration status:",
                gscIntegration.status
              );
              return {
                hasIntegrations: false,
                pendingIntegrationId: null,
              };
            }
          } else {
            console.log("[SeoAnalyticsPage] No GSC integration found");
            return {
              hasIntegrations: false,
              pendingIntegrationId: null,
            };
          }
        }

        // Default case - no integrations
        console.log(
          "[SeoAnalyticsPage] No integrations array found, assuming no integrations"
        );
        return {
          hasIntegrations: false,
          pendingIntegrationId: null,
        };
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        const err = error as Error;
        if (err.name === "AbortError") {
          console.error("[SeoAnalyticsPage] Integration check aborted");
          // Swallow aborts and let hook treat as cancellation
          throw err;
        }
        // Do not throw for unmount-related timing; just log and return fallback
        if (
          typeof err.message === "string" &&
          err.message.toLowerCase().includes("component unmounted")
        ) {
          console.log(
            "[SeoAnalyticsPage] Unmount timing during integrations fetch, returning fallback"
          );
          return {
            hasIntegrations: false,
            pendingIntegrationId: null,
          };
        }
        console.error("[SeoAnalyticsPage] Integration check failed:", error);
        throw error;
      }
    },
    pageType: "seo-analytics",
    companyId: selectedCompany?.id || "",
    enabled: !!selectedCompany?.id,
  });

  // Derived data from cache
  const integrationStatus = useMemo(
    () => integrationCache.data,
    [integrationCache.data]
  );
  const hasIntegrations = integrationStatus?.hasIntegrations ?? false;
  const pendingIntegrationId = hasIntegrations
    ? null
    : integrationStatus?.pendingIntegrationId || integrationIdParam || null;

  // Handle loading state; don't treat transient errors as wizard triggers
  const isLoading = integrationCache.loading && !integrationCache.error;

  // Show wizard only when we truly have no integration and no pending selection
  const shouldShowSetupWizard =
    showSetupWizard ||
    (!hasIntegrations && !pendingIntegrationId && !isLoading);

  // Debug current decision state
  useEffect(() => {
    console.log("[SeoAnalyticsPage] State:", {
      companyId: selectedCompany?.id,
      clientReady,
      loading: integrationCache.loading,
      error: integrationCache.error?.message,
      hasIntegrations,
      pendingIntegrationId,
      showSetupWizard,
      shouldShowSetupWizard,
      hasStatusObject: Boolean(integrationStatus),
    });
  }, [
    selectedCompany?.id,
    clientReady,
    integrationCache.loading,
    integrationCache.error,
    hasIntegrations,
    pendingIntegrationId,
    showSetupWizard,
    shouldShowSetupWizard,
    integrationStatus,
  ]);

  // Data is now handled by cache above - no manual fetching needed

  const handleSetupComplete = () => {
    if (!isMountedRef.current) return;
    setShowSetupWizard(false);
    // Invalidate cache to refresh integration status
    integrationCache.invalidate();
    void integrationCache.refresh();
  };

  const handlePropertySelectionComplete = () => {
    if (!isMountedRef.current) return;
    // Remove integrationId from URL so we don't force selector again after activation
    const next = new URLSearchParams(searchParams);
    next.delete("integrationId");
    setSearchParams(next, { replace: true });
    // Invalidate and actively refresh integration status
    integrationCache.invalidate();
    void integrationCache.refresh();
  };

  const handlePropertySelectionCancel = () => {
    if (!isMountedRef.current) return;
    setShowSetupWizard(true);
  };

  const handleSetupCancel = () => {
    if (!isMountedRef.current) return;
    setShowSetupWizard(false);
  };

  if (!selectedCompany) {
    return (
      <div className="h-full flex items-center justify-center">
        <InlineSpinner size={20} />
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

  if (shouldShowSetupWizard) {
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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <InlineSpinner size={20} />
      </div>
    );
  }

  if (!hasIntegrations && !isLoading) {
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

  // Final safety fallback to avoid blank screen in unexpected states
  if (!integrationStatus && !isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600">
            No integration status available.
          </p>
          <button
            onClick={() => setShowSetupWizard(true)}
            className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-sm font-medium hover:bg-white/85"
          >
            Open Setup Wizard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <SeoRankingsAnalytics
          onManageIntegrations={() => setShowSetupWizard(true)}
        />
      </div>
    </div>
  );
};

export default SeoAnalyticsPage;
