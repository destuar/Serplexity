import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import { OptimizationTask } from '../../services/reportService';

interface KanbanTaskCardProps {
  task: OptimizationTask;
  isDragging?: boolean;
}

const KanbanTaskCard: React.FC<KanbanTaskCardProps> = ({ task, isDragging = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.taskId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors = {
    High: 'bg-red-50 text-red-700 border-red-200',
    Medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    Low: 'bg-green-50 text-green-700 border-green-200'
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative bg-white rounded-lg p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200 cursor-grab active:cursor-grabbing',
        isSortableDragging ? 'opacity-0' : '',
        isDragging ? 'opacity-100 shadow-xl rotate-2 scale-105 z-50' : '',
        'touch-manipulation select-none'
      )}
      style={{
        ...style,
        transformOrigin: 'center center',
        position: 'relative',
        zIndex: isDragging || isSortableDragging ? 50 : 'auto'
      }}
    >
      {/* Drag handle indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity duration-200">
        <div className="flex flex-col space-y-1">
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
        </div>
      </div>

      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-gray-800 text-sm leading-tight pr-6">
          {task.title}
        </h4>
        <span className={cn(
          'text-xs px-2 py-1 rounded-full font-medium border flex-shrink-0',
          priorityColors[task.priority]
        )}>
          {task.priority}
        </span>
      </div>
      
      <p className="text-xs text-gray-600 mb-4 line-clamp-3 leading-relaxed">
        {task.description}
      </p>
      
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 font-medium">
          {task.category}
        </span>
        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-200 font-medium">
          {task.impactMetric}
        </span>
      </div>
    </div>
  );
};

export default KanbanTaskCard; 