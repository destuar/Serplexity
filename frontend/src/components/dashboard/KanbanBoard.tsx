/**
 * @file KanbanBoard.tsx
 * @description This component implements a Kanban board for managing optimization tasks. It uses `dnd-kit`
 * for drag-and-drop functionality, allowing users to move tasks between "Not Started," "In Progress," and "Completed"
 * columns. It manages the state of tasks, handles drag events, and optimistically updates the UI before calling
 * an API to persist status changes. This is a key component for visualizing and managing the progress of optimization efforts.
 *
 * @dependencies
 * - react: The core React library.
 * - @dnd-kit/core: Core DND-Kit library for drag and drop.
 * - ../../services/reportService: Service for interacting with report-related APIs, including task status updates.
 * - ./KanbanColumn: Component representing a single column in the Kanban board.
 * - ./KanbanTaskCard: Component representing an individual task card in the Kanban board.
 *
 * @exports
 * - KanbanBoard: React functional component for the Kanban board.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent, PointerSensor, useSensor, useSensors, rectIntersection } from '@dnd-kit/core';
import { OptimizationTask, TaskStatus } from '../../services/reportService';
import KanbanColumn from './KanbanColumn';
import KanbanTaskCard from './KanbanTaskCard';

interface KanbanBoardProps {
  tasks: OptimizationTask[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onTaskClick?: (task: OptimizationTask) => void;
}

interface InsertionIndicator {
  taskId: string;
  position: 'above' | 'below';
  status: TaskStatus;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  tasks: initialTasks, 
  onStatusChange, 
  onTaskClick 
}) => {
  const [tasks, setTasks] = useState<OptimizationTask[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [insertionIndicator, setInsertionIndicator] = useState<InsertionIndicator | null>(null);

  useEffect(() => {
    // Sync with parent state
    setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const columns = useMemo(() => [
    { id: TaskStatus.NOT_STARTED, title: 'Not Started', color: 'bg-gray-100' },
    { id: TaskStatus.IN_PROGRESS, title: 'In Progress', color: 'bg-[#7762ff]/10' },
    { id: TaskStatus.COMPLETED, title: 'Completed', color: 'bg-[#7762ff]/20' }
  ], []);

  const tasksByStatus = useMemo(() => {
    return tasks.reduce((acc, task) => {
      const status = task.status || TaskStatus.NOT_STARTED;
      if (!acc[status]) acc[status] = [];
      acc[status].push(task);
      return acc;
    }, {} as Record<TaskStatus, OptimizationTask[]>);
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over || !active) {
      setInsertionIndicator(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    // Skip if dragging over self
    if (activeId === overId) {
      setInsertionIndicator(null);
      return;
    }

    // Check if we're dragging over a task
    const overTask = tasks.find(t => t.taskId === overId);
    if (!overTask) {
      setInsertionIndicator(null);
      return;
    }

    // Get the over element's rectangle
    const overRect = over.rect;
    if (!overRect) {
      setInsertionIndicator(null);
      return;
    }

    // Determine if we're in the top or bottom half
    const pointerY = event.activatorEvent instanceof MouseEvent ? event.activatorEvent.clientY : 0;
    const overMiddleY = overRect.top + overRect.height / 2;
    const isAbove = pointerY < overMiddleY;

    setInsertionIndicator({
      taskId: overId,
      position: isAbove ? 'above' : 'below',
      status: overTask.status || TaskStatus.NOT_STARTED
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setInsertionIndicator(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) return;

    const activeTask = tasks.find(t => t.taskId === activeId);
    if (!activeTask) return;

    const activeContainer = activeTask.status || TaskStatus.NOT_STARTED;
    let overContainerId = over.data.current?.sortable?.containerId || over.id;
    
    // Handle gutter drops
    if (String(overContainerId).endsWith('-gutter')) {
        overContainerId = String(overContainerId).replace('-gutter', '') as TaskStatus;
    }
    
    // Check if we're dropping over a task
    const overTask = tasks.find(t => t.taskId === overId);
    if (overTask) {
      overContainerId = overTask.status || TaskStatus.NOT_STARTED;
    }
    
    if (!Object.values(TaskStatus).includes(overContainerId as TaskStatus)) return;
    const overContainer = overContainerId as TaskStatus;

    // Optimistic UI update
    setTasks(currentTasks => {
        const tasksByStatusMap: Record<string, OptimizationTask[]> = {
            [TaskStatus.NOT_STARTED]: [],
            [TaskStatus.IN_PROGRESS]: [],
            [TaskStatus.COMPLETED]: [],
        };
        
        currentTasks.forEach(t => {
            const status = t.status || TaskStatus.NOT_STARTED;
            tasksByStatusMap[status].push(t);
        });

        const sourceColumnItems = tasksByStatusMap[activeContainer];
        const destColumnItems = tasksByStatusMap[overContainer];

        const activeIndex = sourceColumnItems.findIndex(t => t.taskId === activeId);
        if (activeIndex === -1) return currentTasks;

        const [movedItem] = sourceColumnItems.splice(activeIndex, 1);
        movedItem.status = overContainer;

        // Handle precise positioning
        if (overTask && insertionIndicator) {
          const overIndex = destColumnItems.findIndex(t => t.taskId === overId);
          if (overIndex !== -1) {
            const insertIndex = insertionIndicator.position === 'above' ? overIndex : overIndex + 1;
            destColumnItems.splice(insertIndex, 0, movedItem);
          } else {
            destColumnItems.push(movedItem);
          }
        } else {
          // Default: add to end
          destColumnItems.push(movedItem);
        }

        return [
            ...tasksByStatusMap[TaskStatus.NOT_STARTED],
            ...tasksByStatusMap[TaskStatus.IN_PROGRESS],
            ...tasksByStatusMap[TaskStatus.COMPLETED]
        ];
    });

    // Only call API if status actually changed
    if (activeContainer !== overContainer) {
        // Fire and forget - don't await to keep drag operation instant
        onStatusChange(activeId, overContainer);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setInsertionIndicator(null);
  };

  const activeTask = activeId ? tasks.find(t => t.taskId === activeId) : null;

  return (
    <div className="h-full relative" style={{ overflow: 'visible' }}>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-0 overflow-visible">
          {columns.map((column) => (
            <div key={column.id} className="min-h-0 flex flex-col overflow-visible">
              <KanbanColumn
                id={column.id}
                title={column.title}
                color={column.color}
                tasks={tasksByStatus[column.id] || []}
                count={tasksByStatus[column.id]?.length || 0}
                isDragging={Boolean(activeId)}
                insertionIndicator={insertionIndicator}
                onTaskClick={onTaskClick}
              />
            </div>
          ))}
        </div>
        
        <DragOverlay>
          {activeTask && (
            <div className="rotate-2 transform-gpu">
              <KanbanTaskCard task={activeTask} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanBoard; 