import { Eye } from "lucide-react";
import React from "react";
import Card from "../ui/Card";

const BrandVisibilityCard = () => {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Brand Visibility
      </h2>
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
          <Eye size={24} className="text-blue-600" />
        </div>
        <span className="text-4xl font-bold text-gray-800 mb-1">64%</span>
        <span className="text-xs text-gray-500 mb-1">Average Position</span>
        <span className="text-2xl font-bold text-gray-800">2.4</span>
      </div>
    </Card>
  );
};

export default BrandVisibilityCard; 