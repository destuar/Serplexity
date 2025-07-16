/**
 * @file OptimizationChecklistCard.tsx
 * @description This component displays a checklist of AI visibility optimization tasks. It fetches tasks
 * from the `useDashboard` hook, allows users to toggle their completion status, and provides visual feedback
 * for completed tasks, including a sliding animation. It also sorts tasks by completion status and priority.
 * This component is crucial for guiding users through actionable steps to improve their AI visibility.
 *
 * @dependencies
 * - react: The core React library.
 * - ../../services/reportService: Service for interacting with report-related APIs, specifically for toggling task completion.
 * - ../../hooks/useDashboard: Custom hook for accessing dashboard data.
 * - ../ui/Card: Generic card component for consistent UI.
 * - ../../lib/utils: Utility functions (e.g., `cn` for class names).
 *
 * @exports
 * - OptimizationChecklistCard: React functional component for displaying the optimization checklist.
 */
import React, { useState, useEffect } from 'react';
import { toggleTaskCompletion, OptimizationTask } from '../../services/reportService';
import { useDashboard } from '../../hooks/useDashboard';
import Card from '../ui/Card';
import { cn } from '../../lib/utils';

const OptimizationChecklistCard: React.FC = () => {
    const { data, loading } = useDashboard();
    const [tasks, setTasks] = useState<OptimizationTask[]>([]);
    const [justCompleted, setJustCompleted] = useState<string[]>([]);
    const [sliding, setSliding] = useState<string[]>([]);

    // Whenever dashboard data updates, sync tasks locally
    useEffect(() => {
        if (data?.optimizationTasks) {
            setTasks(data.optimizationTasks);
        } else {
            setTasks([]);
        }
    }, [data?.optimizationTasks]);

    const handleToggleCompleted = async (task: OptimizationTask) => {
        // Extract reportRunId from the task's reportRunId field
        // For now, we'll need to get this from the most recent report
        // This is a simplified approach - in production you might want to store this differently
        try {
            const isCurrentlyCompleted = task.isCompleted;
            
            if (!isCurrentlyCompleted) {
                // Task is being completed - add visual feedback
                setJustCompleted(prev => [...prev, task.taskId]);
                setTimeout(() => {
                    setSliding(prev => [...prev, task.taskId]);
                    setTimeout(() => {
                        setJustCompleted(prev => prev.filter(id => id !== task.taskId));
                        setSliding(prev => prev.filter(id => id !== task.taskId));
                    }, 800);
                }, 300);
            }
            
            // Optimistically update the UI
            setTasks(prev => prev.map(t => 
                t.taskId === task.taskId 
                    ? { ...t, isCompleted: !t.isCompleted, completedAt: !t.isCompleted ? new Date().toISOString() : undefined }
                    : t
            ));
            
            // Call API to toggle completion using the reportRunId
            const reportRunId = task.reportRunId;
            await toggleTaskCompletion(reportRunId, task.taskId);
            
        } catch (error) {
            console.error('Error toggling task completion:', error);
            // Revert optimistic update on error
            setTasks(prev => prev.map(t => 
                t.taskId === task.taskId 
                    ? { ...t, isCompleted: task.isCompleted, completedAt: task.completedAt }
                    : t
            ));
        }
    };

    // Create items with their completion status and sort them
    const tasksWithStatus = tasks.map(task => ({
        ...task,
        isJustCompleted: justCompleted.includes(task.taskId),
        isSliding: sliding.includes(task.taskId)
    }));

    // Sort tasks: incomplete first, then completed
    const sortedTasks = tasksWithStatus.sort((a, b) => {
        const aEffectivelyCompleted = a.isCompleted && !a.isJustCompleted && !a.isSliding;
        const bEffectivelyCompleted = b.isCompleted && !b.isJustCompleted && !b.isSliding;
        
        if (aEffectivelyCompleted === bEffectivelyCompleted) {
            // If both have the same completion status, maintain priority order
            const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        // Incomplete tasks come first
        return aEffectivelyCompleted ? 1 : -1;
    });

    const completedCount = tasks.filter(task => task.isCompleted).length;

    if (loading) {
        return (
            <Card className="h-full flex flex-col p-6">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-800">Optimization Checklist</h3>
                    <div className="bg-gray-200 rounded h-4 w-20 animate-pulse"></div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-gray-100 rounded h-16 animate-pulse"></div>
                    ))}
                </div>
            </Card>
        );
    }

    if (tasks.length === 0) {
        return (
            <Card className="h-full flex flex-col p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex-shrink-0">Optimization Checklist</h3>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-gray-400 mb-2">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-gray-500 text-sm font-medium">No optimization tasks available</p>
                        <p className="text-gray-400 text-xs mt-1">Tasks will be generated with your first report</p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col p-6">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800">Optimization Checklist</h3>
                <span className="text-sm font-medium text-gray-600">
                    Completed: {completedCount} / {tasks.length}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="space-y-2 relative">
                    {sortedTasks.map((task) => {
                        const isVisuallyCompleted = task.isCompleted || task.isJustCompleted || task.isSliding;
                        
                        // Calculate slide distance for animation
                        const incompleteCount = sortedTasks.filter(t => !t.isCompleted && !t.isJustCompleted && !t.isSliding).length;
                        const currentPosition = sortedTasks.findIndex(t => t.taskId === task.taskId);
                        const targetPosition = task.isSliding ? incompleteCount + sliding.filter(id => tasks.find(t => t.taskId === id)?.priority === 'High' ? -1 : 1).length : currentPosition;
                        const slideDistance = task.isSliding ? (targetPosition - currentPosition) * 70 : 0;
                        
                        return (
                            <label
                                key={task.taskId}
                                htmlFor={`task-${task.taskId}`}
                                className={cn(
                                    "flex items-start p-3 rounded-lg cursor-pointer relative transition-all duration-300",
                                    isVisuallyCompleted ? "bg-gray-100 shadow-sm" : "bg-white hover:bg-gray-50",
                                    task.isJustCompleted && "shadow-md",
                                    task.isSliding && "z-10 shadow-lg transition-all duration-700 ease-in-out"
                                )}
                                style={{
                                    transform: task.isSliding ? `translateY(${slideDistance}px)` : 'translateY(0)',
                                }}
                                title={task.description}
                            >
                                <input
                                    type="checkbox"
                                    id={`task-${task.taskId}`}
                                    className="h-5 w-5 rounded border-gray-300 text-[#7762ff] focus:ring-[#7762ff] focus:ring-offset-0 accent-[#7762ff]"
                                    checked={isVisuallyCompleted}
                                    onChange={() => handleToggleCompleted(task)}
                                />
                                <div className="ml-3 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn(
                                            "text-sm font-medium transition-all duration-300",
                                            isVisuallyCompleted ? "text-gray-500 line-through" : "text-gray-800"
                                        )}>
                                            {task.title}
                                        </span>
                                        <span
                                            className={cn(
                                                "px-2 py-1 text-xs rounded-full font-medium",
                                                task.priority === 'High'
                                                    ? 'bg-red-100 text-red-700'
                                                    : task.priority === 'Medium'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-green-100 text-green-700'
                                            )}
                                        >
                                            {task.priority}
                                        </span>
                                        {/* Category badge */}
                                        <span className="px-2 py-1 text-xs rounded-full font-medium bg-gray-100 text-gray-700">
                                            {task.category}
                                        </span>
                                        {/* Impact metric badge */}
                                        <span className="px-2 py-1 text-xs rounded-full font-medium bg-gray-100 text-gray-700">
                                            {task.impactMetric}
                                        </span>
                                    </div>
                                    <p
                                        className={cn(
                                            "text-xs transition-all duration-300 whitespace-normal break-words",
                                            isVisuallyCompleted ? "text-gray-400" : "text-gray-600"
                                        )}
                                    >
                                        {task.description}
                                    </p>
                                </div>
                            </label>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
};

export default OptimizationChecklistCard;
