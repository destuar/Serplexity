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
    High: 'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Low: 'bg-green-100 text-green-700 border-green-200'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'bg-white rounded-lg p-4 border shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing',
        isDragging || isSortableDragging ? 'opacity-50 shadow-lg rotate-3' : '',
        'touch-manipulation select-none' // Better mobile support
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-800 text-sm leading-tight pr-2">
          {task.title}
        </h4>
        <span className={cn(
          'text-xs px-2 py-1 rounded-full font-medium border flex-shrink-0',
          priorityColors[task.priority]
        )}>
          {task.priority}
        </span>
      </div>
      
      <p className="text-xs text-gray-600 mb-3 line-clamp-3">
        {task.description}
      </p>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {task.category}
        </span>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {task.impactMetric}
        </span>
      </div>
      
      {/* Add a subtle grip indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-30 transition-opacity">
        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
      </div>
    </div>
  );
};

export default KanbanTaskCard; 