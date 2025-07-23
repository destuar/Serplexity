/**
 * @file DashboardLayout.tsx
 * @description Main layout component for the dashboard that provides the overall structure including sidebar, header, and main content area.
 * Handles responsive behavior, subscription paywall overlay, and mobile/desktop sidebar states.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - react-router-dom: For navigation links.
 * - lucide-react: For icons.
 * - ./Sidebar: The sidebar navigation component.
 * - ./Header: The top header component.
 * - ../../contexts/AuthContext: For user authentication state.
 *
 * @exports
 * - DashboardLayout: The main layout component.
 */
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const PaywallOverlay: React.FC = () => (
  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white/80 backdrop-blur-sm border border-white/20 rounded-lg shadow-md w-full max-w-md mx-4 p-6">
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Serplexity Pro Required</h3>
        <p className="text-sm text-gray-600 mb-6">
          Activate subscription to view this content.
        </p>
        <Link
          to="/payment"
          className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
        >
          Upgrade Now
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  </div>
);

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  
  // Check if user has active subscription or is admin
  const hasActiveSubscription = user?.subscriptionStatus === 'active' || user?.role === 'ADMIN';
  
  // Check if user is in active trial period
  const isInActiveTrial = user?.subscriptionStatus === 'trialing' && 
    user?.trialEndsAt && new Date() < new Date(user.trialEndsAt);
  
  // Allow experimental search page for free
  const isExperimentalSearchPage = location.pathname === '/experimental-search';
  
  // Show paywall for expired trial users on all pages except experimental search
  const shouldShowPaywall = !hasActiveSubscription && !isInActiveTrial && !isExperimentalSearchPage;

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar 
        isDesktopCollapsed={isDesktopSidebarCollapsed} 
        toggleDesktopSidebar={toggleDesktopSidebar}
        isMobileOpen={isMobileSidebarOpen}
        toggleMobileSidebar={toggleMobileSidebar}
      />
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={toggleMobileSidebar}
        ></div>
      )}
      <div className="flex flex-col flex-1 min-h-0 relative">
        <Header toggleMobileSidebar={toggleMobileSidebar} />
        <main className={`flex-1 overflow-y-auto p-4 ${shouldShowPaywall ? 'blur-sm' : ''}`}>
          {children}
        </main>
        {shouldShowPaywall && <PaywallOverlay />}
      </div>
    </div>
  );
};

export default DashboardLayout; 