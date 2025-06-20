import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import Card from "../ui/Card";
import { useDashboard } from "../../contexts/DashboardContext";

const COLORS = ["#22c55e", "#e5e7eb"]; // green-500, gray-200

const BrandShareOfVoiceCard = () => {
  const { data, loading } = useDashboard();
  
  const brandData = data?.brandShareOfVoice;
  const value = brandData?.value || 0;
  const change = brandData?.change || 0;
  const changeType = brandData?.changeType || 'increase';
  
  const chartData = [
    { name: "Current", value: value },
    { name: "Other", value: Math.max(0, 100 - value) },
  ];

  if (loading) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Brand Share of Voice
        </h2>
        <div className="flex items-center justify-center h-24">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Brand Share of Voice
      </h2>
      <div className="flex items-center justify-between">
        <div className="relative w-24 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={48}
                fill="#8884d8"
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-gray-800">{value}%</span>
          </div>
        </div>
        <div className="flex flex-col space-y-2 ml-3">
          <div className="flex items-center space-x-2">
            {changeType === 'increase' ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${
              changeType === 'increase' ? 'text-green-600' : 'text-red-600'
            }`}>
              {Math.abs(change)}%
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2"></div>
            <span className="text-xs text-gray-600">Your Brand</span>
          </div>
          <div className="flex items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-200 mr-2"></div>
            <span className="text-xs text-gray-600">Others</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default BrandShareOfVoiceCard; 