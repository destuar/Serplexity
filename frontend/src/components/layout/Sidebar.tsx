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
  Plus,
  Check,
  BarChart3,
  MessageSquare,
  Users,
  Search,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { textClasses } from "../../utils/colorClasses";
import { useCompany } from "../../hooks/useCompany";
import { useNavigation } from "../../hooks/useNavigation";
import CompanyLogo from "../company/CompanyLogo";
import CompanyProfileForm from "../company/CompanyProfileForm";
import { Company } from "../../types/schemas";

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
  const { companies, selectedCompany, selectCompany, canCreateMore, maxCompanies } = useCompany();
  const { closeEmbeddedPageForRoute } = useNavigation();
  const [openSections, setOpenSections] = useState({
    aiPerformance: true,
    actionCenter: true,
    aiContentTools: true,
  });
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Close company dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectCompany = (company: Company) => {
    selectCompany(company);
    setIsCompanyDropdownOpen(false);
  };

  const handleCreateNew = () => {
    setIsCompanyDropdownOpen(false);
    if (canCreateMore) {
      setShowCreateModal(true);
    }
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showCreateModal) {
      // Save current scroll position
      const scrollPosition = window.pageYOffset;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPosition}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore scroll position
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('position');
        document.body.style.removeProperty('top');
        document.body.style.removeProperty('width');
        window.scrollTo(0, scrollPosition);
      };
    }
  }, [showCreateModal]);

  const isActive = (path: string) => {
    return location.pathname === path || (path === '/dashboard' && location.pathname === '/') || (path === '/prompts' && location.pathname === '/response-details');
  };

  const getLinkClass = (path: string) => {
    const baseClass = `flex items-center p-3 text-sm font-normal rounded-xl transition-all duration-300 ${isDesktopCollapsed ? 'justify-center' : 'gap-3'}`;
    
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
    <>
    <div className={sidebarClasses} onClick={handleSidebarClick}>
      <div className={`flex items-center py-2 border-b border-gray-200/50 px-3 ${isDesktopCollapsed ? 'justify-center' : ''}`}>
        {selectedCompany && !isDesktopCollapsed ? (
          <div className="relative w-full" ref={companyDropdownRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCompanyDropdownOpen(!isCompanyDropdownOpen);
              }}
              className="flex items-center justify-between w-full gap-2 px-2 py-2 hover:bg-gray-50 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CompanyLogo 
                  company={selectedCompany} 
                  size="sm"
                  className="flex-shrink-0"
                />
                <span className="text-sm font-medium text-gray-900 truncate">
                  {selectedCompany.name}
                </span>
              </div>
              <ChevronDown 
                size={14} 
                className={`transition-transform duration-200 text-gray-600 flex-shrink-0 ${
                  isCompanyDropdownOpen ? "rotate-180" : ""
                }`} 
              />
            </button>

            {/* Compact Dropdown Menu */}
            {isCompanyDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full min-w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                {/* Company List */}
                <div className="max-h-48 overflow-y-auto">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => handleSelectCompany(company)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <CompanyLogo 
                          company={company} 
                          size="sm"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {company.name}
                          </span>
                          {company.industry && (
                            <span className="text-xs text-gray-500 truncate">
                              {company.industry}
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedCompany?.id === company.id && (
                        <Check size={14} className="text-black flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-1"></div>

                {/* Create New Company Option */}
                <button
                  onClick={canCreateMore ? handleCreateNew : undefined}
                  disabled={!canCreateMore}
                  className={`w-full px-3 py-2 text-left transition-colors flex items-center gap-2 group ${
                    canCreateMore 
                      ? 'hover:bg-black/10 cursor-pointer' 
                      : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <div className={`flex items-center justify-center w-4 h-4 rounded ${
                    canCreateMore 
                      ? 'bg-black/20' 
                      : 'bg-gray-100'
                  }`}>
                    <Plus size={10} className={canCreateMore ? 'text-black' : 'text-gray-400'} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-medium ${
                      canCreateMore 
                        ? 'text-black group-hover:text-gray-800' 
                        : 'text-gray-400'
                    }`}>
                      {canCreateMore ? 'Create New +' : 'Create New'}
                    </span>
                    {!canCreateMore && (
                      <span className="text-xs text-gray-400">
                        Max {maxCompanies} companies
                      </span>
                    )}
                  </div>
                </button>
              </div>
            )}
          </div>
        ) : selectedCompany && isDesktopCollapsed ? (
          <div 
            className="flex items-center cursor-pointer" 
            onClick={toggleDesktopSidebar}
            title={selectedCompany.name}
          >
            <CompanyLogo 
              company={selectedCompany} 
              size="sm"
            />
          </div>
        ) : (
          <Link to="/" className="flex items-center no-underline" onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
            <img
              src="/Serplexity.svg"
              alt="Serplexity Logo"
              className="w-6 h-6"
            />
            {!isDesktopCollapsed && <h1 className="text-lg font-bold ml-2 text-gray-900">Serplexity</h1>}
          </Link>
        )}
      </div>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col px-4 pt-3 flex-1 overflow-y-auto space-y-4">
        <div>
          {!isDesktopCollapsed && (
            <div 
              className={getSectionHeaderClass()}
              onClick={(e) => handleSectionClick('aiPerformance', e)}
            >
              <div className="flex items-center">
                <span className="text-sm text-gray-500 font-medium">AI Performance</span>
              </div>
              {openSections.aiPerformance ? <ChevronDown className="text-gray-400" size={16} /> : <ChevronRight className="text-gray-400" size={16} />}
            </div>
          )}
          {(isDesktopCollapsed || openSections.aiPerformance) && (
            <nav className={`flex flex-col space-y-1 ${!isDesktopCollapsed ? 'mt-2' : ''}`}>
              <Link to="/dashboard" className={getLinkClass('/dashboard')} onClick={(e) => {
                if (isDesktopCollapsed) e.stopPropagation();
                closeEmbeddedPageForRoute('/dashboard');
              }}>
                <BarChart3 className="text-gray-600" size={16} />
                {!isDesktopCollapsed && <span className="text-sm font-medium">Dashboard</span>}
              </Link>
              <Link to="/prompts" className={getLinkClass('/prompts')} onClick={(e) => {
                if (isDesktopCollapsed) e.stopPropagation();
                closeEmbeddedPageForRoute('/prompts');
              }}>
                <MessageSquare className="text-gray-600" size={16} />
                {!isDesktopCollapsed && <span className="text-sm">Prompts</span>}
              </Link>
              <Link to="/competitors" className={getLinkClass('/competitors')} onClick={(e) => {
                if (isDesktopCollapsed) e.stopPropagation();
                closeEmbeddedPageForRoute('/competitors');
              }}>
                <Users className="text-gray-600" size={16} />
                {!isDesktopCollapsed && <span className="text-sm">Competitors</span>}
              </Link>
            </nav>
          )}
        </div>
        <div>
          {!isDesktopCollapsed && (
            <div 
              className={getSectionHeaderClass()}
              onClick={(e) => handleSectionClick('actionCenter', e)}
            >
              <div className="flex items-center">
                <span className="text-sm text-gray-500 font-medium">Action Center</span>
              </div>
              {openSections.actionCenter ? <ChevronDown className="text-gray-400" size={16} /> : <ChevronRight className="text-gray-400" size={16} />}
            </div>
          )}
          {(isDesktopCollapsed || openSections.actionCenter) && (
            <nav className={`flex flex-col space-y-1 ${!isDesktopCollapsed ? 'mt-2' : ''}`}>
              <Link to="/visibility-tasks" className={getLinkClass('/visibility-tasks')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                <Flag className="text-gray-600" size={16} />
                {!isDesktopCollapsed && <span className="text-sm">Visibility Tasks</span>}
              </Link>
            </nav>
          )}
        </div>
        <div>
          {!isDesktopCollapsed && (
            <div 
              className={getSectionHeaderClass()}
              onClick={(e) => handleSectionClick('aiContentTools', e)}
            >
              <div className="flex items-center">
                <span className="text-sm text-gray-500 font-medium">AI Content Tools</span>
              </div>
              {openSections.aiContentTools ? <ChevronDown className="text-gray-400" size={16} /> : <ChevronRight className="text-gray-400" size={16} />}
            </div>
          )}
          {(isDesktopCollapsed || openSections.aiContentTools) && (
            <nav className={`flex flex-col space-y-1 ${!isDesktopCollapsed ? 'mt-2' : ''}`}>
              <Link to="/experimental-search" className={getLinkClass('/experimental-search')} onClick={(e) => isDesktopCollapsed && e.stopPropagation()}>
                <Search className="text-gray-600" size={16} />
                {!isDesktopCollapsed && <span className="text-sm">Experimental Search</span>}
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
            className={`flex items-center p-3 text-sm font-normal text-gray-600 rounded-xl hover:bg-gray-100/50 hover:text-gray-900 w-full transition-all duration-300 ${isDesktopCollapsed ? 'justify-center' : 'justify-end'}`}
          >
            {isDesktopCollapsed ? <ChevronsRight size={20} className="text-gray-600" /> : <ChevronsLeft size={20} className="text-gray-600" />}
          </button>
        </div>
      </div>
    </div>
    
    {/* Create Company Modal */}
    {showCreateModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
        {/* Scrollable Container */}
        <div className="w-full h-full overflow-y-auto flex flex-col">
          {/* Flexible Spacing */}
          <div className="flex-shrink-0 h-4 sm:h-8 lg:h-16"></div>
          
          {/* Modal Content */}
          <div className="flex-1 flex justify-center px-4 pb-4 sm:pb-8 lg:pb-16">
            <div className="w-full max-w-2xl">
              <CompanyProfileForm
                isModal={true}
                onSuccess={handleCreateSuccess}
                onCancel={() => setShowCreateModal(false)}
              />
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Sidebar; 