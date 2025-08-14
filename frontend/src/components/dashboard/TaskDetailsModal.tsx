/**
 * @file TaskDetailsModal.tsx
 * @description Modal component for displaying detailed task information.
 * Shows complete task details including title, description, category, priority, impact metrics,
 * dependencies, timestamps, and status management.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - lucide-react: For icons.
 * - ../../services/reportService: For task types and status management.
 * - ../../lib/utils: For utility functions.
 *
 * @exports
 * - TaskDetailsModal: The main task details modal component.
 */
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Tag,
  Target,
} from "lucide-react";
import React, { useEffect } from "react";
import { cn } from "../../lib/utils";
import { OptimizationTask, TaskStatus } from "../../services/reportService";
import CategoryExplainer, { CategoryKey } from "../webAudit/CategoryExplainer";

interface TaskDetailsModalProps {
  task: OptimizationTask | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
}

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const priorityColors = {
    High: "bg-red-50 text-red-700 border-red-200",
    Medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Low: "bg-green-50 text-green-700 border-green-200",
  };

  const statusConfig = {
    [TaskStatus.NOT_STARTED]: {
      label: "Not Started",
      icon: Circle,
      color: "text-gray-500",
      bgColor: "bg-gray-100",
    },
    [TaskStatus.IN_PROGRESS]: {
      label: "In Progress",
      icon: Clock,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
    [TaskStatus.COMPLETED]: {
      label: "Completed",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (onStatusChange) {
      onStatusChange(task.taskId, newStatus);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Guard after hooks to satisfy rules-of-hooks
  if (!isOpen || !task) return null;

  // Infer implementation plan category from task
  const inferCategoryKey = (t: OptimizationTask): CategoryKey => {
    const title = (t.title || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    const text = `${title} ${desc}`;
    // Security cues
    if (
      /csp|content-security-policy|x-frame|x-content-type|hsts|https|security/.test(
        text
      )
    ) {
      return "security";
    }
    // Performance cues
    if (
      /lcp|cls|inp|ttfb|performance|speed|render|image|font|cache|cdn/.test(
        text
      )
    ) {
      return "performance";
    }
    // SEO cues
    if (
      /seo|index|sitemap|robots|canonical|meta|title|description|hreflang|schema/.test(
        text
      )
    ) {
      return "seo";
    }
    // GEO/AI Search by default for content tasks
    return "geo";
  };

  const planCategory: CategoryKey = inferCategoryKey(task);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 p-4 flex items-center justify-center"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.3)" }}
    >
      <div
        className="bg-white/95 backdrop-blur-sm border border-white/30 rounded-2xl max-w-3xl w-full shadow-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-start px-5 py-4 border-b border-white/30 bg-white/50">
          <h2 className="text-lg font-semibold text-gray-900">Task Details</h2>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Title and Priority */}
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-base font-semibold text-gray-900 pr-4 leading-tight">
              {task.title}
            </h3>
            <span
              className={cn(
                "text-xs px-2.5 py-1 rounded-md font-medium border flex-shrink-0",
                priorityColors[task.priority]
              )}
            >
              {task.priority} Priority
            </span>
          </div>

          {/* Status */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Status
            </label>
            <div className="flex items-center gap-2">
              {Object.entries(statusConfig).map(([status, config]) => {
                const Icon = config.icon;
                const isActive = status === task.status;
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status as TaskStatus)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-150",
                      isActive
                        ? `${config.bgColor} border-gray-300 ${config.color}`
                        : "bg-white/70 backdrop-blur-sm border-white/30 text-gray-700 hover:bg-white/80"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Description
            </label>
            <p className="text-gray-700 leading-relaxed bg-white/70 backdrop-blur-sm p-3 rounded-lg border border-white/30 text-sm">
              {task.description}
            </p>
          </div>

          {/* Category and Impact Metric */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Category
              </label>
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-700 bg-white/70 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/30 font-medium text-sm">
                  {task.category}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Impact Metric
              </label>
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-700 bg-white/70 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/30 font-medium text-sm">
                  {task.impactMetric}
                </span>
              </div>
            </div>
          </div>

          {/* Implementation Plan */}
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              Step-by-step implementation plan
            </h4>
            <div className="rounded-xl bg-white/70 backdrop-blur-sm border border-white/30 shadow-sm p-3">
              <CategoryExplainer categoryKey={planCategory} />
            </div>
          </div>

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Dependencies
              </label>
              <div className="space-y-2">
                {task.dependencies.map((dependency, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-700 bg-white/70 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/30 text-sm">
                      {dependency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Created
              </label>
              <div className="flex items-center gap-2 text-gray-600 text-xs">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(task.createdAt)}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Last Updated
              </label>
              <div className="flex items-center gap-2 text-gray-600 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDate(task.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Completion Date (if completed) */}
          {task.completedAt && (
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Completed
              </label>
              <div className="flex items-center gap-2 text-green-600 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{formatDate(task.completedAt)}</span>
              </div>
            </div>
          )}

          {/* Task IDs (for debugging/reference) */}
          <div className="pt-4 border-t border-white/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-gray-500">
              <div>
                <span className="font-medium">Task ID:</span> {task.taskId}
              </div>
              <div>
                <span className="font-medium">Report Run ID:</span>{" "}
                {task.reportRunId}
              </div>
            </div>
          </div>
        </div>

        {/* Footer removed per UX */}
      </div>
    </div>
  );
};

export default TaskDetailsModal;
