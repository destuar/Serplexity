/**
 * @file MockSidebar.tsx
 * @description A mock sidebar component for the dashboard layout previewed on the landing page.
 * It simulates the main navigation sidebar of the application.
 *
 * @dependencies
 * - react: For rendering the component.
 * - lucide-react: For icons.
 *
 * @exports
 * - MockSidebar: The main component.
 */
import {
  BarChart2,
  ChevronDown,
  ChevronsLeft,
  Sparkles,
  Wrench,
} from "lucide-react";
import React from "react";

interface MockSidebarProps {
  activePage: string;
}

const MockSidebar: React.FC<MockSidebarProps> = ({ activePage }) => {
  const getLinkClass = (pageName: string) => {
    const baseClass = `flex items-center p-3 text-lg font-normal rounded-xl transition-all duration-300`;
    
    if (pageName === activePage) {
      return `${baseClass} bg-gray-200/60 text-gray-900`;
    }
    
    return `${baseClass} text-gray-600 hover:bg-gray-100/50 hover:text-gray-900`;
  };

  const getSectionHeaderClass = () => {
    return `flex items-center justify-between mb-4 cursor-pointer p-2 rounded-xl hover:bg-gray-100/50 transition-all duration-300`;
  };

  return (
    <div className="w-80 bg-white/80 backdrop-blur-md border-r border-gray-200/50 text-gray-900 flex flex-col">
      <div className="flex items-center py-4 border-b border-gray-200/50 px-4">
        <div className="flex items-center no-underline">
          <img
            src="/Serplexity.svg"
            alt="Serplexity Logo"
            className="w-8 h-8"
          />
          <h1 className="text-2xl font-bold ml-3 text-gray-900">Serplexity</h1>
        </div>
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col px-4 pt-3 flex-1 overflow-y-auto">
        <div 
          className={getSectionHeaderClass()}
        >
          <div className={`flex items-center`}>
            <Sparkles className="text-gray-600" size={20} />
            <span className="ml-2 text-gray-700 font-medium text-xl">AI Performance</span>
          </div>
          <ChevronDown className="text-gray-500" size={16} />
        </div>
        <nav className="flex flex-col space-y-1 mb-4">
            <div className={getLinkClass("Overview")}>
              <span className="ml-3 font-medium">Overview</span>
            </div>
            <div className={getLinkClass("Progress Report")}>
              <span className="ml-3">Progress Report</span>
            </div>
            <div className={getLinkClass("Visibility Tasks")}>
              <span className="ml-3">Visibility Tasks</span>
            </div>
            <div className={getLinkClass("Sentiment Analysis")}>
              <span className="ml-3">Sentiment Analysis</span>
            </div>
            <div className={getLinkClass("Response Details")}>
              <span className="ml-3">Response Details</span>
            </div>
          </nav>
        <div 
          className={getSectionHeaderClass()}
        >
          <div className={`flex items-center`}>
            <BarChart2 className="text-gray-600" size={20} />
            <span className="ml-2 text-gray-700 font-medium text-xl">Market Analysis</span>
          </div>
          <ChevronDown className="text-gray-500" size={16} />
        </div>
        <nav className="flex flex-col space-y-1 mb-4">
            <div className={getLinkClass("Competitor Rankings")}>
              <span className="ml-3">Competitor Rankings</span>
            </div>
            <div className={getLinkClass("Model Comparison")}>
              <span className="ml-3">Model Comparison</span>
            </div>
          </nav>
        <div 
          className={getSectionHeaderClass()}
        >
          <div className={`flex items-center`}>
            <Wrench className="text-gray-600" size={20} />
            <span className="ml-2 text-gray-700 font-medium text-xl">AI Content Tools</span>
          </div>
          <ChevronDown className="text-gray-500" size={16} />
        </div>
        <nav className="flex flex-col space-y-1">
            <div className={getLinkClass("Experimental Search")}>
              <span className="ml-3">Experimental Search</span>
            </div>
            <div className={getLinkClass("AI Content Optimizer")}>
              <span className="ml-3">AI Content Optimizer</span>
            </div>
            <div className={getLinkClass("GEO Content Guides")}>
              <span className="ml-3">GEO Content Guides</span>
            </div>
          </nav>
        </div>
        <div className="px-4 pb-4 mt-auto">
          <button 
            className={`flex items-center p-3 text-base font-normal text-gray-600 rounded-xl hover:bg-gray-100/50 hover:text-gray-900 w-full transition-all duration-300 justify-end`}
          >
            <ChevronsLeft size={20} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MockSidebar; 