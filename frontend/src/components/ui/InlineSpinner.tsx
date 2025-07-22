import React from 'react';

interface InlineSpinnerProps {
  size?: number;
  className?: string;
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = ({ 
  size = 16, 
  className = '' 
}) => {
  return (
    <div 
      className={`inline-spinner ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="loader"></div>

      <style jsx>{`
        .inline-spinner {
          display: inline-block;
          vertical-align: middle;
        }

        .loader {
          position: relative;
          width: ${size}px;
          height: ${size}px;
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
          backdrop-filter: blur(2px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          animation: animate 2s ease-in-out infinite;
          z-index: 1;
          animation-delay: -1s;
        }

        /* Animation - scaled for smaller size */
        @keyframes animate {
          0%,
          100% {
            transform: translateX(-${size * 0.35}px);
          }
          50% {
            transform: translateX(${size * 0.35}px);
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

export default InlineSpinner;