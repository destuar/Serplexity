/**
 * @file AveragePositionCard.tsx
 * @description This component displays the average position for the selected company, along with its change
 * from the previous period. It fetches data from the `useDashboard` hook and renders it within a `Card` component.
 * It includes visual indicators for positive or negative changes (where a lower position is better) and handles
 * loading and error states. This card provides a key metric for understanding the company's ranking in AI-generated content.
 *
 * @dependencies
 * - ../ui/Card: Generic card component for consistent UI.
 * - ../../hooks/useDashboard: Custom hook for accessing dashboard data.
 * - react-icons/fi: Feather icons for visual indicators.
 *
 * @exports
 * - AveragePositionCard: React functional component for displaying the average position.
 */
import LiquidGlassCard from '../ui/LiquidGlassCard';
import { useDashboard } from '../../hooks/useDashboard';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';

const AveragePositionCard = () => {
  const { data, loading, error } = useDashboard();
  
  const averagePosition = data?.averagePosition;
  const change = data?.averagePositionChange;

  // Check if we have actual data to display
  const hasData = !loading && !error && averagePosition !== null && averagePosition !== undefined;

  const renderChange = () => {
    if (change === null || change === undefined) {
      // No prior data point - show gray dash
      return (
        <span className="flex items-center justify-center text-sm font-medium text-gray-400 w-12">
          —
        </span>
      );
    }

    // Show gray dash for changes less than 0.1 (including 0)
    if (Math.abs(change) < 0.1) {
      return (
        <span className="flex items-center justify-center text-sm font-medium text-gray-400 w-12">
          —
        </span>
      );
    }

    // For position: decrease towards 1 is good (improvement), increase is bad (worse ranking)
    // Positive change = position got worse (moved from 2 to 5)
    // Negative change = position got better (moved from 5 to 2)
    const isImprovement = change < 0; // Negative change means better position
    const changeColor = isImprovement ? 'text-green-500' : 'text-red-500';
    const Icon = isImprovement ? FiArrowDown : FiArrowUp; // Down arrow = improvement, Up arrow = worse

    return (
      <span className={`flex items-center text-sm font-medium ${changeColor}`}>
        <Icon className="mr-1 h-4 w-4" />
        {Math.abs(change).toFixed(1)}
      </span>
    );
  };

  return (
    <LiquidGlassCard>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Average Position</h3>
      <div className="flex-1 flex items-center justify-center">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : hasData ? (
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2">
              <p className="text-5xl font-bold text-gray-800">
                {(averagePosition ?? 0).toFixed(1)}
              </p>
              {renderChange()}
            </div>
          </div>
        ) : (
          <div className="text-center">
            {/* Empty state - show nothing but maintain card structure */}
          </div>
        )}
      </div>
    </LiquidGlassCard>
  );
};

export default AveragePositionCard; 