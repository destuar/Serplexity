import { Bell, Settings, User, Menu } from "lucide-react";
import React, { useState } from "react";
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <CompanyProfileForm
            isModal={true}
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateModal(false)}
          />
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