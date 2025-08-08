/**
 * @file WebAuditInitiator.tsx
 * @description Component for starting new web audits
 *
 * Provides URL input, analysis options selection, and audit initiation.
 * Includes form validation and error handling.
 */

import { AlertCircle, CheckCircle2, Globe, Play, Settings } from "lucide-react";
import React, { useState } from "react";
import { useCompany } from "../../contexts/CompanyContext";
import apiClient from "../../lib/apiClient";
import { AuditConfig } from "../../pages/WebAuditPage";

interface WebAuditInitiatorProps {
  onAuditStart: (auditId: string, config: AuditConfig) => void;
}

const WebAuditInitiator: React.FC<WebAuditInitiatorProps> = ({
  onAuditStart,
}) => {
  const { selectedCompany } = useCompany();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Analysis options
  const [includePerformance, setIncludePerformance] = useState(true);
  const [includeSEO, setIncludeSEO] = useState(true);
  const [includeGEO, setIncludeGEO] = useState(true);
  const [includeAccessibility, setIncludeAccessibility] = useState(true);
  const [includeSecurity, setIncludeSecurity] = useState(true);

  const validateUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const normalizeUrl = (url: string): string => {
    // Add https:// if no protocol is specified
    if (!url.match(/^https?:\/\//)) {
      return `https://${url}`;
    }
    return url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Please enter a website URL");
      return;
    }

    const normalizedUrl = normalizeUrl(url.trim());

    if (!validateUrl(normalizedUrl)) {
      setError("Please enter a valid website URL (e.g., https://example.com)");
      return;
    }

    // Check if at least one analysis type is selected
    const hasAnalysisType =
      includePerformance ||
      includeSEO ||
      includeGEO ||
      includeAccessibility ||
      includeSecurity;
    if (!hasAnalysisType) {
      setError("Please select at least one analysis type");
      return;
    }

    setIsLoading(true);

    try {
      if (!selectedCompany?.id) {
        throw new Error("Please select a company first");
      }

      const config: AuditConfig = {
        url: normalizedUrl,
        includePerformance,
        includeSEO,
        includeGEO,
        includeAccessibility,
        includeSecurity,
      };

      // Make API call to start audit (company-scoped)
      const response = await apiClient.post(
        `/web-audit/companies/${selectedCompany.id}/start`,
        config
      );

      // Call parent handler with audit ID and config
      onAuditStart(response.data.data.auditId, config);
    } catch (error) {
      console.error("Failed to start audit:", error);
      setError(
        error instanceof Error ? error.message : "Failed to start audit"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const analysisOptions = [
    {
      key: "performance",
      label: "Performance",
      description:
        "Core Web Vitals, load times, and optimization opportunities",
      checked: includePerformance,
      onChange: setIncludePerformance,
      color: "orange",
      icon: "⚡",
    },
    {
      key: "seo",
      label: "SEO",
      description: "Technical SEO, meta tags, and search engine optimization",
      checked: includeSEO,
      onChange: setIncludeSEO,
      color: "green",
      icon: "🔍",
    },
    {
      key: "geo",
      label: "GEO Optimization",
      description: "AI search engine optimization and structured data",
      checked: includeGEO,
      onChange: setIncludeGEO,
      color: "purple",
      icon: "🤖",
    },
    {
      key: "accessibility",
      label: "Accessibility",
      description: "WCAG compliance and inclusive design assessment",
      checked: includeAccessibility,
      onChange: setIncludeAccessibility,
      color: "blue",
      icon: "♿",
    },
    {
      key: "security",
      label: "Security",
      description: "HTTPS, security headers, and vulnerability detection",
      checked: includeSecurity,
      onChange: setIncludeSecurity,
      color: "red",
      icon: "🔒",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Start Web Audit</h2>
              <p className="text-blue-100">
                Analyze any website for performance, SEO, accessibility, and
                more
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <label
              htmlFor="url"
              className="block text-sm font-medium text-gray-700"
            >
              Website URL
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Globe className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                disabled={isLoading}
              />
            </div>
            <p className="text-sm text-gray-500">
              Enter the full URL of the website you want to audit
            </p>
          </div>

          {/* Analysis Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Analysis Options
              </h3>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm">
                  {showAdvanced ? "Hide" : "Show"} Options
                </span>
              </button>
            </div>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                {analysisOptions.map((option) => (
                  <label
                    key={option.key}
                    className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-white transition-colors"
                  >
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={option.checked}
                        onChange={(e) => option.onChange(e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{option.icon}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {option.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {option.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {!showAdvanced && (
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>
                    All analysis types selected (Performance, SEO, GEO,
                    Accessibility, Security)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-4 px-6 rounded-xl transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Starting Audit...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Start Web Audit</span>
                </>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="text-center text-sm text-gray-500 pt-2">
            <p>
              Typical audit takes 2-3 minutes to complete. You can view results
              and history below.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WebAuditInitiator;
