import {
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  Settings,
  User,
  Sparkles,
} from "lucide-react";
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

interface SidebarProps {
  isDesktopCollapsed: boolean;
  toggleDesktopSidebar: () => void;
  isMobileOpen: boolean;
  toggleMobileSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isDesktopCollapsed, 
  toggleDesktopSidebar,
  isMobileOpen,
}) => {
  const location = useLocation();
  const [openSections, setOpenSections] = useState({
    aiPerformance: true,
    marketAnalysis: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isActive = (path: string) => {
    return location.pathname === path || (path === '/overview' && location.pathname === '/');
  };

  const getLinkClass = (path: string) => {
    const baseClass = `flex items-center p-3 text-base font-normal rounded-xl transition-all duration-300 ${isDesktopCollapsed ? 'justify-center' : ''}`;
    
    if (isActive(path)) {
      return `${baseClass} bg-gray-200/60 text-gray-900`;
    }
    
    return `${baseClass} text-gray-600 hover:bg-gray-100/50 hover:text-gray-900`;
  };

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-30 flex flex-col 
    bg-white/80 backdrop-blur-md border-r border-gray-200/50 text-gray-900 
    transition-transform duration-300 ease-in-out 
    lg:relative lg:translate-x-0
    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
    ${isDesktopCollapsed ? 'w-20' : 'w-64'}
  `;

  return (
    <div className={sidebarClasses}>
      <div className="flex items-center h-20 border-b border-gray-200/50 px-4">
        <img 
          src="/Serplexity.svg" 
          alt="Serplexity Logo" 
          className="w-8 h-8"
        />
        {!isDesktopCollapsed && <h1 className="text-2xl font-bold ml-2 text-gray-900">Serplexity</h1>}
      </div>
      <div className="flex flex-col p-4">
        <div 
          className="flex items-center justify-between mb-4 cursor-pointer"
          onClick={() => toggleSection('aiPerformance')}
        >
          <div className="flex items-center">
            <Sparkles className="text-gray-600" size={20} />
            {!isDesktopCollapsed && <span className="ml-2 text-gray-700 font-medium">AI Performance</span>}
          </div>
          {!isDesktopCollapsed && (openSections.aiPerformance ? <ChevronDown className="text-gray-500" size={16} /> : <ChevronRight className="text-gray-500" size={16} />)}
        </div>
        {(!isDesktopCollapsed && openSections.aiPerformance) && (
          <nav className="flex flex-col space-y-2 mb-6">
            <Link to="/overview" className={getLinkClass('/overview')}>
              {!isDesktopCollapsed && <span className="ml-3 font-medium">Overview</span>}
            </Link>
            <Link to="/ai-rankings" className={getLinkClass('/ai-rankings')}>
              {!isDesktopCollapsed && <span className="ml-3">AI Rankings</span>}
            </Link>
            <Link to="/tag-analysis" className={getLinkClass('/tag-analysis')}>
              {!isDesktopCollapsed && <span className="ml-3">Tag Analysis</span>}
            </Link>
            <Link to="/sentiment-analysis" className={getLinkClass('/sentiment-analysis')}>
              {!isDesktopCollapsed && <span className="ml-3">Sentiment Analysis</span>}
            </Link>
            <Link to="/concepts-analysis" className={getLinkClass('/concepts-analysis')}>
              {!isDesktopCollapsed && <span className="ml-3">Concepts Analysis</span>}
            </Link>
            <Link to="/source-analysis" className={getLinkClass('/source-analysis')}>
              {!isDesktopCollapsed && <span className="ml-3">Source Analysis</span>}
            </Link>
          </nav>
        )}
        <div 
          className="flex items-center justify-between mb-4 cursor-pointer"
          onClick={() => toggleSection('marketAnalysis')}
        >
          <div className="flex items-center">
            <BarChart2 className="text-gray-600" size={20} />
            {!isDesktopCollapsed && <span className="ml-2 text-gray-700 font-medium">Market Analysis</span>}
          </div>
          {!isDesktopCollapsed && (openSections.marketAnalysis ? <ChevronDown className="text-gray-500" size={16} /> : <ChevronRight className="text-gray-500" size={16} />)}
        </div>
        {(!isDesktopCollapsed && openSections.marketAnalysis) && (
          <nav className="flex flex-col space-y-2">
            <Link to="/competitor-rankings" className={getLinkClass('/competitor-rankings')}>
              {!isDesktopCollapsed && <span className="ml-3">Competitor Rankings</span>}
            </Link>
            <Link to="/model-comparison" className={getLinkClass('/model-comparison')}>
              {!isDesktopCollapsed && <span className="ml-3">Model Comparison</span>}
            </Link>
          </nav>
        )}
      </div>
      <div className="mt-auto p-4 hidden lg:block">
        <button 
          onClick={toggleDesktopSidebar}
          className="flex items-center justify-end p-3 text-base font-normal text-gray-600 rounded-xl hover:bg-gray-100/50 hover:text-gray-900 w-full transition-all duration-300"
        >
          {isDesktopCollapsed ? <ChevronsRight size={20} className="text-gray-600" /> : <ChevronsLeft size={20} className="text-gray-600" />}
        </button>
      </div>
    </div>
  );
};

export default Sidebar; 