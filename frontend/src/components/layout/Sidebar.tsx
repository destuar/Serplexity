/**
 * @file Sidebar.tsx
 * @description Sidebar navigation component that provides the main navigation menu for the dashboard.
 * Handles responsive behavior, collapsible sections, and navigation state management.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation and routing.
 * - lucide-react: For icons.
 * - ../../contexts/AuthContext: For user authentication state.
 * - ../../contexts/CompanyContext: For company data.
 *
 * @exports
 * - Sidebar: The main sidebar navigation component.
 */
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Flag,
  Sparkles,
  Wrench,
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
    actionCenter: true,
    aiContentTools: true,
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

  const getSectionHeaderClass = () => {
    return `flex items-center ${isDesktopCollapsed ? 'justify-center' : 'justify-between'} cursor-pointer p-2 rounded-xl hover:bg-gray-100/50 transition-all duration-300`;
  };

  const sidebarClasses = `
    fixed inset-y-0 left-0 z-30 flex flex-col 
    bg-white/80 backdrop-blur-md border-r border-gray-200/50 text-gray-900 
    transition-transform duration-300 ease-in-out 
    lg:relative lg:translate-x-0
    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
    ${isDesktopCollapsed ? 'w-20' : 'w-64'}
    ${isDesktopCollapsed ? 'cursor-pointer' : ''}
  `;

  const handleSidebarClick = () => {
    if (isDesktopCollapsed) {
      toggleDesktopSidebar();
    }
  };

  const handleSectionClick = (section: keyof typeof openSections, e: React.MouseEvent) => {
    if (isDesktopCollapsed) {
      e.stopPropagation();
      toggleDesktopSidebar();
    } else {
      toggleSection(section);
    }
  };

  return (
    <div className={sidebarClasses} onClick={handleSidebarClick}>
      <div className={`flex items-center py-4 border-b border-gray-200/50 px-4 ${isDesktopCollapsed ? 'justify-center' : ''}`}>
        <Link to="/" className="flex items-center no-underline" onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
          <img
            src="/Serplexity.svg"
            alt="Serplexity Logo"
            className="w-8 h-8"
          />
          {!isDesktopCollapsed && <h1 className="text-2xl font-bold ml-3 text-gray-900">Serplexity</h1>}
        </Link>
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col px-4 pt-3 flex-1 overflow-y-auto space-y-4">
        <div>
          <div 
            className={getSectionHeaderClass()}
            onClick={(e) => handleSectionClick('aiPerformance', e)}
          >
            <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center' : ''}`}>
              <Sparkles className="text-gray-600" size={20} />
              {!isDesktopCollapsed && <span className="ml-2 text-gray-700 font-medium">AI Performance</span>}
            </div>
            {!isDesktopCollapsed && (openSections.aiPerformance ? <ChevronDown className="text-gray-500" size={16} /> : <ChevronRight className="text-gray-500" size={16} />)}
          </div>
          {(!isDesktopCollapsed && openSections.aiPerformance) && (
            <nav className="flex flex-col space-y-1 mt-2">
              <Link to="/overview" className={getLinkClass('/overview')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                {!isDesktopCollapsed && <span className="ml-3 font-medium">Overview</span>}
              </Link>
              <Link to="/sentiment-analysis" className={getLinkClass('/sentiment-analysis')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                {!isDesktopCollapsed && <span className="ml-3">Sentiment Analysis</span>}
              </Link>
              <Link to="/response-details" className={getLinkClass('/response-details')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                {!isDesktopCollapsed && <span className="ml-3">Response Details</span>}
              </Link>
              <Link to="/competitor-rankings" className={getLinkClass('/competitor-rankings')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                {!isDesktopCollapsed && <span className="ml-3">Competitor Rankings</span>}
              </Link>
              <Link to="/model-comparison" className={getLinkClass('/model-comparison')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                {!isDesktopCollapsed && <span className="ml-3">Model Comparison</span>}
              </Link>
            </nav>
          )}
        </div>
        <div>
          <div 
            className={getSectionHeaderClass()}
            onClick={(e) => handleSectionClick('actionCenter', e)}
          >
            <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center' : ''}`}>
              <Flag className="text-gray-600" size={20} />
              {!isDesktopCollapsed && <span className="ml-2 text-gray-700 font-medium">Action Center</span>}
            </div>
            {!isDesktopCollapsed && (openSections.actionCenter ? <ChevronDown className="text-gray-500" size={16} /> : <ChevronRight className="text-gray-500" size={16} />)}
          </div>
          {(!isDesktopCollapsed && openSections.actionCenter) && (
            <nav className="flex flex-col space-y-1 mt-2">
              <Link to="/visibility-tasks" className={getLinkClass('/visibility-tasks')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                {!isDesktopCollapsed && <span className="ml-3">Visibility Tasks</span>}
              </Link>
            </nav>
          )}
        </div>
        <div>
          <div 
            className={getSectionHeaderClass()}
            onClick={(e) => handleSectionClick('aiContentTools', e)}
          >
            <div className={`flex items-center ${isDesktopCollapsed ? 'justify-center' : ''}`}>
              <Wrench className="text-gray-600" size={20} />
              {!isDesktopCollapsed && <span className="ml-2 text-gray-700 font-medium">AI Content Tools</span>}
            </div>
            {!isDesktopCollapsed && (openSections.aiContentTools ? <ChevronDown className="text-gray-500" size={16} /> : <ChevronRight className="text-gray-500" size={16} />)}
          </div>
          {(!isDesktopCollapsed && openSections.aiContentTools) && (
            <nav className="flex flex-col space-y-1 mt-2">
              <Link to="/experimental-search" className={getLinkClass('/experimental-search')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                {!isDesktopCollapsed && <span className="ml-3">Experimental Search</span>}
              </Link>
            </nav>
          )}
        </div>
        </div>
        <div className="px-4 pb-4 mt-auto">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              toggleDesktopSidebar();
            }}
            className={`flex items-center p-3 text-base font-normal text-gray-600 rounded-xl hover:bg-gray-100/50 hover:text-gray-900 w-full transition-all duration-300 ${isDesktopCollapsed ? 'justify-center' : 'justify-end'}`}
          >
            {isDesktopCollapsed ? <ChevronsRight size={20} className="text-gray-600" /> : <ChevronsLeft size={20} className="text-gray-600" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 