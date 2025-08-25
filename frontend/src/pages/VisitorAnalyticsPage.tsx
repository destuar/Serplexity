/**
 * @file VisitorAnalyticsPage.tsx
 * @description Web Analytics (GA4) page for visitor and engagement metrics
 */

import React, { useEffect, useState } from "react";
import IntegrationSetupWizard from "../components/analytics/IntegrationSetupWizard";
import { useNavigation } from "../hooks/useNavigation";
import { useCompany } from "../hooks/useCompany";
import apiClient from "../lib/apiClient";

interface Ga4Metrics {
  sessions: number;
  totalUsers: number;
  screenPageViews: number;
  averageSessionDuration: number;
  bounceRate: number;
  topPages: Array<{ pagePath: string; views: number; users: number }>;
}

const VisitorAnalyticsPage: React.FC = () => {
  const { setBreadcrumbs } = useNavigation();
  const { selectedCompany } = useCompany();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [hasIntegrations, setHasIntegrations] = useState(false);
  const [metrics, setMetrics] = useState<Ga4Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setBreadcrumbs([{ label: "SEO Performance" }, { label: "Web Analytics" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    const checkIntegrations = async () => {
      if (!selectedCompany) {
        console.log("No company selected yet, waiting...");
        return;
      }
      
      try {
        setIsLoading(true);
        const res = await apiClient.get("/website-analytics/integrations");
        const data = res.data;
        const list = (data as { integrations?: unknown })?.integrations ?? data; // tolerate either shape
        const hasGa4 = Array.isArray(list)
          ? list.some(
              (i: { integrationName?: string; status?: string }) =>
                i.integrationName === "google_analytics_4" &&
                i.status === "active"
            )
          : false;
        setHasIntegrations(hasGa4);
        if (hasGa4) {
          await fetchMetrics();
        }
      } catch (error) {
        console.error("Failed to check integrations:", error);
        // Don't show setup wizard if we can't check - safer to assume no integration
      } finally {
        setIsLoading(false);
      }
    };
    checkIntegrations();
  }, [selectedCompany]);

  const fetchMetrics = async () => {
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        startDate: start.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
      });
      const res = await apiClient.get(
        `/website-analytics/ga4/metrics?${params.toString()}`
      );
      const data = res.data;
      // tolerate shapes {metrics: {...}} or {...}
      setMetrics(data.metrics ?? data);
    } catch (error) {
      console.error("Failed to fetch GA4 metrics:", error);
      // Show empty state but don't fail the page
    }
  };

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    setHasIntegrations(true);
    fetchMetrics();
  };

  // Show loading state while waiting for company selection or integration check
  if (isLoading || !selectedCompany) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (showSetupWizard || !hasIntegrations) {
    return (
      <div className="h-full flex flex-col">
        <IntegrationSetupWizard
          mode="ga4"
          onComplete={handleSetupComplete}
          onCancel={() => setShowSetupWizard(false)}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Web Analytics</h1>
          <p className="text-sm text-gray-600">
            Google Analytics 4: sessions, users, page views, engagement
          </p>
        </div>
        <button
          onClick={() => setShowSetupWizard(true)}
          className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md hover:bg-white/85 focus:outline-none focus:ring-2 focus:ring-black transition-colors text-sm"
        >
          Manage
        </button>
      </div>

      {!metrics ? (
        <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-8 text-center">
          <p className="text-sm text-gray-600">
            Data will appear once your GA4 integration is active.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-5 gap-4">
            <StatCard label="Sessions" value={metrics.sessions} />
            <StatCard label="Users" value={metrics.totalUsers} />
            <StatCard label="Page Views" value={metrics.screenPageViews} />
            <StatCard
              label="Avg Session (s)"
              value={Number(metrics.averageSessionDuration.toFixed(0))}
            />
            <StatCard
              label="Bounce Rate (%)"
              value={Number(metrics.bounceRate.toFixed(1))}
            />
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md">
            <div className="px-4 py-3 border-b border-white/20">
              <h3 className="text-sm font-medium text-gray-900">Top Pages</h3>
            </div>
            <div className="p-4 space-y-3">
              {metrics.topPages.slice(0, 10).map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_5rem_5rem] gap-3 items-center text-xs"
                >
                  <div className="text-gray-900 truncate" title={p.pagePath}>
                    {p.pagePath}
                  </div>
                  <div className="text-gray-600 text-right">{p.views}</div>
                  <div className="text-gray-600 text-right">{p.users}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md p-4">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className="text-lg font-medium text-gray-900">{value}</div>
  </div>
);

export default VisitorAnalyticsPage;
