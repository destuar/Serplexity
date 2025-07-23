import React from 'react';

interface LiquidGlassSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LiquidGlassSpinner: React.FC<LiquidGlassSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeMap = {
    sm: 12,   // Very small
    md: 16,   // Small  
    lg: 20    // Medium
  };
  
  const spinnerSize = sizeMap[size];
  const offset = spinnerSize * 0.44;

  const spinnerStyle = {
    '--spinner-size': `${spinnerSize}px`,
    '--spinner-offset': `${offset}px`,
    width: spinnerSize,
    height: spinnerSize
  } as React.CSSProperties;

  return (
    <div className={`relative mx-auto flex items-center justify-center ${className}`} style={spinnerStyle}>
      <div className="relative w-full h-full">
        <div className="absolute inset-0 bg-black rounded-full animate-[glass-spinner-slide_2s_ease-in-out_infinite]"></div>
        <div className="absolute inset-0 bg-black/5 backdrop-blur-md border border-white/10 rounded-full animate-[glass-spinner-slide_2s_ease-in-out_infinite] z-10" style={{ animationDelay: '-1s' }}></div>
      </div>
      
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes glass-spinner-slide {
            0%, 100% { transform: translateX(calc(-1 * var(--spinner-offset))); }
            50% { transform: translateX(var(--spinner-offset)); }
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-\\[glass-spinner-slide_2s_ease-in-out_infinite\\] {
              animation: none !important;
              transform: translateX(0) !important;
            }
          }
        `
      }} />
    </div>
  );
};

export default LiquidGlassSpinner;