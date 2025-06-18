import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import Card from "../ui/Card";

const data = [
  { name: "Excellent", value: 82 },
  { name: "Other", value: 18 },
];

const COLORS = ["#22c55e", "#e5e7eb"]; // green-500, gray-200

const BrandShareOfVoiceCard = () => {
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
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-gray-800">82%</span>
          </div>
        </div>
        <div className="flex flex-col space-y-1.5 ml-3">
          <div className="flex items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2"></div>
            <span className="text-xs text-gray-600">Poor</span>
          </div>
          <div className="flex items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-400 mr-2"></div>
            <span className="text-xs text-gray-600">Normal</span>
          </div>
          <div className="flex items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2"></div>
            <span className="text-xs text-gray-600">Excellent</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default BrandShareOfVoiceCard; 