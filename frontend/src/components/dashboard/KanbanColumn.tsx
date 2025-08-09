/**
 * @file KanbanColumn.tsx
 * @description This component represents a single column within the Kanban board. It's a droppable area for tasks
 * and contains a list of `KanbanTaskCard` components. It uses `dnd-kit`'s `useDroppable` and `SortableContext`
 * to enable tasks to be dragged into and sorted within the column. It also displays the column title, task count,
 * and visual indicators for drag-and-drop operations.
 *
 * @dependencies
 * - react: The core React library.
 * - @dnd-kit/core: Core DND-Kit library for drag and drop (`useDroppable`).
 * - @dnd-kit/sortable: DND-Kit utilities for sortable lists (`SortableContext`, `verticalListSortingStrategy`).
 * - ../../lib/utils: Utility functions (e.g., `cn` for class names).
 * - ../../services/reportService: Type definitions for `OptimizationTask` and `TaskStatus`.
 * - ./KanbanTaskCard: Component representing an individual task card.
 *
 * @exports
 * - KanbanColumn: React functional component for a Kanban board column.
 */
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import React from "react";
import { cn } from "../../lib/utils";
import { OptimizationTask, TaskStatus } from "../../services/reportService";
import KanbanTaskCard from "./KanbanTaskCard";

interface InsertionIndicator {
  taskId: string;
  position: "above" | "below";
  status: TaskStatus;
}

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  tasks: OptimizationTask[];
  count: number;
  isDragging?: boolean;
  insertionIndicator?: InsertionIndicator | null;
  onTaskClick?: (task: OptimizationTask) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  title,
  color,
  tasks,
  count,
  isDragging = false,
  insertionIndicator = null,
  onTaskClick,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  // Gutter dropzone on the left side for easier dropping
  const gutterId = `${id}-gutter`;
  const { isOver: isOverGutter, setNodeRef: setGutterRef } = useDroppable({
    id: gutterId,
  });

  return (
    <div
      className="bg-white p-0 rounded-lg shadow-md h-full flex flex-col relative"
      style={{ overflow: "visible", clipPath: "none" }}
    >
      {/* Gutter Dropzone */}
      {isDragging && (
        <div
          ref={setGutterRef}
          className={cn(
            "absolute inset-y-0 left-0 w-4 rounded-l-lg transition-colors duration-200",
            isOverGutter ? "bg-gray-100/60" : "bg-transparent"
          )}
        />
      )}
      {/* Column Header */}
      <div className={cn("p-4 border-b border-gray-200 rounded-t-lg", color)}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <span className="text-sm font-medium text-gray-700 bg-transparent px-2 py-1 rounded-md border border-black/10 shadow-inner">
            {count}
          </span>
        </div>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-4 transition-all duration-200 min-h-0",
          isOver || isOverGutter
            ? "bg-gray-50 border-t-2 border-t-gray-400"
            : ""
        )}
        style={{ overflow: "visible" }}
      >
        <SortableContext
          items={tasks.map((t) => t.taskId)}
          strategy={verticalListSortingStrategy}
        >
          <div
            className="space-y-3 h-full pr-1 sentiment-details-scroll p-2"
            style={{
              overflowY: "auto",
              overflowX: "visible",
              // Critical: Remove any clipping from the scrollable container
              clipPath: "none",
              maskImage: "none",
              // Ensure shadows aren't clipped
              boxShadow: "none",
            }}
          >
            {tasks.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="text-center">
                  {/* Empty state - no text needed */}
                </div>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.taskId} className="relative">
                  {/* Insertion indicator above */}
                  {insertionIndicator &&
                    insertionIndicator.taskId === task.taskId &&
                    insertionIndicator.position === "above" &&
                    insertionIndicator.status === id && (
                      <div className="h-0.5 bg-transparent rounded-full mb-3 transition-all duration-200 shadow-sm">
                        <div className="absolute left-0 top-0 transform -translate-y-1/2 w-2 h-2 bg-transparent rounded-full"></div>
                      </div>
                    )}

                  <KanbanTaskCard
                    task={task}
                    onClick={onTaskClick}
                    onDelete={(t) => {
                      // Bubble up deletion via custom DOM event; page can handle
                      const evt = new CustomEvent("visibility-task-delete", {
                        detail: { task: t },
                      });
                      window.dispatchEvent(evt);
                    }}
                  />

                  {/* Insertion indicator below */}
                  {insertionIndicator &&
                    insertionIndicator.taskId === task.taskId &&
                    insertionIndicator.position === "below" &&
                    insertionIndicator.status === id && (
                      <div className="h-0.5 bg-transparent rounded-full mt-3 transition-all duration-200 shadow-sm">
                        <div className="absolute left-0 top-0 transform -translate-y-1/2 w-2 h-2 bg-transparent rounded-full"></div>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

export default KanbanColumn;
