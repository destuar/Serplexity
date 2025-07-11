import React, { useState, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { OptimizationTask, TaskStatus } from '../../services/reportService';
import KanbanColumn from './KanbanColumn';
import KanbanTaskCard from './KanbanTaskCard';

interface KanbanBoardProps {
  tasks: OptimizationTask[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  isUpdating?: boolean;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onStatusChange, isUpdating = false }) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors for better drag experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    })
  );

  const columns = [
    { 
      id: TaskStatus.NOT_STARTED, 
      title: 'Not Started', 
      color: 'bg-gray-100',
      description: 'Tasks ready to begin'
    },
    { 
      id: TaskStatus.IN_PROGRESS, 
      title: 'In Progress', 
      color: 'bg-blue-100',
      description: 'Tasks currently being worked on'
    },
    { 
      id: TaskStatus.COMPLETED, 
      title: 'Completed', 
      color: 'bg-green-100',
      description: 'Tasks that have been finished'
    }
  ];

  const tasksByStatus = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const status = task.status || TaskStatus.NOT_STARTED;
      if (!acc[status]) acc[status] = [];
      acc[status].push(task);
      return acc;
    }, {} as Record<TaskStatus, OptimizationTask[]>);
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    
    if (!over || isUpdating) return;
    
    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    
    // Find the current task
    const currentTask = tasks.find(t => t.taskId === taskId);
    if (!currentTask) return;
    
    // Don't update if the status is the same
    if (currentTask.status === newStatus) return;
    
    // Validate the new status
    if (!Object.values(TaskStatus).includes(newStatus)) {
      console.error('Invalid task status:', newStatus);
      return;
    }
    
    try {
      await onStatusChange(taskId, newStatus);
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeTask = activeId ? tasks.find(t => t.taskId === activeId) : null;

  return (
    <div className={`h-full ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              color={column.color}
              tasks={tasksByStatus[column.id] || []}
              count={tasksByStatus[column.id]?.length || 0}
            />
          ))}
        </div>
        
        <DragOverlay>
          {activeTask && (
            <div className="rotate-3 transform-gpu">
              <KanbanTaskCard task={activeTask} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Progress indicator */}
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-lg">
          <div className="bg-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium text-gray-700">Updating...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard; 