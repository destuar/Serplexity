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
    sm: 12,
    md: 16,
    lg: 20
  };
  
  const spinnerSize = sizeMap[size];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className="animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
        style={{
          width: spinnerSize,
          height: spinnerSize
        }}
      />
    </div>
  );
};

export default LiquidGlassSpinner;