import React from "react";
import Card from "../ui/Card";

const KeywordTrendCard = () => {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Keyword Trend
      </h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-2xl font-bold text-gray-800">234</span>
            <span className="text-green-500 text-xs font-semibold">+12.45%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: "75%" }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-2xl font-bold text-gray-800">805</span>
            <span className="text-red-500 text-xs font-semibold">-40.23%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-red-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: "40%" }}
            ></div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default KeywordTrendCard; 