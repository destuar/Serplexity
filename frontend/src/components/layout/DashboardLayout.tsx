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


const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
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
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; 