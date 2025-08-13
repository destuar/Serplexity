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
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { OptimizationTask } from "../../services/reportService";

interface KanbanTaskCardProps {
  task: OptimizationTask;
  isDragging?: boolean;
  onClick?: (task: OptimizationTask) => void;
  onDelete?: (task: OptimizationTask) => void;
}

const KanbanTaskCard: React.FC<KanbanTaskCardProps> = ({
  task,
  isDragging = false,
  onClick,
  onDelete,
}) => {
  const formatDescription = (desc: string): string => {
    if (!desc) return desc;
    return desc.replace(/Your LCP is\s*(\d+(?:\.\d+)?)\s*ms\b/i, (_m, n) => {
      const seconds = (parseFloat(String(n)) / 1000).toFixed(2);
      return `Your LCP is ${seconds} seconds`;
    });
  };
  const [isDragStarted, setIsDragStarted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.taskId });

  // Limit transition to transform only to avoid opacity fade after drop
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? `transform ${transition}` : undefined,
  } as React.CSSProperties;

  const priorityColors = {
    High: "bg-red-50 text-red-700 border-red-200",
    Medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Low: "bg-green-50 text-green-700 border-green-200",
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (menuOpen) {
      // If context menu is open, close it and do not open details
      setMenuOpen(false);
      return;
    }

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

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        target &&
        !menuContainerRef.current?.contains(target) &&
        !menuButtonRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () =>
      document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [menuOpen]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseDown={handleMouseDown}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "group relative bg-white rounded-lg p-4 shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-150 cursor-grab active:cursor-grabbing",
        isSortableDragging ? "opacity-0" : "",
        isDragging ? "opacity-100 shadow-xl scale-[1.02] z-50" : "",
        "touch-manipulation select-none"
      )}
      style={{
        ...style,
        transformOrigin: "center center",
        position: "relative",
        zIndex: isDragging || isSortableDragging ? 50 : "auto",
      }}
    >
      {/* Context menu trigger (three dots) */}
      <div className="absolute -top-1 right-1 z-10">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setMenuOpen((v) => {
              const next = !v;
              if (next && menuButtonRef.current) {
                const r = menuButtonRef.current.getBoundingClientRect();
                // Position below the trigger; right-aligned to the button
                setMenuPos({ top: r.bottom + 4, left: r.right });
              }
              return next;
            });
          }}
          onMouseDown={(e) => {
            // Prevent drag from initiating on the menu button
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          ref={menuButtonRef}
          className="p-1 rounded-md hover:bg-gray-100/70 transition-colors opacity-70 hover:opacity-100"
          title="More actions"
        >
          <div className="flex flex-col items-center justify-center space-y-0.5">
            <div className="w-0.5 h-0.5 bg-gray-500 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-gray-500 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-gray-500 rounded-full"></div>
          </div>
        </button>

        {menuOpen &&
          menuPos &&
          createPortal(
            <div
              className="inline-block bg-white border border-gray-200 rounded-md shadow-lg z-[1000]"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                transform: "translate(-100%, 0)",
              }}
              ref={menuContainerRef}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="w-full flex items-center gap-2 text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-100 active:bg-gray-200 rounded-md"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete?.(task);
                }}
              >
                <X size={12} className="text-gray-600" />
                Delete
              </button>
            </div>,
            document.body
          )}
      </div>

      {/* Clickable content area */}
      <div onClick={handleCardClick} className="cursor-pointer">
        <div className="mb-3 pr-6">
          <h4 className="flex flex-wrap items-baseline text-sm font-semibold text-gray-800 leading-tight">
            <span className="break-words whitespace-normal mr-2">
              {task.title}
            </span>
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] leading-none font-medium border whitespace-nowrap",
                priorityColors[task.priority]
              )}
            >
              {task.priority}
            </span>
          </h4>
        </div>

        <p className="text-xs text-gray-600 mb-4 line-clamp-3 leading-relaxed">
          {formatDescription(task.description)}
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
