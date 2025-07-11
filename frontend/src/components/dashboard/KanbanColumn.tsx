import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '../../lib/utils';
import { OptimizationTask } from '../../services/reportService';
import KanbanTaskCard from './KanbanTaskCard';

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  tasks: OptimizationTask[];
  count: number;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ 
  id, 
  title, 
  color, 
  tasks, 
  count 
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div className="flex flex-col h-full">
      <div className={cn(
        'rounded-lg p-4 mb-4 flex items-center justify-between shadow-sm',
        color
      )}>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded-full font-medium">
          {count}
        </span>
      </div>
      
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-0 p-3 rounded-lg border-2 border-dashed transition-all duration-200',
          isOver ? 'border-blue-400 bg-blue-50/50 scale-105' : 'border-gray-200 hover:border-gray-300'
        )}
      >
        <SortableContext items={tasks.map(t => t.taskId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 h-full overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400">
                <div className="text-center">
                  <div className="text-2xl mb-2">📋</div>
                  <p className="text-sm">Drop tasks here</p>
                </div>
              </div>
            ) : (
              tasks.map((task) => (
                <KanbanTaskCard key={task.taskId} task={task} />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn; 