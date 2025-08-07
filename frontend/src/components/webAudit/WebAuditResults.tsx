/**
 * @file WebAuditResults.tsx
 * @description Component for displaying web audit results
 * 
 * Shows audit scores, detailed analysis results, and actionable recommendations.
 * Includes score visualization, recommendation prioritization, and export options.
 */

import React, { useState } from "react";
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw,
  Download,
  Eye,
  Gauge,
  Search,
  Globe,
  Shield,
  ChevronDown,
  ChevronRight,
  Clock,
  Calendar,
} from "lucide-react";
import { AuditResult } from "../../pages/WebAuditPage";

interface WebAuditResultsProps {
  result: AuditResult;
  onNewAudit: () => void;
}

const WebAuditResults: React.FC<WebAuditResultsProps> = ({ result, onNewAudit }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-100', text: 'text-green-800', ring: 'ring-green-200' };
    if (score >= 75) return { bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-200' };
    if (score >= 50) return { bg: 'bg-orange-100', text: 'text-orange-800', ring: 'ring-orange-200' };
    return { bg: 'bg-red-100', text: 'text-red-800', ring: 'ring-red-200' };
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Poor';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
      case 'high': return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' };
      case 'medium': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
      case 'low': return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
    }
  };

  const scoreCategories = [
    {
      key: 'performance',
      label: 'Performance',
      icon: Gauge,
      color: 'orange',
      score: result.scores.performance,
    },
    {
      key: 'seo',
      label: 'SEO',
      icon: Search,
      color: 'green',
      score: result.scores.seo,
    },
    {
      key: 'geo',
      label: 'GEO',
      icon: Globe,
      color: 'purple',
      score: result.scores.geo,
    },
    {
      key: 'accessibility',
      label: 'Accessibility',
      icon: Eye,
      color: 'blue',
      score: result.scores.accessibility,
    },
    {
      key: 'security',
      label: 'Security',
      icon: Shield,
      color: 'red',
      score: result.scores.security,
    },
  ];

  const filteredRecommendations = selectedCategory === 'all' 
    ? result.recommendations 
    : result.recommendations.filter(rec => rec.category === selectedCategory);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatAnalysisTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Audit Complete</h2>
                <div className="flex items-center space-x-4 text-green-100">
                  <span>{result.metadata.url}</span>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(result.metadata.timestamp)}</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{formatAnalysisTime(result.metadata.analysisTime)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onNewAudit}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>New Audit</span>
              </button>
              <button className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors">
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Overall Score */}
        <div className="p-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <span className="text-3xl font-bold">{result.scores.overall}</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                Overall Score: {getScoreLabel(result.scores.overall)}
              </h3>
              <p className="text-gray-600">
                Based on {scoreCategories.length} categories of analysis
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Score Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {scoreCategories.map((category) => {
            const IconComponent = category.icon;
            const colors = getScoreColor(category.score);
            
            return (
              <div key={category.key} className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className={`p-3 rounded-xl ${colors.bg}`}>
                    <IconComponent className={`w-6 h-6 ${colors.text}`} />
                  </div>
                </div>
                <div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} ${colors.ring} ring-1`}>
                    {category.score}
                  </div>
                  <h4 className="font-semibold text-gray-900 mt-2">{category.label}</h4>
                  <p className="text-sm text-gray-600">{getScoreLabel(category.score)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            Recommendations ({filteredRecommendations.length})
          </h3>
          <div className="flex items-center space-x-2">
            <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
              Filter by:
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Categories</option>
              {scoreCategories.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredRecommendations.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              Great job! No recommendations for this category.
            </h4>
            <p className="text-gray-600">
              Your website performs excellently in this area.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecommendations.map((recommendation, index) => {
              const priorityColors = getPriorityColor(recommendation.priority);
              
              return (
                <div
                  key={index}
                  className={`border rounded-xl p-6 ${priorityColors.border} hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityColors.bg} ${priorityColors.text}`}>
                          {recommendation.priority}
                        </span>
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          {recommendation.category}
                        </span>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {recommendation.title}
                      </h4>
                      <p className="text-gray-700">
                        {recommendation.description}
                      </p>
                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Impact:</span> {recommendation.impact}
                        </div>
                        <div>
                          <span className="font-medium">Effort:</span> {recommendation.effort}
                        </div>
                      </div>
                    </div>
                    {recommendation.priority === 'critical' && (
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detailed Results (Expandable Sections) */}
      <div className="space-y-4">
        {scoreCategories.map((category) => {
          const isExpanded = expandedSections.has(category.key);
          const IconComponent = category.icon;
          const details = result.details[category.key as keyof typeof result.details];
          
          if (!details) return null;

          return (
            <div key={category.key} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection(category.key)}
                className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg bg-${category.color}-100`}>
                    <IconComponent className={`w-5 h-5 text-${category.color}-600`} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {category.label} Details
                    </h3>
                    <p className="text-sm text-gray-600">
                      Score: {category.score}/100 - {getScoreLabel(category.score)}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>
              
              {isExpanded && (
                <div className="px-8 pb-8 border-t border-gray-200">
                  <div className="pt-6">
                    <pre className="bg-gray-50 rounded-lg p-4 overflow-auto text-sm">
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WebAuditResults;