/**
 * @file LiquidGlassCard.tsx
 * @description Liquid glass card component with glassmorphism effects for dashboard elements.
 * Provides the futuristic, space-forward design theme with layered glass effects.
 *
 * @dependencies
 * - react: For component functionality
 *
 * @exports
 * - LiquidGlassCard: React functional component with liquid glass styling
 */
import React from 'react';

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'compact';
}

const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({ 
  children, 
  className = '', 
  style,
  variant = 'default'
}) => {
  const padding = variant === 'compact' ? 'p-3' : 'p-4';
  const borderRadius = variant === 'compact' ? 'rounded-lg' : 'rounded-lg';

  return (
    <div 
      className={`relative bg-white/80 backdrop-blur-sm ${borderRadius} shadow-md border border-white/20 ${padding} overflow-hidden h-full flex flex-col ${className}`}
      style={style}
    >
      {/* Inner content with relative positioning */}
      <div className="relative z-10 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default LiquidGlassCard; 