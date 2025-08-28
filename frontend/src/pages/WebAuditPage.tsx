/**
 * @file WebAuditPage.tsx
 * @description Web Audit page for comprehensive website analysis.
 * Provides website auditing including performance, SEO, GEO optimization,
 * accessibility, and security analysis with minimal, tech-forward UI.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - ../hooks/useNavigation: For breadcrumb navigation.
 * - ../contexts/CompanyContext: For company data and website URL.
 *
 * @exports
 * - WebAuditPage: The main web audit page component.
 */
import { Calendar, ChevronRight, ExternalLink, Info, Play } from "lucide-react";
import React, { useEffect, useState } from "react";
import FilterDropdown from "../components/dashboard/FilterDropdown";
import { InlineSpinner } from "../components/ui/InlineSpinner";
import LiquidGlassCard from "../components/ui/LiquidGlassCard";
import Tooltip from "../components/ui/Tooltip";
import WebAuditCategoryDetails from "../components/webAudit/WebAuditCategoryDetails";
import WebAuditProgress from "../components/webAudit/WebAuditProgress";
import WebAuditResults from "../components/webAudit/WebAuditResults";
import WebAuditScoreOverTimeCard from "../components/webAudit/WebAuditScoreOverTimeCard";
import { useCompany } from "../contexts/CompanyContext";
import { useAuth } from "../hooks/useAuth";
import { useEmbeddedPage } from "../hooks/useEmbeddedPage";
import { useNavigation } from "../hooks/useNavigation";
import { usePageCache } from "../hooks/usePageCache";
import apiClient from "../lib/apiClient";
import { getCompanyLogo } from "../lib/logoService";
// duplicate useCompany import removed

interface AuditConfig {
  url: string;
  includePerformance: boolean;
  includeSEO: boolean;
  includeGEO: boolean;
  includeAccessibility: boolean;
  includeSecurity: boolean;
}

export interface AuditResult {
  id: string;
  scores: {
    performance: number;
    seo: number;
    geo: number;
    accessibility: number;
    security: number;
    overall: number;
  };
  details: {
    performance?: unknown;
    seo?: unknown;
    geo?: unknown;
    accessibility?: unknown;
    security?: unknown;
  };
  recommendations: Array<{
    category: string;
    priority: string;
    title: string;
    description: string;
    impact: string;
    effort: string;
  }>;
  metadata: {
    analysisTime: number;
    url: string;
    timestamp: Date;
  };
}

interface CompetitorScoreItem {
  name: string;
  website: string;
  completedAt: string | null;
  scores: {
    overall: number;
    performance: number;
    seo: number;
    geo: number;
    security: number;
  } | null;
}

const CompetitorScoresList: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [items, setItems] = useState<CompetitorScoreItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  // No interval polling; parent triggers refresh on audit start

  const scoreColorClass = (score?: number | null): string => {
    if (typeof score !== "number") return "text-gray-600";
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const fetchScores = React.useCallback(async () => {
    if (!selectedCompany?.id) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get(
        `/web-audit/companies/${selectedCompany.id}/competitor-scores`
      );
      setItems(data.data.competitors || []);
    } catch {
      // silent fail in UI
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.id]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  // No interval polling; refreshed explicitly when user runs a new audit

  return (
    <div className="px-2 pb-2">
      {loading ? (
        <div className="text-sm text-gray-500 px-2 py-6 flex items-center justify-center">
          <InlineSpinner size={16} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-gray-500 px-2 py-6">
          No accepted competitors
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((c) => (
            <div
              key={c.website}
              className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-white/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={getCompanyLogo(c.website).url}
                  alt={`${c.name || c.website} logo`}
                  className="w-6 h-6 rounded object-contain bg-white/60 border border-white/40"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium text-gray-900 truncate"
                    title={c.name || c.website}
                  >
                    {c.name || c.website}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{c.website}</p>
                </div>
              </div>
              {c.scores ? (
                <div
                  className={`h-7 px-2 bg-white/60 backdrop-blur-sm border border-white/30 rounded-md text-xs font-semibold flex items-center ${scoreColorClass(c.scores.overall)}`}
                >
                  {c.scores.overall}
                </div>
              ) : (
                <div
                  className="h-7 px-2 bg-white/60 backdrop-blur-sm border border-white/30 rounded-md text-xs font-semibold flex items-center text-gray-400"
                  title="No score yet"
                >
                  —
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface AuditHistoryItem {
  id: string;
  url: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
  scores: {
    performance: number | null;
    seo: number | null;
    geo: number | null;
    accessibility: number | null;
    security: number | null;
    overall: number | null;
  };
}

const WebAuditPage: React.FC = () => {
  const { setBreadcrumbs } = useNavigation();
  const { selectedCompany, loading: companyLoading } = useCompany();
  const { user, isLoading: authLoading } = useAuth();
  // Clear audit result when navigating back to main page
  const handleNavigateBack = () => {
    setAuditResult(null);
    setCurrentAudit(null);
    setError(null);
  };

  const { embeddedPage, openEmbeddedPage, closeEmbeddedPage, isEmbedded } =
    useEmbeddedPage("Web Audit", handleNavigateBack);

  const [currentAudit, setCurrentAudit] = useState<{
    id: string;
    status: "queued" | "running" | "completed" | "failed";
    config: AuditConfig;
  } | null>(null);

  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditDetailsLoading, setAuditDetailsLoading] = useState(false);

  // Cache-aware audit history with 30 minute expiry (expensive to compute)
  const auditHistoryCache = usePageCache<AuditHistoryItem[]>({
    fetcher: async () => {
      if (!selectedCompany?.id) return [];
      
      console.log('[WebAuditPage] Fetching audit history...');
      
      try {
        const response = await apiClient.get(
          `/web-audit/companies/${selectedCompany.id}/history`
        );
        const audits = response.data.data.audits || [];
        console.log(`[WebAuditPage] Loaded ${audits.length} audit history items`);
        return audits;
      } catch (error) {
        console.error('[WebAuditPage] Failed to fetch audit history:', error);
        return [];
      }
    },
    pageType: 'web-audit',
    companyId: selectedCompany?.id || '',
    enabled: !!selectedCompany?.id,
    onDataLoaded: (data, isFromCache) => {
      console.log(`[WebAuditPage] History loaded ${isFromCache ? 'from cache' : 'fresh'}: ${data.length} items`);
    },
    onError: (error) => {
      console.error('[WebAuditPage] History cache error:', error);
    }
  });

  const history = auditHistoryCache.data || [];
  const historyLoading = auditHistoryCache.loading;
  // Settings removed; all analyses active by default
  const [_elapsedTime, setElapsedTime] = useState(0);
  const [dateRange, setDateRange] = useState<
    "24h" | "7d" | "30d" | "90d" | "1y"
  >("30d");

  // Analysis options with defaults
  const [auditOptions] = useState({
    includePerformance: true,
    includeSEO: true,
    includeGEO: true,
    includeAccessibility: true,
    includeSecurity: true,
  });

  // Set breadcrumbs
  useEffect(() => {
    if (!isEmbedded) {
      setBreadcrumbs([{ label: "Action Center" }, { label: "Web Audit" }]);
    }
  }, [setBreadcrumbs, isEmbedded]);


  // Track elapsed time for running audits
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentAudit) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
      setElapsedTime(0);
    };
  }, [currentAudit]);

  const dateRangeOptions = [
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "1y", label: "Last year" },
  ];

  const filterHistoryByDateRange = (
    items: AuditHistoryItem[],
    range: typeof dateRange
  ): AuditHistoryItem[] => {
    const now = new Date();
    const cutoff = new Date(now);
    switch (range) {
      case "24h":
        cutoff.setDate(now.getDate() - 1);
        break;
      case "7d":
        cutoff.setDate(now.getDate() - 7);
        break;
      case "30d":
        cutoff.setDate(now.getDate() - 30);
        break;
      case "90d":
        cutoff.setDate(now.getDate() - 90);
        break;
      case "1y":
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
      default:
        cutoff.setDate(now.getDate() - 30);
    }

    return (items || []).filter((it) => {
      const d = new Date(it.completedAt || it.requestedAt);
      return d >= cutoff;
    });
  };

  const filteredHistory = filterHistoryByDateRange(history, dateRange).sort(
    (a, b) =>
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );

  // Only plot the primary company's audits in the visibility score chart
  const normalizeUrl = (url?: string): string => {
    if (!url) return "";
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      // remove trailing slash
      return `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}`;
    } catch {
      return url.replace(/\/$/, "");
    }
  };
  const companyOnlyHistory = filteredHistory.filter(
    (h) => normalizeUrl(h.url) === normalizeUrl(selectedCompany?.website)
  );

  const startAudit = async () => {
    if (!selectedCompany?.website) {
      setError(
        "No website URL found for this company. Please add a website URL in company settings."
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post(
        `/web-audit/companies/${selectedCompany.id}/start?fanout=accepted`,
        {
          url: selectedCompany.website,
          ...auditOptions,
        }
      );

      const data = response.data;

      setCurrentAudit({
        id: data.data.auditId,
        status: "queued",
        config: {
          url: selectedCompany.website,
          ...auditOptions,
        },
      });

      // Navigate to Audit Details immediately to show progress
      openEmbeddedPage("audit-details", "Audit Details");

      // Start polling for status
      pollAuditStatus(data.data.auditId);

      // Invalidate cache since we've started a new audit
      auditHistoryCache.invalidate();

      // Trigger competitor scores refresh after starting audits
      try {
        await apiClient.get(
          `/web-audit/companies/${selectedCompany.id}/competitor-scores`
        );
      } catch {}
    } catch (error) {
      console.error("Failed to start audit:", error);
      setError(
        error instanceof Error ? error.message : "Failed to start audit"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Delegate polling to WebAuditProgress to avoid duplicate polling/limits
  const pollAuditStatus = async (_auditId: string) => {};

  const handleNewAudit = () => {
    if (isEmbedded) {
      closeEmbeddedPage(); // This will call handleNavigateBack which clears the state
    } else {
      // Clear state if not embedded
      setCurrentAudit(null);
      setAuditResult(null);
      setError(null);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const getDomainFromUrl = (url: string) => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  };

  const formatDuration = (
    start?: Date | string | null,
    end?: Date | string | null
  ): string | null => {
    if (!start || !end) return null;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
    const totalSeconds = Math.floor((e - s) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  // Show loading state while authentication or company data is loading
  if (authLoading || companyLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <InlineSpinner size={32} />
        </div>
      </div>
    );
  }

  // Require authentication
  if (!user) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-gray-600">Please log in to access web audits.</p>
        </div>
      </div>
    );
  }

  // Require company selection
  if (!selectedCompany) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-gray-600">
            Please select a company to run web audits.
          </p>
        </div>
      </div>
    );
  }

  // Render embedded audit details page (progress or results)
  if (isEmbedded && embeddedPage === "audit-details") {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 p-1 relative">
          {currentAudit ? (
            <WebAuditProgress
              auditId={currentAudit.id}
              config={currentAudit.config}
              onComplete={(result) => {
                setAuditResult(result as unknown as AuditResult);
                setCurrentAudit(null);
                fetchHistory();
              }}
              onError={() => setCurrentAudit(null)}
            />
          ) : auditDetailsLoading ? (
            <div className="h-full flex items-center justify-center">
              <InlineSpinner size={24} />
            </div>
          ) : auditResult ? (
            <WebAuditResults
              result={auditResult}
              onNewAudit={handleNewAudit}
              onOpenCategory={(key, label) => {
                openEmbeddedPage(`audit-${key}`, [
                  {
                    label: "Audit Details",
                    onClick: () =>
                      openEmbeddedPage("audit-details", "Audit Details"),
                  },
                  label,
                ]);
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <InlineSpinner size={24} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Category embedded pages
  if (
    isEmbedded &&
    embeddedPage &&
    auditResult &&
    embeddedPage.startsWith("audit-")
  ) {
    const key = embeddedPage.replace("audit-", "") as
      | "overall"
      | "performance"
      | "seo"
      | "geo"
      | "security";
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 p-1 relative">
          <WebAuditCategoryDetails categoryKey={key} result={auditResult} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar aligned like Sentiment/SentimentAnalysis */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-2 px-1">
        <div className="flex items-center gap-2">
          <FilterDropdown
            label="Date Range"
            value={dateRange}
            options={dateRangeOptions}
            onChange={(value) => setDateRange(value as typeof dateRange)}
            icon={Calendar}
            className="w-auto"
            disabled={isLoading || !!currentAudit}
          />
          <button
            onClick={startAudit}
            disabled={isLoading || !!currentAudit || !selectedCompany?.website}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md text-gray-900 hover:bg-white/85 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-black"
          >
            {isLoading || currentAudit ? (
              <>
                <InlineSpinner size={16} />
                <span className="text-sm">
                  {currentAudit ? "Running..." : "Starting..."}
                </span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span className="text-sm">Run Audit</span>
              </>
            )}
          </button>
        </div>
        <div className="ml-0 lg:ml-4">
          {selectedCompany?.website ? (
            <a
              href={selectedCompany.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-black/80"
              title={selectedCompany.website}
            >
              <span className="truncate max-w-[48ch]">
                {selectedCompany.website}
              </span>
              <ExternalLink className="w-4 h-4" />
            </a>
          ) : (
            <span className="text-sm text-gray-500">
              No website URL configured
            </span>
          )}
        </div>
      </div>

      {/* Content area aligned with dashboard pages */}
      <div className="flex-1 min-h-0 p-1 relative">
        <div className="h-full w-full">
          {/* Settings removed */}

          {/* Error Message */}
          {error && (
            <LiquidGlassCard className="border-red-200">
              <p className="text-red-700 text-sm">{error}</p>
            </LiquidGlassCard>
          )}

          {/* Current Audit Progress (shown inline only when not embedded) */}
          {currentAudit && !isEmbedded && (
            <WebAuditProgress
              auditId={currentAudit.id}
              config={currentAudit.config}
              onComplete={(result) => {
                setAuditResult(result as unknown as AuditResult);
                setCurrentAudit(null);
                fetchHistory();
              }}
              onError={() => setCurrentAudit(null)}
            />
          )}

          {/* Desktop grid modeled after SentimentAnalysisPage: left (32 cols) + right (16 cols), history below */}
          <div
            className="hidden lg:grid h-full w-full gap-4"
            style={{
              gridTemplateColumns: "repeat(48, 1fr)",
              gridTemplateRows: "repeat(14, minmax(30px, 1fr))",
              gridTemplateAreas: `
                "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
                "d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 d1 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2 s2"
              `,
            }}
          >
            <div style={{ gridArea: "s1" }}>
              <WebAuditScoreOverTimeCard
                history={companyOnlyHistory}
                dateRange={dateRange}
                loading={historyLoading}
              />
            </div>
            <div style={{ gridArea: "s2" }}>
              <LiquidGlassCard className="h-full">
                <div className="h-full min-h-0 overflow-y-auto">
                  <div className="sticky top-0 z-10 px-2 py-2 bg-white/70 backdrop-blur-sm border-b border-white/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-0.5">
                        <h3 className="text-sm font-medium text-gray-900">
                          Competitor Visibility
                        </h3>
                        <Tooltip
                          content={
                            <span>
                              <strong>Competitor Visibility</strong>: latest
                              overall audit scores for accepted competitors.
                              Compare standings at a glance and identify leaders
                              and laggards.
                            </span>
                          }
                        >
                          <span
                            aria-label="What this section means"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/40 bg-white/70 text-gray-700 align-super -translate-y-0.5 md:-translate-y-1"
                          >
                            <Info className="h-3 w-3" />
                          </span>
                        </Tooltip>
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 pl-6 ml-auto pr-2">
                        Score
                      </h4>
                    </div>
                  </div>
                  <CompetitorScoresList />
                </div>
              </LiquidGlassCard>
            </div>
            <div style={{ gridArea: "d1" }}>
              <LiquidGlassCard className="h-full">
                <div className="h-full min-h-0 overflow-y-auto">
                  <div className="sticky top-0 z-10 px-2 py-2 bg-white/70 backdrop-blur-sm border-b border-white/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-0.5">
                        <h3 className="text-sm font-medium text-gray-900">
                          Recent Audits{" "}
                          <span className="font-normal">
                            ({companyOnlyHistory.length})
                          </span>
                        </h3>
                        <Tooltip
                          content={
                            <span>
                              <strong>Recent Audits</strong>: the most recent
                              audit runs for your primary domain. Click any item
                              to open full details.
                            </span>
                          }
                        >
                          <span
                            aria-label="What this section means"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/40 bg-white/70 text-gray-700 align-super -translate-y-0.5 md:-translate-y-1"
                          >
                            <Info className="h-3 w-3" />
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                  {historyLoading ? (
                    <div className="p-10 text-center">
                      <InlineSpinner size={24} />
                    </div>
                  ) : companyOnlyHistory.length === 0 ? (
                    <div className="h-[calc(100%-40px)] flex items-center justify-center px-2 py-6 text-center">
                      <span className="text-sm text-gray-500">
                        No completed audits yet.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {companyOnlyHistory.map((audit) => (
                        <button
                          type="button"
                          key={audit.id}
                          className="group w-full text-left p-1 rounded-xl focus:outline-none focus:ring-0 transition-transform active:translate-y-[1px]"
                          onClick={async () => {
                            setError(null);
                            setCurrentAudit(null);
                            setAuditResult(null);
                            setAuditDetailsLoading(true);
                            openEmbeddedPage("audit-details", "Audit Details");
                            try {
                              const { data } = await apiClient.get(
                                `/web-audit/${audit.id}`
                              );
                              setAuditResult(data.data);
                            } catch (e) {
                              console.error("Failed to open audit result", e);
                            } finally {
                              setAuditDetailsLoading(false);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl shadow-md hover:bg-white/85 transition-colors p-2 group-active:translate-y-[1px] group-active:bg-white/60 group-active:border-white/30 group-active:shadow-inner">
                            {audit.status !== "completed" && (
                              <span
                                className={`inline-block w-2.5 h-2.5 rounded-full ${
                                  audit.status === "failed"
                                    ? "bg-red-500"
                                    : audit.status === "running" ||
                                        audit.status === "queued"
                                      ? "bg-yellow-400"
                                      : "bg-gray-300"
                                }`}
                                title={audit.status}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium text-gray-900 truncate"
                                title={audit.url}
                              >
                                {getDomainFromUrl(audit.url)}
                              </p>
                              <div className="flex items-center gap-2 mt-0 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(audit.requestedAt)}</span>
                                </div>
                                {audit.completedAt && (
                                  <span className="text-gray-400">
                                    {formatDuration(
                                      audit.requestedAt,
                                      audit.completedAt
                                    ) || ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            {audit.status === "completed" && (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-500">
                                    Perf
                                  </span>
                                  <span
                                    className={`h-6 px-1.5 bg-white/60 border border-white/30 rounded text-[11px] font-semibold flex items-center ${getScoreColor(audit.scores.performance ?? 0)}`}
                                  >
                                    {audit.scores.performance ?? 0}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-500">
                                    SEO
                                  </span>
                                  <span
                                    className={`h-6 px-1.5 bg-white/60 border border-white/30 rounded text-[11px] font-semibold flex items-center ${getScoreColor(audit.scores.seo ?? 0)}`}
                                  >
                                    {audit.scores.seo ?? 0}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-500">
                                    GEO
                                  </span>
                                  <span
                                    className={`h-6 px-1.5 bg-white/60 border border-white/30 rounded text-[11px] font-semibold flex items-center ${getScoreColor(audit.scores.geo ?? 0)}`}
                                  >
                                    {audit.scores.geo ?? 0}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-gray-500">
                                    Sec
                                  </span>
                                  <span
                                    className={`h-6 px-1.5 bg-white/60 border border-white/30 rounded text-[11px] font-semibold flex items-center ${getScoreColor(audit.scores.security ?? 0)}`}
                                  >
                                    {audit.scores.security ?? 0}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 pl-1.5">
                                  <span className="text-[11px] text-gray-500">
                                    Overall
                                  </span>
                                  <span
                                    className={`h-6 px-1.5 bg-white/60 border border-white/30 rounded text-[11px] font-semibold flex items-center ${getScoreColor(audit.scores.overall ?? 0)}`}
                                  >
                                    {audit.scores.overall ?? 0}
                                  </span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </LiquidGlassCard>
            </div>
          </div>

          {/* Mobile/tablet: chart only */}
          <div className="lg:hidden">
            <WebAuditScoreOverTimeCard
              history={filteredHistory}
              dateRange={dateRange}
              minHeight={90}
              loading={historyLoading}
            />
          </div>

          {/* Results - only show inline if not embedded */}
          {auditResult && !isEmbedded && (
            <WebAuditResults
              result={auditResult}
              onNewAudit={handleNewAudit}
              onOpenCategory={(key, label) => {
                openEmbeddedPage(`audit-${key}`, `${label}`);
              }}
            />
          )}

          {/* History block is now rendered in desktop grid area d1 above */}
        </div>
      </div>
    </div>
  );
};

export default WebAuditPage;
