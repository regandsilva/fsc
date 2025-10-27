import React from 'react';
import { saveDirectoryHandle } from '../utils/dirHandleStore';
import { AppSettings, AuthState } from '../types';
import { X, LogIn, LogOut, RotateCw } from './Icons';

interface SettingsPanelProps {
  isOpen: boolean;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onFetchData: () => void;
  onClose: () => void;
  authState: AuthState;
  onLogin: () => void;
  onLogout: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, settings, setSettings, onFetchData, onClose, authState, onLogin, onLogout }) => {
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

  return (
    <div
      className={`fixed top-0 right-0 h-full w-80 bg-white shadow-lg z-30 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-gray-900">Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        <div className="space-y-4 flex-grow overflow-y-auto pr-2">
          {/* Airtable Settings */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Airtable Connection</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="apiKey" className="block text-xs font-medium text-gray-700 mb-1">API Key</label>
                <input type="password" name="apiKey" id="apiKey" value={settings.apiKey} onChange={handleChange} className="block w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50" placeholder="pat..."/>
              </div>
              <div>
                <label htmlFor="baseId" className="block text-xs font-medium text-gray-700 mb-1">Base ID</label>
                <input type="text" name="baseId" id="baseId" value={settings.baseId} onChange={handleChange} className="block w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50" placeholder="app..."/>
              </div>
              <div>
                <label htmlFor="tableName" className="block text-xs font-medium text-gray-700 mb-1">Table Name</label>
                <input type="text" name="tableName" id="tableName" value={settings.tableName} onChange={handleChange} className="block w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50" placeholder="e.g., FSC Report"/>
              </div>
            </div>
          </div>

          {/* Storage Mode Selection */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Document Storage</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Storage Mode</label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="storageMode"
                      value="onedrive"
                      checked={settings.storageMode === 'onedrive'}
                      onChange={(e) => setSettings(prev => ({ ...prev, storageMode: e.target.value as 'onedrive' | 'local' }))}
                      className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700">OneDrive (Cloud Storage)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="storageMode"
                      value="local"
                      checked={settings.storageMode === 'local'}
                      onChange={(e) => setSettings(prev => ({ ...prev, storageMode: e.target.value as 'onedrive' | 'local' }))}
                      className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500"
                      disabled={!canUseLocalFolder}
                    />
                    <span className={`text-xs ${!canUseLocalFolder ? 'text-gray-400' : 'text-gray-700'}`}>
                      Local PC Folder{!canUseLocalFolder ? ' (Not supported in this browser)' : ''}
                    </span>
                  </label>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500">
                  Choose where to save uploaded documents
                </p>
              </div>

              {settings.storageMode === 'local' && (
                <div>
                  <label htmlFor="localStoragePath" className="block text-xs font-medium text-gray-700 mb-1">Local Storage Folder</label>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      name="localStoragePath"
                      id="localStoragePath"
                      value={settings.localStoragePath || ''}
                      onChange={handleChange}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                      placeholder="Select a folder..."
                    />
                    <button
                      onClick={handleSelectFolder}
                      className="px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 text-xs"
                    >
                      Browse
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500">
                    Folders will be created automatically in the selected folder: {'{'}BatchNumber{'}'}/{'{'}DocType{'}'}
                  </p>
                  {!canUseLocalFolder && (
                    <p className="mt-1 text-[10px] text-red-600">
                      Your browser doesn't support selecting a local folder. Try a Chromium-based browser (Chrome/Edge) or use the desktop app.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* OneDrive Settings - Only show if storageMode is onedrive */}
          {settings.storageMode === 'onedrive' && (
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">OneDrive Integration</h3>
            <div className="space-y-3">
               <div>
                <label htmlFor="msalClientId" className="block text-xs font-medium text-gray-700 mb-1">Application (Client) ID</label>
                <input type="text" name="msalClientId" id="msalClientId" value={settings.msalClientId} onChange={handleChange} className="block w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50" placeholder="Enter your Azure App Client ID"/>
                <p className="mt-1 text-[10px] text-gray-500">Required for OneDrive login. Create one in your Azure Portal.</p>
              </div>

              <div>
                <label htmlFor="azureAuthority" className="block text-xs font-medium text-gray-700 mb-1">Azure Authority (Tenant)</label>
                <select name="azureAuthority" id="azureAuthority" value={settings.azureAuthority ?? 'common'} onChange={handleSelectChange} className="block w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50">
                  <option value="common">common (multi-tenant + personal)</option>
                  <option value="organizations">organizations (work/school only)</option>
                  <option value="consumers">consumers (personal accounts only)</option>
                </select>
                <p className="mt-1 text-[10px] text-gray-500">If your app is single-tenant, you can also enter your tenant ID or domain here instead of the presets.</p>
                <input type="text" name="azureAuthority" value={settings.azureAuthority ?? ''} onChange={handleChange} className="block w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white" placeholder="Optional: custom tenant (e.g., contoso.onmicrosoft.com or tenant GUID)"/>
              </div>

              {authState.isAuthenticated ? (
                  <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded-r-lg">
                      <p className="text-xs font-medium text-green-800">Logged in as:</p>
                      <p className="text-xs text-green-700 truncate">{authState.user?.email}</p>
                      <button onClick={onLogout} className="mt-2 w-full flex items-center justify-center space-x-1.5 bg-red-500 text-white font-bold py-1.5 px-2.5 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-300 text-xs">
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Logout</span>
                      </button>
                  </div>
              ) : (
                  <button onClick={onLogin} disabled={!settings.msalClientId || authState.loading} className="w-full flex items-center justify-center space-x-1.5 bg-blue-600 text-white font-bold py-1.5 px-3 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-300 disabled:bg-gray-400 text-xs">
                      {authState.loading ? <RotateCw className="h-4 w-4 animate-spin"/> : <LogIn className="h-4 w-4"/>}
                      <span>{authState.loading ? 'Logging in...' : 'Login to OneDrive'}</span>
                  </button>
              )}

              {authState.error && <p className="text-xs text-red-600">{authState.error}</p>}
              
              <div>
                <label htmlFor="oneDriveBasePath" className="block text-xs font-medium text-gray-700 mb-1">OneDrive Base Folder Path</label>
                <input type="text" name="oneDriveBasePath" id="oneDriveBasePath" value={settings.oneDriveBasePath} onChange={handleChange} className="block w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-gray-50 disabled:bg-gray-200" placeholder="/MyFolder/Uploads" disabled={!authState.isAuthenticated}/>
                <p className="mt-1 text-[10px] text-gray-500">The root folder in OneDrive for all uploads.</p>
              </div>
            </div>
          </div>
          )}
        </div>

        <button
          onClick={onFetchData}
          className="w-full mt-3 bg-indigo-600 text-white font-bold py-2 px-3 text-xs rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-300"
        >
          Fetch Airtable Data
        </button>
      </div>
    </div>
  );
};