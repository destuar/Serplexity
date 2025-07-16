/**
 * @file KanbanTaskCard.tsx
 * @description This component represents an individual task card within the Kanban board. It's a sortable item
 * that displays the task's title, description, priority, category, and impact metric. It uses `dnd-kit`'s
 * `useSortable` hook to enable drag-and-drop functionality and applies visual styles based on the task's priority
 * and drag state. This component is crucial for visualizing and interacting with individual optimization tasks.
 *
 * @dependencies
 * - react: The core React library.
 * - @dnd-kit/sortable: DND-Kit utilities for sortable items (`useSortable`).
 * - @dnd-kit/utilities: DND-Kit utilities for CSS transformations (`CSS`).
 * - ../../lib/utils: Utility functions (e.g., `cn` for class names).
 * - ../../services/reportService: Type definition for `OptimizationTask`.
 *
 * @exports
 * - KanbanTaskCard: React functional component for a Kanban task card.
 */
import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import { OptimizationTask } from '../../services/reportService';

interface KanbanTaskCardProps {
  task: OptimizationTask;
  isDragging?: boolean;
  onClick?: (task: OptimizationTask) => void;
}

const KanbanTaskCard: React.FC<KanbanTaskCardProps> = ({ 
  task, 
  isDragging = false, 
  onClick 
}) => {
  const [isDragStarted, setIsDragStarted] = useState(false);
  
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

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only trigger click if we're not in the middle of a drag
    if (!isDragStarted && !isSortableDragging && onClick) {
      onClick(task);
    }
  };

  const handleMouseDown = () => {
    setIsDragStarted(false);
  };

  const handleDragStart = () => {
    setIsDragStarted(true);
  };

  const handleDragEnd = () => {
    setIsDragStarted(false);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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

      {/* Clickable content area */}
      <div 
        onClick={handleCardClick}
        className="cursor-pointer"
      >
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
    </div>
  );
};

export default KanbanTaskCard; 