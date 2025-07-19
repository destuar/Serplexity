/**
 * @file Header.tsx
 * @description Top header component for the dashboard that displays user controls and mobile menu toggle.
 * Provides navigation and user interface elements for the main application header.
 *
 * @dependencies
 * - react: For component rendering.
 * - lucide-react: For icons.
 *
 * @exports
 * - Header: The main header component.
 */
import { Bell, Settings, User, Menu } from "lucide-react";
import React, { useState } from "react";
import SettingsModal from "./SettingsModal";
import ProfileModal from "./ProfileModal";
import Breadcrumb from "../ui/Breadcrumb";

interface HeaderProps {
  toggleMobileSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleMobileSidebar }) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <>
      {/* Header height (py-2.5) must match sidebar logo section height for visual alignment */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white lg:justify-between">
        <div className="flex items-center">
          <button 
            onClick={toggleMobileSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 lg:hidden mr-3"
          >
            <Menu />
          </button>
          <Breadcrumb />
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