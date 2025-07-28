/**
 * @file MockHeader.tsx
 * @description A mock header component for the dashboard layout previewed on the landing page.
 * It simulates the top navigation bar of the application with breadcrumb navigation and user controls.
 *
 * @dependencies
 * - react: For rendering the component.
 * - lucide-react: For icons including breadcrumb chevrons.
 *
 * @exports
 * - MockHeader: The main component.
 */
import { Bell, Settings, User, Menu, ChevronRight } from "lucide-react";
import React from 'react';

interface MockHeaderProps {
  activePage?: string;
}

const MockHeader: React.FC<MockHeaderProps> = ({ activePage = "Dashboard" }) => {
    const getBreadcrumbs = (page: string) => {
        switch (page) {
            case "Dashboard":
                return [{ label: "Dashboard", isActive: true }];
            case "Dashboard → Sentiment":
                return [
                    { label: "Dashboard", isActive: false },
                    { label: "Sentiment", isActive: true }
                ];
            case "Prompts":
                return [{ label: "Prompts", isActive: true }];
            case "Prompts → Responses":
                return [
                    { label: "Prompts", isActive: false },
                    { label: "Responses", isActive: true }
                ];
            case "Competitors":
                return [{ label: "Competitors", isActive: true }];
            case "Visibility Tasks":
                return [{ label: "Visibility Tasks", isActive: true }];
            default:
                return [{ label: page, isActive: true }];
        }
    };

    const breadcrumbs = getBreadcrumbs(activePage);

    return (
        <header className="flex items-center justify-between px-4 py-3 bg-white lg:justify-between">
            <div className="flex items-center">
                <button className="p-2 rounded-lg hover:bg-gray-100 lg:hidden mr-3">
                    <Menu />
                </button>
                {/* Breadcrumb Navigation */}
                <nav className="flex items-center space-x-1 text-sm text-gray-600">
                    {breadcrumbs.map((crumb, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && (
                                <ChevronRight size={14} className="text-gray-400" />
                            )}
                            <span 
                                className={
                                    crumb.isActive 
                                        ? "text-gray-900 font-medium" 
                                        : "font-medium hover:text-gray-700"
                                }
                            >
                                {crumb.label}
                            </span>
                        </React.Fragment>
                    ))}
                </nav>
            </div>
            <div className="flex items-center">
                <button className="p-1.5 rounded-lg hover:bg-gray-100">
                    <Settings size={18} />
                </button>
                <button className="p-1.5 ml-3 rounded-lg hover:bg-gray-100">
                    <Bell size={18} />
                </button>
                <button className="ml-3 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                    <User size={16} />
                </button>
            </div>
        </header>
    );
}

export default MockHeader;