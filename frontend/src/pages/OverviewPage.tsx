import { Calendar, ChevronDown, Sparkles, RefreshCw } from "lucide-react";
import React from "react";
import BrandShareOfVoiceCard from "../components/dashboard/BrandShareOfVoiceCard";
import BrandVisibilityCard from "../components/dashboard/BrandVisibilityCard";
import ConceptSourceCard from "../components/dashboard/ConceptSourceCard";
import KeywordTrendCard from "../components/dashboard/KeywordTrendCard";
import SentimentCard from "../components/dashboard/SentimentCard";
import SourceChangesCard from "../components/dashboard/SourceChangesCard";

const OverviewPage = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Header Section - Fixed Height */}
      <div className="flex-shrink-0 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto">
          <button className="flex items-center justify-between w-full lg:w-48 gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm">
            <span className="flex items-center gap-2 truncate">
              <Calendar size={16} />
              <span className="truncate">Last 30 days</span>
            </span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center justify-between w-full lg:w-48 gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm">
            <span className="flex items-center gap-2 truncate">
              <Sparkles size={16} />
              <span className="truncate">Gemini 1.5 Pro</span>
            </span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center justify-between w-full lg:w-48 gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm">
            <span className="flex items-center gap-2 truncate">
              <span className="truncate">CodeLadder.io</span>
            </span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center justify-between w-full lg:w-48 gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm">
            <span className="flex items-center gap-2 truncate">
              <span className="truncate">Electronics</span>
            </span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center justify-center w-full lg:w-auto gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium col-span-2">
            <RefreshCw size={16} />
            <span className="whitespace-nowrap">Refresh data</span>
          </button>
        </div>
      </div>
      
      {/* Dashboard Grid - Dynamic Height with Custom Rows */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 grid-rows-[min-content_1fr] gap-4 min-h-0">
        <BrandShareOfVoiceCard />
        <BrandVisibilityCard />
        <KeywordTrendCard />
        <SentimentCard />
        <div className="col-span-1 md:col-span-2 flex">
          <SourceChangesCard />
        </div>
        <div className="col-span-1 md:col-span-2 flex">
          <ConceptSourceCard />
        </div>
      </div>
    </div>
  );
};

export default OverviewPage; 