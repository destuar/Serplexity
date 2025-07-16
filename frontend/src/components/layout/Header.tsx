/**
 * @file Header.tsx
 * @description Top header component for the dashboard that displays company information, user controls, and mobile menu toggle.
 * Provides navigation and user interface elements for the main application header.
 *
 * @dependencies
 * - react: For component rendering.
 * - lucide-react: For icons.
 * - ../../contexts/CompanyContext: For company data.
 * - ../../contexts/AuthContext: For user authentication state.
 *
 * @exports
 * - Header: The main header component.
 */
import { Bell, Settings, User, Menu } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useCompany } from "../../contexts/CompanyContext";
import CompanySelector from "../company/CompanySelector";
import CompanyProfileForm from "../company/CompanyProfileForm";
import CompanyLogo from "../company/CompanyLogo";
import SettingsModal from "./SettingsModal";
import ProfileModal from "./ProfileModal";

interface HeaderProps {
  toggleMobileSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleMobileSidebar }) => {
  const { selectedCompany, canCreateMore } = useCompany();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Handle creating new company
  const handleCreateNew = () => {
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

  return (
    <>
      {/* Header height (py-2.5) must match sidebar logo section height for visual alignment */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white lg:justify-between">
        <div className="flex items-center">
          <button 
            onClick={toggleMobileSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
          >
            <Menu />
          </button>
          <div className="hidden lg:flex items-center">
            {selectedCompany ? (
              <CompanyLogo 
                company={selectedCompany} 
                size="md" 
                className="mr-2"
              />
            ) : (
              <div className="p-2 bg-gray-200 rounded-lg mr-2">
                <User size={24} />
              </div>
            )}
            <CompanySelector onCreateNew={handleCreateNew} />
          </div>
        </div>
        <div className="flex items-center">
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <Settings />
          </button>
          <button className="p-2 ml-4 rounded-lg hover:bg-gray-100">
            <Bell />
          </button>
          <button 
            onClick={() => setShowProfileModal(true)}
            className="ml-4 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
          >
            <User size={20} className="text-gray-600" />
          </button>
        </div>
      </header>

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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
};

export default Header; 