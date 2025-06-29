import React from 'react';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import MockDashboardCard from './MockDashboardCard';

const MOCK_AVG_POSITION = 2.1;
const MOCK_CHANGE = -0.2;

const MockAveragePositionCard: React.FC = () => {
  const renderChange = () => {
    if (Math.abs(MOCK_CHANGE) < 0.1) {
      return (
        <span className="flex items-center justify-center text-xs font-medium text-gray-400 w-10">
          —
        </span>
      );
    }

    const isImprovement = MOCK_CHANGE < 0; // Negative change is better
    const changeColor = isImprovement ? 'text-green-500' : 'text-red-500';
    const Icon = isImprovement ? FiArrowDown : FiArrowUp;

    return (
      <span className={`flex items-center text-xs font-medium ${changeColor}`}>
        <Icon className="mr-0.5 h-3 w-3" />
        {Math.abs(MOCK_CHANGE).toFixed(1)}
      </span>
    );
  };

  return (
    <MockDashboardCard>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Average Position</h3>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2">
            <p className="text-5xl font-bold text-gray-800">
              {MOCK_AVG_POSITION.toFixed(1)}
            </p>
            {renderChange()}
          </div>
        </div>
      </div>
    </MockDashboardCard>
  );
};

export default MockAveragePositionCard; 