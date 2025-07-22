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
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const PaywallOverlay: React.FC = () => (
  <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-[#0a0a1a]/80 to-[#050510]/80 backdrop-blur-sm flex items-center justify-center z-50">
    {/* Subtle background gradients */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#5271ff]/15 via-[#7662ff]/8 to-[#9e52ff]/15"></div>
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(82,113,255,0.08),transparent_50%)]"></div>
    
    {/* Main liquid glass container */}
    <div className="relative bg-black/5 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 text-center max-w-md mx-4 overflow-hidden">
      {/* Glass morphism border glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#5271ff]/10 via-[#7662ff]/10 to-[#9e52ff]/10 rounded-3xl blur-xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 rounded-3xl"></div>
      
      {/* Content with relative positioning */}
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-4 text-white">Serplexity Pro Required</h2>
        <p className="mb-6 text-gray-300">Activate subscription to view this content.</p>
                  <Link
            to="/payment"
            className="bg-[#7762ff] hover:bg-[#6650e6] text-white px-6 py-3 rounded-full font-semibold transition-all duration-200 shadow-lg hover:shadow-xl inline-flex items-center gap-2"
          >
            Boost Your Visibility
            <ArrowRight className="h-5 w-5" />
          </Link>
      </div>
    </div>
  </div>
);

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user } = useAuth();
  const isSubscribed = user?.subscriptionStatus === 'active' || user?.role === 'ADMIN';

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
        <main className={`flex-1 overflow-y-auto p-4 ${!isSubscribed ? 'blur-sm' : ''}`}>
          {children}
        </main>
        {!isSubscribed && <PaywallOverlay />}
      </div>
    </div>
  );
};

export default DashboardLayout; 