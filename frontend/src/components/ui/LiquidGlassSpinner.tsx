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

  return (
    <div className={`liquid-glass-spinner ${className}`}>
      <div className="loader"></div>

      <style jsx>{`
        .liquid-glass-spinner {
          position: relative;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${spinnerSize}px;
          height: ${spinnerSize}px;
        }

        .loader {
          position: relative;
          width: ${spinnerSize}px;
          height: ${spinnerSize}px;
        }

        .loader::before,
        .loader::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 50%;
        }

        /* Loader Black Circle */
        .loader::before {
          background: #000000;
          animation: animate 2s ease-in-out infinite;
        }

        /* Loader Glassmorphism */
        .loader::after {
          background: rgba(0, 0, 0, 0.05);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          animation: animate 2s ease-in-out infinite;
          z-index: 1;
          animation-delay: -1s;
        }

        /* Animation */
        @keyframes animate {
          0%,
          100% {
            transform: translateX(-${spinnerSize * 0.44}px);
          }
          50% {
            transform: translateX(${spinnerSize * 0.44}px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .loader::before,
          .loader::after {
            animation: none;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default LiquidGlassSpinner;