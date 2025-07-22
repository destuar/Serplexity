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
import React from 'react';
import { X, Calendar, Clock, Target, Tag, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { OptimizationTask, TaskStatus } from '../../services/reportService';
import { cn } from '../../lib/utils';

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
  onStatusChange 
}) => {
  if (!isOpen || !task) return null;

  const priorityColors = {
    High: 'bg-red-50 text-red-700 border-red-200',
    Medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Low: 'bg-green-50 text-green-700 border-green-200'
  };

  const statusConfig = {
    [TaskStatus.NOT_STARTED]: {
      label: 'Not Started',
      icon: Circle,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100'
    },
    [TaskStatus.IN_PROGRESS]: {
      label: 'In Progress',
      icon: Clock,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    },
    [TaskStatus.COMPLETED]: {
      label: 'Completed',
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    }
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (onStatusChange) {
      onStatusChange(task.taskId, newStatus);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Task Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Title and Priority */}
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-800 pr-4 leading-tight">
              {task.title}
            </h3>
            <span className={cn(
              'text-sm px-3 py-1 rounded-full font-medium border flex-shrink-0',
              priorityColors[task.priority]
            )}>
              {task.priority} Priority
            </span>
          </div>

          {/* Status */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
            <div className="flex items-center gap-3">
              {Object.entries(statusConfig).map(([status, config]) => {
                const Icon = config.icon;
                const isActive = status === task.status;
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status as TaskStatus)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200',
                      isActive 
                        ? `${config.bgColor} border-gray-300 ${config.color}` 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg">
              {task.description}
            </p>
          </div>

          {/* Category and Impact Metric */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 font-medium">
                  {task.category}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Impact Metric</label>
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 font-medium">
                  {task.impactMetric}
                </span>
              </div>
            </div>
          </div>

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Dependencies</label>
              <div className="space-y-2">
                {task.dependencies.map((dependency, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 text-sm">
                      {dependency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(task.createdAt)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Updated</label>
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Clock className="w-4 h-4" />
                <span>{formatDate(task.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Completion Date (if completed) */}
          {task.completedAt && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Completed</label>
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>{formatDate(task.completedAt)}</span>
              </div>
            </div>
          )}

          {/* Task IDs (for debugging/reference) */}
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
              <div>
                <span className="font-medium">Task ID:</span> {task.taskId}
              </div>
              <div>
                <span className="font-medium">Report Run ID:</span> {task.reportRunId}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsModal; 