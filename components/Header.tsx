
import React from 'react';
import { Settings, FileText } from './Icons';

interface HeaderProps {
  onToggleSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSettings }) => {
  return (
    <header className="bg-white shadow-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">
              FSC Document Hub
            </h1>
          </div>
          <button
            onClick={onToggleSettings}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 transition"
            aria-label="Open settings"
          >
            <Settings className="h-6 w-6" />
          </button>
        </div>
      </div>
    </header>
  );
};
