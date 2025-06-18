import { Bell, ChevronDown, Grid3x3, User, Menu } from "lucide-react";
import React from "react";

interface HeaderProps {
  toggleMobileSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleMobileSidebar }) => {
  return (
    <header className="flex items-center justify-between px-4 py-4 bg-white lg:justify-between">
      <div className="flex items-center">
        <button 
          onClick={toggleMobileSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
        >
          <Menu />
        </button>
        <div className="hidden lg:flex items-center">
          <div className="p-2 bg-gray-200 rounded-lg">
            <User size={24} />
          </div>
          <div className="ml-4">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">CodeLadder.io</h1>
              <ChevronDown className="ml-2" />
            </div>
          </div>
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
  );
};

export default Header; 