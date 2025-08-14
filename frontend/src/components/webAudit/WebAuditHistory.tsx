/**
 * @file WebAuditHistory.tsx
 * @description Component for displaying web audit history
 *
 * Shows list of previous audits with scores, dates, and quick access.
 * Includes filtering, sorting, and comparison capabilities.
 */

import {
  Calendar,
  Clock,
  ExternalLink,
  History,
  RefreshCw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useCompany } from "../../contexts/CompanyContext";
import apiClient from "../../lib/apiClient";
import { AuditResult } from "../../pages/WebAuditPage";

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

interface WebAuditHistoryProps {
  onViewAudit: (result: AuditResult) => void;
}

const WebAuditHistory: React.FC<WebAuditHistoryProps> = ({ onViewAudit }) => {
  const [history, setHistory] = useState<AuditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "score" | "url">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const { selectedCompany } = useCompany();

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!selectedCompany?.id) {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      const response = await apiClient.get(
        `/web-audit/companies/${selectedCompany.id}/history`
      );
      setHistory(response.data.data.audits || []);
    } catch (error: unknown) {
      console.error("Failed to fetch audit history:", error);
      setError(
        error instanceof Error ? error.message : "Failed to load history"
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompany?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleViewAudit = async (auditId: string) => {
    try {
      const response = await apiClient.get(`/web-audit/${auditId}`);
      onViewAudit(response.data.data);
    } catch (error) {
      console.error("Failed to fetch audit details:", error);
      // TODO: Show error toast
    }
  };

  const handleDeleteAudit = async (auditId: string) => {
    if (!confirm("Are you sure you want to delete this audit?")) {
      return;
    }

    try {
      if (!selectedCompany?.id) throw new Error("No company selected");
      await apiClient.delete(
        `/web-audit/companies/${selectedCompany.id}/audits/${auditId}`
      );
      await fetchHistory();
    } catch (error) {
      console.error("Failed to delete audit:", error);
      // TODO: Show error toast
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400";
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    if (score >= 50) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number | null) => {
    if (score === null) return "bg-gray-100";
    if (score >= 90) return "bg-green-100";
    if (score >= 75) return "bg-yellow-100";
    if (score >= 50) return "bg-orange-100";
    return "bg-red-100";
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

  const formatUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
    } catch {
      return url;
    }
  };

  const sortedHistory = [...history].sort((a, b) => {
    let aValue: number | string, bValue: number | string;

    switch (sortBy) {
      case "date":
        aValue = new Date(a.requestedAt).getTime();
        bValue = new Date(b.requestedAt).getTime();
        break;
      case "score":
        aValue = a.scores.overall || 0;
        bValue = b.scores.overall || 0;
        break;
      case "url":
        aValue = a.url.toLowerCase();
        bValue = b.url.toLowerCase();
        break;
      default:
        return 0;
    }

    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-gray-600">Loading audit history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8">
        <div className="text-center space-y-4">
          <div className="p-3 bg-red-100 rounded-full inline-block">
            <History className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">
              Failed to Load History
            </h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={fetchHistory}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Audit History</h3>
              <p className="text-gray-600">
                {history.length} {history.length === 1 ? "audit" : "audits"}{" "}
                performed
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label
                htmlFor="sort-by"
                className="text-sm font-medium text-gray-700"
              >
                Sort by:
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "date" | "score" | "url")
                }
                className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date">Date</option>
                <option value="score">Score</option>
                <option value="url">URL</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
              >
                <TrendingUp
                  className={`w-4 h-4 text-gray-600 transition-transform ${
                    sortOrder === "desc" ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
            <button
              onClick={fetchHistory}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="divide-y divide-gray-200">
        {sortedHistory.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              No audits yet
            </h4>
            <p className="text-gray-600">
              Start your first web audit to see results here.
            </p>
          </div>
        ) : (
          sortedHistory.map((audit) => (
            <div
              key={audit.id}
              className="p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-medium text-gray-900 truncate">
                        {formatUrl(audit.url)}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(audit.requestedAt)}</span>
                        </div>
                        {audit.completedAt && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>
                              {Math.round(
                                (new Date(audit.completedAt).getTime() -
                                  new Date(audit.requestedAt).getTime()) /
                                  1000
                              )}
                              s
                            </span>
                          </div>
                        )}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            audit.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : audit.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {audit.status}
                        </span>
                      </div>
                    </div>

                    {audit.status === "completed" &&
                      audit.scores.overall !== null && (
                        <div className="flex items-center space-x-4">
                          {/* Individual Scores */}
                          <div className="flex items-center space-x-2">
                            {[
                              {
                                key: "performance",
                                label: "Perf",
                                score: audit.scores.performance,
                              },
                              {
                                key: "seo",
                                label: "SEO",
                                score: audit.scores.seo,
                              },
                              {
                                key: "geo",
                                label: "GEO",
                                score: audit.scores.geo,
                              },
                              {
                                key: "accessibility",
                                label: "A11y",
                                score: audit.scores.accessibility,
                              },
                              {
                                key: "security",
                                label: "Sec",
                                score: audit.scores.security,
                              },
                            ].map(({ key, label, score }) => (
                              <div key={key} className="text-center">
                                <div
                                  className={`text-xs font-medium ${getScoreColor(score)}`}
                                >
                                  {score ?? "--"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {label}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Overall Score */}
                          <div
                            className={`flex items-center justify-center w-12 h-12 rounded-full ${getScoreBgColor(audit.scores.overall)}`}
                          >
                            <span
                              className={`text-lg font-bold ${getScoreColor(audit.scores.overall)}`}
                            >
                              {audit.scores.overall}
                            </span>
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  {audit.status === "completed" && (
                    <button
                      onClick={() => handleViewAudit(audit.id)}
                      className="flex items-center space-x-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span className="text-sm">View</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAudit(audit.id)}
                    className="flex items-center space-x-1 bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WebAuditHistory;
