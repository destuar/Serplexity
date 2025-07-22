/**
 * @file BlankLoadingState.tsx
 * @description Loading state component that displays animated loading indicators and placeholder content.
 * Provides visual feedback during data loading operations with customizable animations and messaging.
 *
 * @dependencies
 * - react: For component rendering.
 * - LiquidGlassSpinner: For liquid glass design system spinner.
 *
 * @exports
 * - BlankLoadingState: The main loading state component.
 */
import React from 'react';
import { LiquidGlassSpinner } from './LiquidGlassSpinner';

interface BlankLoadingStateProps {
  message?: string;
}


const BlankLoadingState: React.FC<BlankLoadingStateProps> = ({ 
  message = "Loading dashboard data..." 
}) => {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0 h-full">
      <LiquidGlassSpinner size="lg" />
    </div>
  );
};

export default BlankLoadingState;