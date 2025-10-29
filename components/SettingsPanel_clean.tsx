import React, { useState } from 'react';
import { saveDirectoryHandle } from '../utils/dirHandleStore';
import { AppSettings } from '../types';
import { X, RotateCw } from './Icons';
import type { ScanProgress, ScanResult } from '../services/localStorageService';

interface SettingsPanelProps {
  isOpen: boolean;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onFetchData: () => void;
  onClose: () => void;
  onScanAndRebuild?: () => void; // Changed to void, no return value
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  isOpen, 
  settings, 
  setSettings, 
  onFetchData, 
  onClose, 
  onScanAndRebuild
}) => {
  const isElectron = typeof window !== 'undefined' && (window as any).electron?.isElectron;
  const canUseWebFS = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const canUseLocalFolder = isElectron || canUseWebFS;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSelectFolder = async () => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      const folderPath = await (window as any).electron.selectFolder();
      if (folderPath) {
        setSettings(prev => ({ ...prev, localStoragePath: folderPath }));
      }
      return;
    }
    if (canUseWebFS) {
      try {
        const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        // Request permission if available
        // @ts-ignore
        await (handle as any).requestPermission?.({ mode: 'readwrite' });
        await saveDirectoryHandle(handle);
        setSettings(prev => ({ ...prev, localStoragePath: handle.name }));
      } catch (e) {
        console.warn('Folder selection canceled or failed', e);
      }
    }
  };

  const handleScanAndRebuild = async () => {
    if (!onScanAndRebuild) return;
    
    // Just trigger the scan - the modal will be shown by App.tsx
    onScanAndRebuild();
    
    // Close the settings panel so the scan modal can be seen
    onClose();
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-30 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>
        
        <div className="space-y-6 flex-grow overflow-y-auto pr-2">
          {/* Airtable Settings */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Airtable Connection</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">API Key</label>
                <input type="password" name="apiKey" id="apiKey" value={settings.apiKey} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50" placeholder="pat..."/>
              </div>
              <div>
                <label htmlFor="baseId" className="block text-sm font-medium text-gray-700">Base ID</label>
                <input type="text" name="baseId" id="baseId" value={settings.baseId} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50" placeholder="app..."/>
              </div>
              <div>
                <label htmlFor="tableName" className="block text-sm font-medium text-gray-700">Table Name</label>
                <input type="text" name="tableName" id="tableName" value={settings.tableName} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50" placeholder="e.g., FSC Report"/>
              </div>
            </div>
          </div>

          {/* Storage Settings */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Document Storage</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="localStoragePath" className="block text-sm font-medium text-gray-700">Local Storage Folder</label>
                <div className="mt-1 flex space-x-2">
                  <input
                    type="text"
                    name="localStoragePath"
                    id="localStoragePath"
                    value={settings.localStoragePath || ''}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-50"
                    placeholder="Select a folder..."
                  />
                  <button
                    onClick={handleSelectFolder}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
                  >
                    Browse
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Folders will be created automatically in the selected folder: {'{'}BatchNumber{'}'}/{'{'}DocType{'}'}
                </p>
                {!canUseLocalFolder && (
                  <p className="mt-1 text-xs text-red-600">
                    Your browser doesn't support selecting a local folder. Try a Chromium-based browser (Chrome/Edge) or use the desktop app.
                  </p>
                )}
                
                {/* Scan & Rebuild Button */}
                {settings.localStoragePath && onScanAndRebuild && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-800 font-medium mb-2">
                      🔍 Upload History Maintenance
                    </p>
                    <p className="text-xs text-blue-700 mb-3">
                      Scan your local folder to rebuild the upload history log from actual files.
                    </p>
                    <button
                      onClick={handleScanAndRebuild}
                      className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white font-medium py-2 px-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Scan & Rebuild Upload History</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onFetchData}
          className="w-full mt-4 bg-indigo-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-300"
        >
          Fetch Airtable Data
        </button>
      </div>
    </div>
  );
};
