import React from 'react';

interface InlineSpinnerProps {
  size?: number;
  className?: string;
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = ({ 
  size = 16, 
  className = '' 
}) => {
  const spinnerStyle = {
    '--spinner-size': `${size}px`,
    '--spinner-offset': `${size * 0.35}px`,
    width: size,
    height: size
  } as React.CSSProperties;

  return (
    <div 
      className={`inline-block align-middle ${className}`}
      style={spinnerStyle}
    >
      <div className="relative w-full h-full">
        <div className="absolute inset-0 bg-black rounded-full animate-[spinner-slide_2s_ease-in-out_infinite]"></div>
        <div className="absolute inset-0 bg-black/5 backdrop-blur-sm border border-white/10 rounded-full animate-[spinner-slide_2s_ease-in-out_infinite] z-10" style={{ animationDelay: '-1s' }}></div>
      </div>
      
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spinner-slide {
            0%, 100% { transform: translateX(calc(-1 * var(--spinner-offset))); }
            50% { transform: translateX(var(--spinner-offset)); }
          }
          @media (prefers-reduced-motion: reduce) {
            .animate-\\[spinner-slide_2s_ease-in-out_infinite\\] {
              animation: none !important;
              transform: translateX(0) !important;
            }
          }
        `
      }} />
    </div>
  );
};

export default InlineSpinner;