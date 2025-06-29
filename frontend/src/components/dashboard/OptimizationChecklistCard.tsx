import React, { useState, useEffect } from 'react';
import Card from '../ui/Card';
import { cn } from '../../lib/utils';

const checklistItems = [
    "Run Experimental Search on your benchmarking questions to see where you rank vs your competitors.",
    "Create and publish content after applying the AI Content Optimizer tool.",
    "Identify top-performing competitor content for inspiration.",
    "Review sentiment analysis for brand perception insights.",
    "Analyze response details to find content gaps and opportunities.",
    "Optimize existing content based on AI feedback.",
    "Update company profile and competitor list for accuracy.",
    "Schedule regular report generation to track progress over time.",
];

const OptimizationChecklistCard: React.FC = () => {
    const [completed, setCompleted] = useState<number[]>([]);
    const [justCompleted, setJustCompleted] = useState<number[]>([]);
    const [sliding, setSliding] = useState<number[]>([]);

    const toggleCompleted = (index: number) => {
        const isCurrentlyCompleted = completed.includes(index);
        
        if (!isCurrentlyCompleted) {
            // Task is being completed
            setJustCompleted(prev => [...prev, index]);
            
            // After a short delay, start the sliding animation
            setTimeout(() => {
                setSliding(prev => [...prev, index]);
                
                // After the sliding animation duration, actually move it to completed
                setTimeout(() => {
                    setCompleted(prev => [...prev, index]);
                    setJustCompleted(prev => prev.filter(i => i !== index));
                    setSliding(prev => prev.filter(i => i !== index));
                }, 800); // Duration of sliding animation
            }, 300); // Initial delay before sliding starts
        } else {
            // Task is being uncompleted - immediate update
            setCompleted(prev => prev.filter(i => i !== index));
            setJustCompleted(prev => prev.filter(i => i !== index));
            setSliding(prev => prev.filter(i => i !== index));
        }
    };

    // Create items with their original indices and sort them
    const itemsWithIndices = checklistItems.map((item, index) => ({
        item,
        originalIndex: index,
        isCompleted: completed.includes(index),
        isJustCompleted: justCompleted.includes(index),
        isSliding: sliding.includes(index)
    }));

    // Sort items: incomplete items first, then completed items
    // Items that are "justCompleted" or "sliding" stay in their original position until animation completes
    const sortedItems = itemsWithIndices.sort((a, b) => {
        const aEffectivelyCompleted = a.isCompleted && !a.isJustCompleted && !a.isSliding;
        const bEffectivelyCompleted = b.isCompleted && !b.isJustCompleted && !b.isSliding;
        
        if (aEffectivelyCompleted === bEffectivelyCompleted) {
            // If both have the same completion status, maintain original order
            return a.originalIndex - b.originalIndex;
        }
        // Incomplete items come first (false < true)
        return aEffectivelyCompleted ? 1 : -1;
    });

    return (
        <Card className="h-full flex flex-col p-6">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-800">Optimization Checklist</h3>
                <span className="text-sm font-medium text-gray-600">
                    Completed: {completed.length} / {checklistItems.length}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="space-y-2 relative">
                    {sortedItems.map(({ item, originalIndex, isCompleted, isJustCompleted, isSliding }) => {
                        const isVisuallyCompleted = isCompleted || isJustCompleted || isSliding;
                        
                        // Calculate how many positions down this item should slide
                        const incompleteCount = sortedItems.filter(i => !i.isCompleted && !i.isJustCompleted && !i.isSliding).length;
                        const currentPosition = sortedItems.findIndex(i => i.originalIndex === originalIndex);
                        const targetPosition = isSliding ? incompleteCount + sliding.filter(i => i < originalIndex).length : currentPosition;
                        const slideDistance = isSliding ? (targetPosition - currentPosition) * 60 : 0; // Approximate height per item
                        
                        return (
                            <label
                                key={originalIndex}
                                htmlFor={`checklist-item-${originalIndex}`}
                                className={cn(
                                    "flex items-start p-3 rounded-lg cursor-pointer relative",
                                    isVisuallyCompleted ? "bg-gray-100 shadow-sm" : "bg-white hover:bg-gray-50",
                                    isJustCompleted && "shadow-md",
                                    isSliding && "z-10 shadow-lg",
                                    // Transition classes
                                    !isSliding && "transition-all duration-300",
                                    isSliding && "transition-all duration-700 ease-in-out"
                                )}
                                style={{
                                    transform: isSliding ? `translateY(${slideDistance}px)` : 'translateY(0)',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    id={`checklist-item-${originalIndex}`}
                                    className="h-5 w-5 rounded border-gray-300 text-[#7762ff] focus:ring-[#7762ff] focus:ring-offset-0 accent-[#7762ff]"
                                    checked={isVisuallyCompleted}
                                    onChange={() => toggleCompleted(originalIndex)}
                                />
                                <span className={cn(
                                    "ml-3 text-sm transition-all duration-300",
                                    isVisuallyCompleted ? "text-gray-500 line-through" : "text-gray-800"
                                )}>
                                    {item}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
};

export default OptimizationChecklistCard;
