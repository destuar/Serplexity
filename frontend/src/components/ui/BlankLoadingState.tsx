import React from 'react';

interface BlankLoadingStateProps {
  message?: string;
}

const RocketshipLoader: React.FC = () => {
  return (
    <div className="relative w-16 h-20">
      {/* Rocketship SVG with slow rising animation */}
      <div className="absolute inset-0 animate-pulse" style={{ 
        animation: 'slowRise 3s ease-in-out infinite',
        animationDirection: 'alternate'
      }}>
        <svg
          viewBox="0 0 64 80"
          className="w-full h-full"
          fill="currentColor"
        >
          {/* Main rocket body - extremely pointed curved top with smooth transition, flat bottom */}
          <path 
            d="M22 35 Q32 0 42 35 Q42 40 42 65 L22 65 Q22 40 22 35 Z"
            fill="#7762ff" 
          />
          
          {/* Sharp curved fins - larger and fully attached */}
          <path 
            d="M22 55 Q14 58 16 68 Q18 62 22 65 Z" 
            fill="#7762ff" 
          />
          <path 
            d="M42 55 Q50 58 48 68 Q46 62 42 65 Z" 
            fill="#7762ff" 
          />
          
          {/* Rocket window */}
          <circle cx="32" cy="35" r="4" fill="#ffffff" opacity="0.9" />
          <circle cx="32" cy="35" r="3" fill="#7762ff" opacity="0.3" />
        </svg>
      </div>

      {/* Exhaust clouds */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1">
        <div className="relative">
          {/* Main exhaust cloud */}
          <div 
            className="w-6 h-6 bg-gray-300 rounded-full opacity-70"
            style={{ 
              animation: 'puffOut 2s ease-out infinite',
              animationDelay: '0s'
            }}
          ></div>
          {/* Secondary cloud puffs */}
          <div 
            className="absolute -left-2 top-1 w-4 h-4 bg-gray-200 rounded-full opacity-50"
            style={{ 
              animation: 'puffOut 2.5s ease-out infinite',
              animationDelay: '0.5s'
            }}
          ></div>
          <div 
            className="absolute -right-2 top-1 w-4 h-4 bg-white rounded-full opacity-60"
            style={{ 
              animation: 'puffOut 2.2s ease-out infinite',
              animationDelay: '0.8s'
            }}
          ></div>
          {/* Smaller trailing clouds */}
          <div 
            className="absolute -left-1 top-3 w-3 h-3 bg-gray-100 rounded-full opacity-40"
            style={{ 
              animation: 'puffOut 1.8s ease-out infinite',
              animationDelay: '1.2s'
            }}
          ></div>
          <div 
            className="absolute -right-1 top-3 w-3 h-3 bg-gray-200 rounded-full opacity-45"
            style={{ 
              animation: 'puffOut 2.1s ease-out infinite',
              animationDelay: '1.5s'
            }}
          ></div>
        </div>
      </div>

      {/* Dispersing cloud particles */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="relative">
          <div 
            className="absolute w-2 h-2 bg-gray-300 rounded-full opacity-30" 
            style={{ 
              left: '-6px', 
              animation: 'cloudDisperse 3s ease-out infinite',
              animationDelay: '0s' 
            }}
          ></div>
          <div 
            className="absolute w-2 h-2 bg-white rounded-full opacity-40" 
            style={{ 
              left: '6px', 
              animation: 'cloudDisperse 3.2s ease-out infinite',
              animationDelay: '0.7s' 
            }}
          ></div>
          <div 
            className="absolute w-1 h-1 bg-gray-200 rounded-full opacity-35" 
            style={{ 
              left: '0px', 
              top: '6px', 
              animation: 'cloudDisperse 2.8s ease-out infinite',
              animationDelay: '1.4s' 
            }}
          ></div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes slowRise {
            0% { transform: translateY(8px); }
            100% { transform: translateY(-8px); }
          }
          @keyframes puffOut {
            0% { 
              transform: scale(0.3); 
              opacity: 0.8; 
            }
            50% { 
              transform: scale(1); 
              opacity: 0.6; 
            }
            100% { 
              transform: scale(1.5); 
              opacity: 0; 
            }
          }
          @keyframes cloudDisperse {
            0% { 
              transform: scale(0.5) translateY(0px); 
              opacity: 0.5; 
            }
            100% { 
              transform: scale(0.8) translateY(12px); 
              opacity: 0; 
            }
          }
        `
      }} />
    </div>
  );
};

const BlankLoadingState: React.FC<BlankLoadingStateProps> = ({ 
  message = "Loading dashboard data..." 
}) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-6">
        <RocketshipLoader />
        <p className="text-gray-600 text-center max-w-xs">{message}</p>
      </div>
    </div>
  );
};

export default BlankLoadingState;