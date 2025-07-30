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
import React, { useState, useEffect } from "react";
import SettingsModal from "./SettingsModal";
import ProfileModal from "./ProfileModal";
import Breadcrumb from "../ui/Breadcrumb";
import { useAuth } from "../../contexts/AuthContext";
import apiClient from "../../lib/apiClient";

interface HeaderProps {
  toggleMobileSidebar: () => void;
}

interface TrialStatus {
  subscriptionStatus: string | null;
  isTrialing: boolean;
  trialExpired: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
  hoursRemaining: number;
  hasFullAccess: boolean;
  canModifyPrompts: boolean;
  canCreateReports: boolean;
  maxActiveQuestions: number | null;
  isAdmin: boolean;
}

const SubscriptionStatusBadge: React.FC<{ trialStatus: TrialStatus | null }> = ({ trialStatus }) => {
  if (!trialStatus) {
    return null;
  }

  const getStatusInfo = () => {
    if (trialStatus.subscriptionStatus === 'active') {
      return { text: 'Serplexity Pro', className: 'bg-black text-white', tooltip: null };
    }
    
    if (trialStatus.isTrialing) {
      if (trialStatus.trialExpired) {
        return { text: 'Trial Expired', className: 'bg-white text-black', tooltip: null };
      } else {
        const formatTimeRemaining = () => {
          if (trialStatus.daysRemaining > 0) {
            return `${trialStatus.daysRemaining} day${trialStatus.daysRemaining !== 1 ? 's' : ''}, ${trialStatus.hoursRemaining} hour${trialStatus.hoursRemaining !== 1 ? 's' : ''} remaining`;
          } else {
            return `${trialStatus.hoursRemaining} hour${trialStatus.hoursRemaining !== 1 ? 's' : ''} remaining`;
          }
        };
        
        return { 
          text: 'Free Trial', 
          className: 'bg-white text-black', 
          tooltip: formatTimeRemaining()
        };
      }
    }
    
    return { text: 'Trial Expired', className: 'bg-white text-black', tooltip: null };
  };

  const { text, className, tooltip } = getStatusInfo();

  return (
    <div className="relative group">
      <span className={`px-3 py-1.5 text-xs font-medium rounded-md ${className}`}>
        {text}
      </span>
      {tooltip && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-white text-black text-xs rounded shadow-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
          {tooltip}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-white"></div>
        </div>
      )}
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({ toggleMobileSidebar }) => {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchTrialStatus = async () => {
      if (!user) {
        return;
      }
      
      try {
        const response = await apiClient.get('/users/me/trial-status');
        setTrialStatus(response.data);
      } catch (error) {
        console.error('Failed to fetch trial status:', error);
      }
    };

    fetchTrialStatus();
  }, [user]);

  return (
    <>
      {/* Header height (py-3) for improved visual balance */}
      <header className="flex items-center justify-between px-4 py-3 bg-white lg:justify-between">
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
          <SubscriptionStatusBadge trialStatus={trialStatus} />
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 ml-3 rounded-lg hover:bg-gray-100"
          >
            <Settings size={18} />
          </button>
          <button className="p-1.5 ml-3 rounded-lg hover:bg-gray-100">
            <Bell size={18} />
          </button>
          <button 
            onClick={() => setShowProfileModal(true)}
            className="ml-3 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
          >
            <User size={16} className="text-gray-600" />
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