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
  ChevronDown,
  ChevronsLeft,
  BarChart3,
  MessageSquare,
  Users,
  Flag,
  Search,
} from "lucide-react";
import React from "react";

interface MockSidebarProps {
  activePage: string;
}

const MockSidebar: React.FC<MockSidebarProps> = ({ activePage }) => {
  const getLinkClass = (pageName: string) => {
    const baseClass = `flex items-center p-3 text-sm font-normal rounded-xl transition-all duration-300 gap-3`;
    
    // Handle hierarchical page names
    const isActive = activePage === pageName || 
                    (pageName === "Dashboard" && activePage === "Dashboard → Sentiment") ||
                    (pageName === "Prompts" && activePage === "Prompts → Responses");
    
    if (isActive) {
      return `${baseClass} bg-gray-200/60 text-gray-900`;
    }
    
    return `${baseClass} text-gray-600 hover:bg-gray-100/50 hover:text-gray-900`;
  };

  const getSectionHeaderClass = () => {
    return `flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-gray-100/50 transition-all duration-300`;
  };

  return (
    <div className="w-64 bg-white/80 backdrop-blur-md border-r border-gray-200/50 text-gray-900 flex flex-col">
      <div className="flex items-center py-2 border-b border-gray-200/50 px-3 min-h-[56px]">
        <div className="flex items-center w-full gap-2 px-2 py-2">
          <img
            src="/Serplexity.svg"
            alt="Serplexity Logo"
            className="w-6 h-6"
          />
          <span className="text-sm font-medium text-gray-900 truncate">
            Serplexity
          </span>
        </div>
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col px-4 pt-3 flex-1 overflow-y-auto space-y-4">
          {/* AI Performance Section */}
          <div>
            <div className={getSectionHeaderClass()}>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 font-medium">AI Performance</span>
              </div>
              <ChevronDown className="text-gray-400" size={16} />
            </div>
            <nav className="flex flex-col space-y-1 mt-2">
              <div className={getLinkClass("Dashboard")}>
                <BarChart3 className="text-gray-600" size={16} />
                <span className="text-sm font-medium">Dashboard</span>
              </div>
              <div className={getLinkClass("Prompts")}>
                <MessageSquare className="text-gray-600" size={16} />
                <span className="text-sm">Prompts</span>
              </div>
              <div className={getLinkClass("Competitors")}>
                <Users className="text-gray-600" size={16} />
                <span className="text-sm">Competitors</span>
              </div>
            </nav>
          </div>

          {/* Action Center Section */}
          <div>
            <div className={getSectionHeaderClass()}>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 font-medium">Action Center</span>
              </div>
              <ChevronDown className="text-gray-400" size={16} />
            </div>
            <nav className="flex flex-col space-y-1 mt-2">
              <div className={getLinkClass("Visibility Tasks")}>
                <Flag className="text-gray-600" size={16} />
                <span className="text-sm">Visibility Tasks</span>
              </div>
            </nav>
          </div>

          {/* AI Content Tools Section */}
          <div>
            <div className={getSectionHeaderClass()}>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 font-medium">AI Content Tools</span>
              </div>
              <ChevronDown className="text-gray-400" size={16} />
            </div>
            <nav className="flex flex-col space-y-1 mt-2">
              <div className={getLinkClass("Experimental Search")}>
                <Search className="text-gray-600" size={16} />
                <span className="text-sm">Experimental Search</span>
              </div>
            </nav>
          </div>
        </div>
        
        <div className="px-4 pb-4 mt-auto">
          <button 
            className="flex items-center p-3 text-sm font-normal text-gray-600 rounded-xl hover:bg-gray-100/50 hover:text-gray-900 w-full transition-all duration-300 justify-end"
          >
            <ChevronsLeft size={20} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MockSidebar; 