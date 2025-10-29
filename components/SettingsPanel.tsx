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
  onScanAndRebuild?: () => Promise<ScanResult>;
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
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showScanModal, setShowScanModal] = useState(false);
  
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
    
    setIsScanning(true);
    setShowScanModal(true);
    setScanResult(null);
    setScanProgress({
      status: 'scanning',
      message: 'Starting scan...',
      scannedCount: 0,
    });

    try {
      const result = await onScanAndRebuild();
      setScanResult(result);
      setScanProgress({
        status: result.success ? 'complete' : 'error',
        message: result.success ? 'Scan completed successfully!' : 'Scan failed',
        scannedCount: result.filesFound,
      });
    } catch (error) {
      setScanResult({
        success: false,
        filesFound: 0,
        newEntriesAdded: 0,
        orphanedFiles: [],
        existingEntriesPreserved: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        backupCreated: false,
      });
      setScanProgress({
        status: 'error',
        message: 'Scan failed',
        scannedCount: 0,
      });
    } finally {
      setIsScanning(false);
    }
  };

  const closeScanModal = () => {
    setShowScanModal(false);
    setScanProgress(null);
    setScanResult(null);
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 bg-white shadow-lg z-30 transform transition-transform duration-300 ease-in-out ${
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
                      disabled={isScanning}
                      className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white font-medium py-2 px-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isScanning ? (
                        <>
                          <RotateCw className="h-4 w-4 animate-spin" />
                          <span>Scanning...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Scan & Rebuild Upload History</span>
                        </>
                      )}
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
      
      {/* Scan & Rebuild Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {isScanning ? 'Scanning Folder...' : 'Scan Complete'}
                </h3>
                {!isScanning && (
                  <button onClick={closeScanModal} className="p-2 rounded-full hover:bg-gray-100">
                    <X className="h-5 w-5 text-gray-600" />
                  </button>
                )}
              </div>

              {/* Progress Indicator */}
              {isScanning && scanProgress && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <RotateCw className="h-6 w-6 text-blue-600 animate-spin" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{scanProgress.message}</p>
                      {scanProgress.currentFolder && (
                        <p className="text-xs text-gray-500">Current: {scanProgress.currentFolder}</p>
                      )}
                      {scanProgress.totalFolders && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(scanProgress.scannedCount / scanProgress.totalFolders) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {scanProgress.scannedCount} / {scanProgress.totalFolders} folders
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {!isScanning && scanResult && (
                <div className="space-y-4">
                  {scanResult.success ? (
                    <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                      <div className="flex items-start">
                        <svg className="h-6 w-6 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="ml-3 flex-1">
                          <h4 className="text-sm font-medium text-green-800">Scan Completed Successfully</h4>
                          <div className="mt-2 text-sm text-green-700 space-y-1">
                            <p>✅ <strong>{scanResult.filesFound}</strong> files found</p>
                            <p>➕ <strong>{scanResult.newEntriesAdded}</strong> new entries added to log</p>
                            <p>📋 <strong>{scanResult.existingEntriesPreserved}</strong> existing entries preserved</p>
                            {scanResult.backupCreated && scanResult.backupPath && (
                              <p className="text-xs mt-2">💾 Backup created: <code className="bg-green-100 px-1 rounded">{scanResult.backupPath}</code></p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                      <div className="flex items-start">
                        <svg className="h-6 w-6 text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="ml-3 flex-1">
                          <h4 className="text-sm font-medium text-red-800">Scan Failed</h4>
                          <div className="mt-2 text-sm text-red-700">
                            {scanResult.errors.map((error, idx) => (
                              <p key={idx} className="mt-1">• {error}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Orphaned Files Warning */}
                  {scanResult.orphanedFiles.length > 0 && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                      <div className="flex items-start">
                        <svg className="h-6 w-6 text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="ml-3 flex-1">
                          <h4 className="text-sm font-medium text-yellow-800">
                            ⚠️ {scanResult.orphanedFiles.length} Orphaned File{scanResult.orphanedFiles.length !== 1 ? 's' : ''} Found
                          </h4>
                          <p className="text-xs text-yellow-700 mt-1">
                            These files are in folders that don't match any batch numbers from Airtable:
                          </p>
                          <div className="mt-2 max-h-32 overflow-y-auto">
                            {scanResult.orphanedFiles.slice(0, 10).map((file, idx) => (
                              <p key={idx} className="text-xs text-yellow-600 font-mono">• {file}</p>
                            ))}
                            {scanResult.orphanedFiles.length > 10 && (
                              <p className="text-xs text-yellow-600 mt-1">
                                ... and {scanResult.orphanedFiles.length - 10} more
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Close Button */}
                  <button
                    onClick={closeScanModal}
                    className="w-full bg-gray-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};