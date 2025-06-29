import { Bell, Settings, User, ChevronDown } from "lucide-react";
import React from 'react';

const mockCompany = {
    name: "Serplexity",
    website: "serplexity.com"
};

const MockHeader: React.FC = () => {
    return (
        <header className="flex items-center justify-between px-4 py-2.5 bg-white lg:justify-between">
            {/* Left side */}
            <div className="hidden lg:flex items-center">
                {/* Mock Company Logo */}
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-2">
                    <img
                        src="/Serplexity.svg"
                        alt={`${mockCompany.name} logo`}
                        className="w-full h-full object-contain rounded-lg"
                    />
                </div>
                {/* Mock Company Selector */}
                <div className="flex items-center gap-2 px-2 py-2 text-xl font-bold">
                    <span className="truncate text-gray-800">
                        {mockCompany.name}
                    </span>
                    <ChevronDown size={18} className="text-gray-600 flex-shrink-0" />
                </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
                <button className="bg-[#7762ff] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#6650e6] transition-colors">
                    Upgrade to Pro
                </button>
                {/* Settings Icon */}
                <button className="p-2 rounded-lg hover:bg-gray-100">
                    <Settings size={20} className="text-gray-600" />
                </button>
                {/* Notifications Icon */}
                <button className="p-2 ml-4 rounded-lg hover:bg-gray-100">
                    <Bell size={20} className="text-gray-600" />
                </button>
                {/* User Avatar */}
                <button className="ml-4 w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                    <User size={20} className="text-gray-600" />
                </button>
            </div>
        </header>
    );
}

export default MockHeader;