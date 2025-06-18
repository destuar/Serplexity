import { Bell, ChevronDown, Grid3x3, User, Menu } from "lucide-react";
import React, { useState } from "react";
import { useCompany } from "../../contexts/CompanyContext";
import CompanySelector from "../company/CompanySelector";
import CompanyProfileForm from "../company/CompanyProfileForm";
import CompanyLogo from "../company/CompanyLogo";

interface HeaderProps {
  toggleMobileSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleMobileSidebar }) => {
  const { selectedCompany } = useCompany();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Handle creating new company
  const handleCreateNew = () => {
    setShowCreateModal(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
  };

  return (
    <>
      <header className="flex items-center justify-between px-4 py-4 bg-white lg:justify-between">
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
          <button className="p-2 rounded-lg hover:bg-gray-100">
            <Grid3x3 />
          </button>
          <button className="p-2 ml-4 rounded-lg hover:bg-gray-100">
            <Bell />
          </button>
          <div className="ml-4 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <User size={20} className="text-gray-600" />
          </div>
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
    </>
  );
};

export default Header; 