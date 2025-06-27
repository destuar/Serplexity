import React from 'react';
import { Loader } from 'lucide-react';

interface BlankLoadingStateProps {
  message?: string;
}

const BlankLoadingState: React.FC<BlankLoadingStateProps> = ({ 
  message = "Loading dashboard data..." 
}) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
};

export default BlankLoadingState; 