import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import Card from "../ui/Card";

const data = [
  { name: "Positive", value: 40 },
  { name: "Negative", value: 20 },
  { name: "Neutral", value: 40 },
];

const COLORS = ["#22c55e", "#ef4444", "#9ca3af"]; // green-500, red-500, gray-400

const SentimentCard = () => {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Sentiment</h2>
      <div className="flex items-center justify-between">
        <div className="relative w-24 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={48}
                fill="#8884d8"
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-gray-800">2,420</span>
          </div>
        </div>
        <div className="flex flex-col space-y-1.5 ml-3 min-w-[120px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2"></div>
              <span className="text-xs text-gray-600">Positive</span>
            </div>
            <span className="text-xs font-semibold text-gray-800">968 (40%)</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2"></div>
              <span className="text-xs text-gray-600">Negative</span>
            </div>
            <span className="text-xs font-semibold text-gray-800">484 (20%)</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-400 mr-2"></div>
              <span className="text-xs text-gray-600">Neutral</span>
            </div>
            <span className="text-xs font-semibold text-gray-800">968 (40%)</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SentimentCard; 