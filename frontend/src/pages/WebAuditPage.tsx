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
import React, { useEffect, useState } from "react";
import { useNavigation } from "../hooks/useNavigation";
import { useCompany } from "../contexts/CompanyContext";
import { useAuth } from "../hooks/useAuth";
import apiClient from "../lib/apiClient";
import { Gauge, Search, Globe, Shield, Eye, Settings, RefreshCw, Play, Loader2, ChevronDown, ChevronRight, ExternalLink, Calendar, Clock, Trash2 } from "lucide-react";

interface AuditConfig {
  url: string;
  includePerformance: boolean;
  includeSEO: boolean;
  includeGEO: boolean;
  includeAccessibility: boolean;
  includeSecurity: boolean;
}

interface AuditResult {
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
    performance?: any;
    seo?: any;
    geo?: any;
    accessibility?: any;
    security?: any;
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
  
  const [currentAudit, setCurrentAudit] = useState<{
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    config: AuditConfig;
  } | null>(null);
  
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [history, setHistory] = useState<AuditHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Analysis options with defaults
  const [auditOptions, setAuditOptions] = useState({
    includePerformance: true,
    includeSEO: true,
    includeGEO: true,
    includeAccessibility: true,
    includeSecurity: true,
  });

  // Set breadcrumbs
  useEffect(() => {
    setBreadcrumbs([
      { label: 'Action Center' },
      { label: 'Web Audit' }
    ]);
  }, [setBreadcrumbs]);

  // Fetch audit history when selectedCompany is available
  useEffect(() => {
    if (selectedCompany?.id) {
      fetchHistory();
    }
  }, [selectedCompany?.id]);

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

  const fetchHistory = async () => {
    if (!selectedCompany?.id) return;
    
    try {
      const response = await apiClient.get(`/web-audit/companies/${selectedCompany.id}/history`);
      setHistory(response.data.data.audits || []);
    } catch (error) {
      console.error('Failed to fetch audit history:', error);
    }
  };

  const startAudit = async () => {
    if (!selectedCompany?.website) {
      setError('No website URL found for this company. Please add a website URL in company settings.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.post(`/web-audit/companies/${selectedCompany.id}/start`, {
        url: selectedCompany.website,
        ...auditOptions,
      });

      const data = response.data;

      setCurrentAudit({
        id: data.data.auditId,
        status: 'queued',
        config: {
          url: selectedCompany.website,
          ...auditOptions,
        },
      });

      // Start polling for status
      pollAuditStatus(data.data.auditId);

    } catch (error) {
      console.error('Failed to start audit:', error);
      setError(error instanceof Error ? error.message : 'Failed to start audit');
    } finally {
      setIsLoading(false);
    }
  };

  const pollAuditStatus = async (auditId: string) => {
    const poll = async () => {
      try {
        const response = await apiClient.get(`/web-audit/${auditId}/status`);
        const data = response.data;
        const statusInfo = data.data;

        if (statusInfo.status === 'completed' && statusInfo.scores) {
          // Fetch full results
          try {
            const resultsResponse = await apiClient.get(`/web-audit/${auditId}`);
            setAuditResult(resultsResponse.data.data);
            setCurrentAudit(null);
            fetchHistory(); // Refresh history
          } catch (resultsError) {
            console.error('Failed to fetch audit results:', resultsError);
          }
        } else if (statusInfo.status === 'failed') {
          setError('Audit failed. Please try again.');
          setCurrentAudit(null);
        } else {
          // Still running, continue polling
          setTimeout(poll, 3000);
        }
      } catch (error) {
        console.error('Error polling audit status:', error);
        setError('Lost connection to audit service');
        setCurrentAudit(null);
      }
    };

    poll();
  };

  const handleNewAudit = () => {
    setCurrentAudit(null);
    setAuditResult(null);
    setError(null);
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  // Show loading state while authentication or company data is loading
  if (authLoading || companyLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
            <p className="text-gray-600">Loading...</p>
          </div>
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
          <p className="text-gray-600">Please select a company to run web audits.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Web Audit</h1>
            <p className="text-gray-600 mt-1">
              {selectedCompany?.website ? (
                <>Analyze <span className="font-medium text-gray-900">{selectedCompany.website}</span></>
              ) : (
                'No website URL configured for this company'
              )}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm">Settings</span>
            </button>
            
            <button
              onClick={startAudit}
              disabled={isLoading || !!currentAudit || !selectedCompany?.website}
              className="flex items-center space-x-2 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading || currentAudit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{currentAudit ? 'Running...' : 'Starting...'}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span className="text-sm">Run Audit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Analysis Options</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { key: 'includePerformance', label: 'Performance', icon: Gauge, desc: 'Core Web Vitals' },
                { key: 'includeSEO', label: 'SEO', icon: Search, desc: 'Technical SEO' },
                { key: 'includeGEO', label: 'GEO', icon: Globe, desc: 'AI Optimization' },
                { key: 'includeAccessibility', label: 'Accessibility', icon: Eye, desc: 'WCAG Compliance' },
                { key: 'includeSecurity', label: 'Security', icon: Shield, desc: 'Vulnerabilities' },
              ].map(({ key, label, icon: Icon, desc }) => (
                <label key={key} className="flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={auditOptions[key as keyof typeof auditOptions]}
                    onChange={(e) => setAuditOptions(prev => ({
                      ...prev,
                      [key]: e.target.checked
                    }))}
                    className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <Icon className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">{label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Current Audit Progress */}
        {currentAudit && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <h3 className="text-lg font-medium text-gray-900">Running Analysis</h3>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-mono">{formatTime(elapsedTime)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-gray-600 text-sm">Analyzing {currentAudit.config.url}</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {auditResult && (
          <div className="space-y-6 mb-8">
            {/* Score Overview */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Audit Complete</h3>
                <button
                  onClick={handleNewAudit}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Run New Audit</span>
                </button>
              </div>
              
              <div className="grid grid-cols-6 gap-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-2">
                    <span className="text-xl font-bold text-gray-900">{auditResult.scores.overall}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">Overall</p>
                </div>
                {[
                  { key: 'performance', label: 'Performance', icon: Gauge },
                  { key: 'seo', label: 'SEO', icon: Search },
                  { key: 'geo', label: 'GEO', icon: Globe },
                  { key: 'accessibility', label: 'A11y', icon: Eye },
                  { key: 'security', label: 'Security', icon: Shield },
                ].map(({ key, label, icon: Icon }) => {
                  const score = auditResult.scores[key as keyof typeof auditResult.scores];
                  return (
                    <div key={key} className="text-center">
                      <div className="w-16 h-16 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-2">
                        <div className="text-center">
                          <Icon className="w-5 h-5 mx-auto text-gray-600 mb-1" />
                          <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recommendations */}
            {auditResult.recommendations.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
                <div className="space-y-3">
                  {auditResult.recommendations.slice(0, 5).map((rec, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        rec.priority === 'critical' ? 'bg-red-500' :
                        rec.priority === 'high' ? 'bg-orange-500' :
                        rec.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Audits</h3>
          </div>
          
          {history.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No audits yet</h4>
              <p className="text-gray-600">Run your first audit to see results here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {history.slice(0, 10).map((audit) => (
                <div key={audit.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{audit.url}</p>
                          <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(audit.requestedAt)}</span>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              audit.status === 'completed' ? 'bg-green-100 text-green-800' :
                              audit.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {audit.status}
                            </span>
                          </div>
                        </div>
                        
                        {audit.status === 'completed' && audit.scores.overall !== null && (
                          <div className="flex items-center space-x-2">
                            <span className={`text-lg font-bold ${getScoreColor(audit.scores.overall)}`}>
                              {audit.scores.overall}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebAuditPage;