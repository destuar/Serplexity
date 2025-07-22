/**
 * @file AverageInclusionRateCard.tsx
 * @description This component displays the average inclusion rate for the selected company, along with its change
 * from the previous period. It fetches data from the `useDashboard` hook and renders it within a `Card` component.
 * It includes visual indicators for positive or negative changes and handles loading and error states. This card
 * provides a key metric for understanding how often the company is mentioned in AI-generated content.
 *
 * @dependencies
 * - ../ui/Card: Generic card component for consistent UI.
 * - ../../hooks/useDashboard: Custom hook for accessing dashboard data.
 * - react-icons/fi: Feather icons for visual indicators.
 *
 * @exports
 * - AverageInclusionRateCard: React functional component for displaying the average inclusion rate.
 */
import LiquidGlassCard from '../ui/LiquidGlassCard';
import { useDashboard } from '../../hooks/useDashboard';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';

const AverageInclusionRateCard = () => {
  const { data, loading, error } = useDashboard();
  
  const averageInclusionRate = data?.averageInclusionRate;
  const change = data?.averageInclusionChange;

  // Check if we have actual data to display
  const hasData = !loading && !error && averageInclusionRate !== null && averageInclusionRate !== undefined;

  const renderChange = () => {
    if (change === null || change === undefined) {
      // No prior data point - show gray dash
      return (
        <span className="flex items-center justify-center text-sm font-medium text-gray-400 w-12">
          —
        </span>
      );
    }

    // Show gray dash for changes less than 0.1% (including 0)
    if (Math.abs(change) < 0.1) {
      return (
        <span className="flex items-center justify-center text-sm font-medium text-gray-400 w-12">
          —
        </span>
      );
    }

    // For inclusion rate: increase is good, decrease is bad
    const isPositive = change > 0;
    const changeColor = isPositive ? 'text-green-500' : 'text-red-500';
    const Icon = isPositive ? FiArrowUp : FiArrowDown;

    return (
      <span className={`flex items-center text-sm font-medium ${changeColor}`}>
        <Icon className="mr-1 h-4 w-4" />
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  };

  return (
    <LiquidGlassCard>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Average Inclusion Rate</h3>
      <div className="flex-1 flex items-center justify-center">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : hasData ? (
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2">
              <p className="text-5xl font-bold text-gray-800">
                {(averageInclusionRate ?? 0).toFixed(1)}%
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

export default AverageInclusionRateCard; 