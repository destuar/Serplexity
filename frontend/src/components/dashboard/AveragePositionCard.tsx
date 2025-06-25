import Card from '../ui/Card';
import { useDashboard } from '../../hooks/useDashboard';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';

const AveragePositionCard = () => {
  const { data, loading, error } = useDashboard();
  
  const averagePositionData = data?.averagePosition;
  const averagePosition = averagePositionData?.averagePosition;
  const change = averagePositionData?.change;

  // Check if we have actual data to display
  const hasData = !loading && !error && averagePosition !== null && averagePosition !== undefined;

  const renderChange = () => {
    if (change === null || change === undefined) {
      // No prior data point - show gray arrow up with 0
      return (
        <span className="flex items-center text-sm font-medium text-gray-400">
          <FiArrowUp className="mr-1 h-4 w-4" />
          0
        </span>
      );
    }

    if (change === 0) {
      // No change - show gray arrow up
      return (
        <span className="flex items-center text-sm font-medium text-gray-400">
          <FiArrowUp className="mr-1 h-4 w-4" />
          0
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
    <Card>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Average Position</h3>
      <div className="flex-1 flex items-center justify-center">
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : error ? (
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
    </Card>
  );
};

export default AveragePositionCard; 