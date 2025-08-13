/**
 * @file WebAuditResults.tsx
 * @description Component for displaying web audit results
 *
 * Shows audit scores, detailed analysis results, and actionable recommendations.
 * Includes score visualization, recommendation prioritization, and export options.
 */

import {
  Check,
  CheckCircle2,
  Gauge,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import React, { useState } from "react";
import { useCompany } from "../../contexts/CompanyContext";
import { AuditResult } from "../../pages/WebAuditPage";
import {
  TaskStatus,
  addOptimizationTask,
  getOptimizationTasks,
  updateTaskStatus,
} from "../../services/reportService";
import FilterDropdown from "../dashboard/FilterDropdown";
import { InlineSpinner } from "../ui/InlineSpinner";

interface WebAuditResultsProps {
  result: AuditResult;
  onNewAudit: () => void;
  onOpenCategory?: (key: string, label: string) => void;
}

const WebAuditResults: React.FC<WebAuditResultsProps> = ({
  result,
  onNewAudit,
  onOpenCategory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 90)
      return {
        bg: "bg-green-100",
        text: "text-green-800",
        ring: "ring-green-200",
      };
    if (score >= 75)
      return {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        ring: "ring-yellow-200",
      };
    if (score >= 50)
      return {
        bg: "bg-orange-100",
        text: "text-orange-800",
        ring: "ring-orange-200",
      };
    return { bg: "bg-red-100", text: "text-red-800", ring: "ring-red-200" };
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 75) return "Good";
    if (score >= 50) return "Needs Improvement";
    return "Poor";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return {
          bg: "bg-red-100",
          text: "text-red-800",
          border: "border-red-200",
        };
      case "high":
        return {
          bg: "bg-orange-100",
          text: "text-orange-800",
          border: "border-orange-200",
        };
      case "medium":
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          border: "border-yellow-200",
        };
      case "low":
        return {
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-200",
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-800",
          border: "border-gray-200",
        };
    }
  };

  const scoreCategories = [
    {
      key: "overall",
      label: "Overall Score",
      icon: Gauge,
      color: "blue",
      score: result.scores.overall,
    },
    {
      key: "performance",
      label: "Performance",
      icon: Gauge,
      color: "orange",
      score: result.scores.performance,
    },
    {
      key: "seo",
      label: "SEO",
      icon: Search,
      color: "green",
      score: result.scores.seo,
    },
    {
      key: "geo",
      label: "AI Search",
      icon: Sparkles,
      color: "purple",
      score: result.scores.geo,
    },
    {
      key: "security",
      label: "Security",
      icon: Shield,
      color: "red",
      score: result.scores.security,
    },
  ];
  const getCategoryLabel = (key: string): string => {
    switch (key) {
      case "performance":
        return "Performance";
      case "seo":
        return "SEO";
      case "geo":
        return "AI Search";
      case "security":
        return "Security";
      case "overall":
        return "Overall Score";
      default:
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
  };

  const categoryFilterOptions = [
    { value: "all", label: "All Categories" },
    { value: "performance", label: "Performance" },
    { value: "seo", label: "SEO" },
    { value: "geo", label: "AI Search" },
    { value: "security", label: "Security" },
  ];

  const filteredRecommendations =
    selectedCategory === "all"
      ? result.recommendations
      : result.recommendations.filter(
          (rec) => rec.category === selectedCategory
        );
  const { selectedCompany } = useCompany();

  const mapCategoryToTaskCategory = (categoryKey: string): string => {
    switch (categoryKey) {
      case "performance":
        return "Technical SEO";
      case "seo":
        return "Technical SEO";
      case "geo":
        return "Content & Messaging";
      case "security":
        return "Technical SEO";
      default:
        return "Content & Messaging";
    }
  };

  const mapPriority = (priority: string): "High" | "Medium" | "Low" => {
    if (priority === "critical" || priority === "high") return "High";
    if (priority === "medium") return "Medium";
    return "Low";
  };

  const mapImpact = (
    categoryKey: string
  ): "visibility" | "averagePosition" | "inclusionRate" => {
    if (categoryKey === "performance") return "inclusionRate";
    if (categoryKey === "seo") return "averagePosition";
    return "visibility";
  };

  const normalizeTitleKey = (title: string) => title.trim().toLowerCase();
  const [addedTaskKeys, setAddedTaskKeys] = useState<Set<string>>(new Set());
  const [existingTaskTitles, setExistingTaskTitles] = useState<Set<string>>(
    new Set()
  );
  const [existingTaskMap, setExistingTaskMap] = useState<
    Map<string, { taskId: string; reportRunId: string }>
  >(new Map());
  const [pendingTaskOps, setPendingTaskOps] = useState<Set<string>>(new Set());
  const [lastOpAt, setLastOpAt] = useState<Map<string, number>>(new Map());
  const getRecommendationKey = (rec: { category: string; title: string }) =>
    normalizeTitleKey(rec.title);

  // Persist added recommendations per company to prevent duplicates across sessions
  const companyId = useCompany().selectedCompany?.id;
  const storageKey = `web-audit-added-recs:${companyId ?? "unknown"}`;

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr: string[] = JSON.parse(raw);
        setAddedTaskKeys(new Set(arr));
      }
    } catch {}
  }, [storageKey]);

  // Fetch existing tasks to prevent duplicate adds (persisted across sessions)
  React.useEffect(() => {
    const loadTasks = async () => {
      try {
        if (!selectedCompany?.id) return;
        const tasks = await getOptimizationTasks(selectedCompany.id);
        const titleSet = new Set<string>();
        const map = new Map<string, { taskId: string; reportRunId: string }>();
        (tasks || [])
          .filter((t) => t.status !== TaskStatus.CANCELLED)
          .forEach((t) => {
            const key = normalizeTitleKey(t.title);
            titleSet.add(key);
            map.set(key, { taskId: t.taskId, reportRunId: t.reportRunId });
          });
        setExistingTaskTitles(titleSet);
        setExistingTaskMap(map);
        // Prune stale local added keys that no longer exist server-side (after cancellations elsewhere)
        setAddedTaskKeys((prev) => {
          const pruned = new Set<string>();
          prev.forEach((k) => {
            if (titleSet.has(k)) pruned.add(k);
          });
          try {
            localStorage.setItem(
              storageKey,
              JSON.stringify(Array.from(pruned))
            );
          } catch {}
          return pruned;
        });
      } catch (e) {
        // non-fatal; silently ignore
      }
    };
    loadTasks();
  }, [selectedCompany?.id]);

  const handleAddTask = async (rec: {
    category: string;
    priority: string;
    title: string;
    description: string;
  }) => {
    if (!selectedCompany?.id) return;
    const key = getRecommendationKey(rec);
    if (addedTaskKeys.has(key) || existingTaskTitles.has(key)) return; // Already added; no-op
    if (pendingTaskOps.has(key)) return; // Prevent duplicate submissions
    setPendingTaskOps((prev) => new Set(prev).add(key));
    setLastOpAt((prev) => new Map(prev).set(key, Date.now()));
    try {
      const task = await addOptimizationTask(selectedCompany.id, {
        title: rec.title,
        description: rec.description,
        category: mapCategoryToTaskCategory(rec.category),
        priority: mapPriority(rec.priority),
        impactMetric: mapImpact(rec.category),
      });
      setAddedTaskKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        try {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
      // Broadcast event so VisibilityTasksPage can refresh immediately
      try {
        window.dispatchEvent(
          new CustomEvent("optimizationTaskAdded", {
            detail: {
              title: rec.title,
              taskId: task?.taskId,
              reportRunId: task?.reportRunId,
            },
          })
        );
      } catch {}

      // Refresh task mapping lazily; we optimistically add to maps
      setExistingTaskTitles((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setExistingTaskMap((prev) => {
        const next = new Map(prev);
        if (task?.taskId && task?.reportRunId) {
          next.set(key, { taskId: task.taskId, reportRunId: task.reportRunId });
        }
        return next;
      });
      // Optional: toast success (omitted to keep edits minimal)
    } catch (e) {
      // Optional: toast error (silent fail for now)
      console.error("Failed to add task", e);
    } finally {
      setPendingTaskOps((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRemoveTask = async (rec: { category: string; title: string }) => {
    if (!selectedCompany?.id) return;
    const key = getRecommendationKey(rec);
    const now = Date.now();
    const last = lastOpAt.get(key) || 0;
    if (now - last < 600) return; // throttle rapid clicks within 600ms
    if (pendingTaskOps.has(key)) return; // prevent concurrent ops
    setPendingTaskOps((prev) => new Set(prev).add(key));
    setLastOpAt((prev) => new Map(prev).set(key, now));
    try {
      const mapping = existingTaskMap.get(key);
      if (!mapping) {
        // Fallback: just clear local state
        setAddedTaskKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          try {
            localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
          } catch {}
          return next;
        });
        setExistingTaskTitles((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }

      await updateTaskStatus(
        mapping.reportRunId,
        mapping.taskId,
        TaskStatus.CANCELLED
      );

      setAddedTaskKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        try {
          localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
      setExistingTaskTitles((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      setExistingTaskMap((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    } catch (e) {
      console.error("Failed to remove task", e);
    } finally {
      setPendingTaskOps((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    <div className="h-full flex flex-col">
      <div className="max-w-7xl w-full mx-auto flex-1 min-h-0 flex flex-col space-y-3">
        {/* Top-right actions removed per design */}

        {/* Score Breakdown (left) + Quick Wins (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-stretch">
          {/* Left: Score Breakdown */}
          <div className="lg:col-span-3">
            <div className="h-full rounded-2xl p-3 bg-white/70 backdrop-blur-sm border border-white/20 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-medium text-gray-900">
                  Score Breakdown
                </h3>
                <div className="h-8 px-3 bg-white/60 backdrop-blur-sm border border-white/30 rounded-lg shadow-inner flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {result.scores.overall}/100
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5">
                {scoreCategories
                  .filter((c) => c.key !== "overall")
                  .map((category) => {
                    const IconComponent = category.icon;
                    const scoreColors = getScoreColor(category.score);

                    return (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() =>
                          onOpenCategory &&
                          onOpenCategory(
                            category.key,
                            getCategoryLabel(category.key)
                          )
                        }
                        className="group aspect-[3/2] flex flex-col items-center justify-center gap-2 rounded-xl bg-white/70 backdrop-blur-sm border border-white/20 shadow-md active:shadow-inner active:translate-y-[1px] transition-[transform,box-shadow,background-color] duration-150 p-2.5 focus:outline-none"
                        title={`View ${category.label} details`}
                      >
                        <h4 className="font-semibold text-gray-900 text-sm">
                          {category.label}
                        </h4>
                        <div className="flex items-center justify-center gap-0">
                          <div className="p-0.5 rounded-lg bg-white/60 border border-white/30">
                            <IconComponent className="w-5 h-5 text-gray-600" />
                          </div>
                          <div
                            className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-semibold bg-white/60 ${scoreColors.text}`}
                          >
                            {category.score}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Right: Quick Wins */}
          <div className="lg:col-span-2">
            <div className="h-full rounded-2xl p-3 bg-white/70 backdrop-blur-sm border border-white/20 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900">
                  Quick Wins
                </h4>
              </div>
              <ol className="space-y-1 list-decimal list-inside text-sm">
                {result.recommendations
                  .sort((a, b) =>
                    a.priority === "critical"
                      ? -1
                      : a.priority === "high"
                        ? -0.5
                        : 1
                  )
                  .slice(0, 5)
                  .map((rec, idx) => (
                    <li key={idx} className="text-gray-800">
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:opacity-80"
                        onClick={() =>
                          onOpenCategory &&
                          onOpenCategory(
                            rec.category,
                            getCategoryLabel(rec.category)
                          )
                        }
                        title={`Open ${rec.category} details`}
                      >
                        {rec.title}
                      </button>
                    </li>
                  ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="h-full rounded-2xl bg-white/70 backdrop-blur-sm border border-white/20 shadow-sm overflow-y-auto p-0">
          <div className="sticky top-0 z-10 px-3 py-2 bg-white/70 backdrop-blur-sm border-b border-white/20 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              Recommendations ({filteredRecommendations.length})
            </h3>
            <FilterDropdown
              label="Filter"
              value={selectedCategory}
              options={categoryFilterOptions}
              onChange={(value) => setSelectedCategory(value as string)}
              icon={SlidersHorizontal}
            />
          </div>

          <div className="p-3">
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
              <div className="space-y-2">
                {filteredRecommendations.map((recommendation, index) => {
                  const priorityColors = getPriorityColor(
                    recommendation.priority
                  );
                  const recKey = getRecommendationKey(recommendation);
                  const isAdded =
                    addedTaskKeys.has(recKey) || existingTaskTitles.has(recKey);

                  return (
                    <div
                      key={index}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        onOpenCategory &&
                        onOpenCategory(
                          recommendation.category,
                          getCategoryLabel(recommendation.category)
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenCategory &&
                            onOpenCategory(
                              recommendation.category,
                              getCategoryLabel(recommendation.category)
                            );
                        }
                      }}
                      className={`cursor-pointer p-3 bg-white/80 backdrop-blur-sm border border-white/20 rounded-xl shadow-md hover:bg-white/85 transition-colors`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {recommendation.title}
                            </h4>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs leading-none font-medium ${priorityColors.bg} ${priorityColors.text} border ${priorityColors.border}`}
                            >
                              {recommendation.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {recommendation.description}
                          </p>
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <div className="flex items-center space-x-6">
                              <div>
                                <span className="font-medium">Impact:</span>{" "}
                                {recommendation.impact}
                              </div>
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  isAdded
                                    ? handleRemoveTask(recommendation)
                                    : handleAddTask(recommendation);
                                }}
                                disabled={pendingTaskOps.has(recKey)}
                                className={`relative z-10 pointer-events-auto select-none inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shadow-md focus:outline-none w-[112px] ${
                                  isAdded
                                    ? "bg-white/70 text-gray-600 border border-white/30 shadow-inner active:translate-y-[1px] active:shadow-inner"
                                    : "bg-white/80 text-gray-900 border border-white/30 active:translate-y-[1px] active:shadow-inner"
                                }`}
                                title={
                                  isAdded ? "Added" : "Add to Visibility Tasks"
                                }
                                aria-label={
                                  isAdded ? "Added to tasks" : "Add to tasks"
                                }
                              >
                                {pendingTaskOps.has(recKey) ? (
                                  <InlineSpinner size={16} />
                                ) : isAdded ? (
                                  <Check className="w-4 h-4 text-gray-500" />
                                ) : (
                                  "Add to Tasks"
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                        {/* Emergency icon removed for cleaner UI */}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Results removed; details open in dedicated embedded pages */}
      </div>
    </div>
  );
};

export default WebAuditResults;
