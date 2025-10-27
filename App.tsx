import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { SettingsPanel } from './components/SettingsPanel';
import { DataTable } from './components/DataTable';
import { FscRecord, AppSettings, SortConfig, DateFilter, DocType, ManagedFile, AuthState } from './types';
import { fetchFscRecords } from './services/airtableService';
import { useDebounce } from './hooks/useDebounce';
import { FilterControls } from './components/FilterControls';
import { OneDriveService } from './services/oneDriveService';
import { LocalStorageService } from './services/localStorageService';
import { electronStore } from './utils/electronStore';

// A more robust date parser that handles both YYYY-MM-DD and D/M/YYYY formats.
const parseDateToUTC = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const trimmedDateStr = dateStr.trim();
    if (!trimmedDateStr) return null;

    let parts: string[];
    let year: number, month: number, day: number;

    // Try parsing YYYY-MM-DD (from date picker and standard APIs)
    if (trimmedDateStr.includes('-')) {
        parts = trimmedDateStr.split('-');
        if (parts.length === 3) {
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
            day = parseInt(parts[2], 10);
        } else {
            return null;
        }
    } 
    // Try parsing D/M/YYYY (from CSV example)
    else if (trimmedDateStr.includes('/')) {
        parts = trimmedDateStr.split('/');
        if (parts.length === 3) {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
            year = parseInt(parts[2], 10);
        } else {
            return null;
        }
    } 
    // Unrecognized format
    else {
        return null;
    }

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    // Validate the parsed date components to prevent invalid dates (e.g., Feb 30)
    const date = new Date(Date.UTC(year, month, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
        return date;
    }

    return null;
};


const App: React.FC = () => {
  const [appSettings, setAppSettings] = useState<AppSettings>({
    apiKey: '',
    baseId: '',
    tableName: '',
    msalClientId: '',
    azureAuthority: 'common',
    oneDriveBasePath: '/FSC_Uploads',
    storageMode: 'onedrive',
    localStoragePath: '',
  });
  const [data, setData] = useState<FscRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);
  
  const [textFilter, setTextFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>({ operator: 'exact', date1: '', date2: '' });
  const [createdDateFilter, setCreatedDateFilter] = useState<DateFilter>({ operator: 'exact', date1: '', date2: '' });
  const [uploadStatusFilter, setUploadStatusFilter] = useState<'all' | 'complete' | 'partial' | 'none'>('all');
  
  const debouncedTextFilter = useDebounce(textFilter, 300);
  
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'ascending' });
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [allManagedFiles, setAllManagedFiles] = useState<Record<string, Record<DocType, ManagedFile[]>>>({});
  
  const oneDriveServiceRef = useRef<OneDriveService | null>(null);
  const localStorageServiceRef = useRef<LocalStorageService | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    error: null,
    loading: false,
  });

  // Load settings from persistent storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await electronStore.getSettings();
        if (savedSettings) {
          setAppSettings(savedSettings);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Save settings to persistent storage whenever they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await electronStore.saveSettings(appSettings);
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    };
    // Only save if settings are not empty (to avoid saving initial empty state)
    if (appSettings.apiKey || appSettings.baseId || appSettings.tableName || appSettings.msalClientId) {
      saveSettings();
    }
  }, [appSettings]);

  useEffect(() => {
    const initializeOneDrive = async () => {
      if (appSettings.msalClientId) {
        try {
          // Create service if not exists or recreate if client ID changed
          if (!oneDriveServiceRef.current) {
            oneDriveServiceRef.current = new OneDriveService();
          }
          
          // Initialize with the client ID and selected authority (default 'common')
          await oneDriveServiceRef.current.initialize(appSettings.msalClientId, appSettings.azureAuthority ?? 'common');
          
          const account = oneDriveServiceRef.current.getAccount();
          if (account) {
            setAuthState({ isAuthenticated: true, user: { name: account.name, email: account.username }, error: null, loading: false });
          }
        } catch (error) {
          console.error('Error initializing OneDrive service:', error);
          setAuthState({ isAuthenticated: false, user: null, error: 'Failed to initialize OneDrive', loading: false });
        }
      } else {
        oneDriveServiceRef.current = null;
      }
    };
    initializeOneDrive();
  }, [appSettings.msalClientId, appSettings.azureAuthority]);

  // Initialize LocalStorageService
  useEffect(() => {
    const initializeLocalStorage = async () => {
      if (appSettings.storageMode === 'local' && appSettings.localStoragePath) {
        if (!localStorageServiceRef.current) {
          localStorageServiceRef.current = new LocalStorageService();
        }
        // Load history when we have a path
        await localStorageServiceRef.current.initialize(appSettings.localStoragePath);
        console.log('✅ Local storage service initialized with path:', appSettings.localStoragePath);
      } else {
        localStorageServiceRef.current = null;
      }
    };
    initializeLocalStorage();
  }, [appSettings.storageMode, appSettings.localStoragePath]);

  const handleLogin = async () => {
    if (!oneDriveServiceRef.current) {
        setAuthState(prev => ({ ...prev, error: "MSAL Client ID is not configured." }));
        return;
    }
    setAuthState(prev => ({...prev, loading: true}));
    try {
        const account = await oneDriveServiceRef.current.login();
        if (account) {
            setAuthState({ isAuthenticated: true, user: { name: account.name, email: account.username }, error: null, loading: false });
        }
    } catch (error) {
        setAuthState({ isAuthenticated: false, user: null, error: (error as Error).message, loading: false });
    }
  };

  const handleLogout = async () => {
    if (oneDriveServiceRef.current) {
        await oneDriveServiceRef.current.logout();
        setAuthState({ isAuthenticated: false, user: null, error: null, loading: false });
    }
  };


  const handleFetchData = async () => {
    if (!appSettings.apiKey || !appSettings.baseId || !appSettings.tableName) {
      setError("Please provide all Airtable settings.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const records = await fetchFscRecords(appSettings);
      setData(records);
      setSortConfig({ key: null, direction: 'ascending' });
      setExpandedRecordId(null);
      setAllManagedFiles({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const processedData = useMemo(() => {
    let filteredItems: FscRecord[] = [...data];

    if (debouncedTextFilter) {
      filteredItems = filteredItems.filter(record =>
        Object.values(record).some(value =>
          String(value).toLowerCase().includes(debouncedTextFilter.toLowerCase())
        )
      );
    }
    
    // Filter by FSC Approval Date
    const { operator, date1, date2 } = dateFilter;
    if (date1) {
      const filterDate1 = parseDateToUTC(date1);
      
      if (filterDate1) {
        filteredItems = filteredItems.filter(record => {
          const recordDateStr = record['FSC Approval Date'];
          const recordDate = parseDateToUTC(recordDateStr);
          
          if (!recordDate) return false;

          switch (operator) {
            case 'exact':
              return recordDate.getTime() === filterDate1.getTime();
            case 'before':
              return recordDate.getTime() <= filterDate1.getTime();
            case 'after':
              return recordDate.getTime() >= filterDate1.getTime();
            case 'between':
              if (date2) {
                const filterDate2 = parseDateToUTC(date2);
                if (filterDate2) {
                  return recordDate.getTime() >= filterDate1.getTime() && recordDate.getTime() <= filterDate2.getTime();
                }
              }
              return true; 
            default:
              return true;
          }
        });
      }
    }

    // Filter by upload status
    if (uploadStatusFilter !== 'all') {
      filteredItems = filteredItems.filter(record => {
        const recordFiles = allManagedFiles[record.id] || { [DocType.PO]: [], [DocType.SO]: [], [DocType.SupplierInvoice]: [], [DocType.CustomerInvoice]: [] };

        // Determine presence per DocType (not just total count)
        let hasPO = false, hasSO = false, hasSupInv = false, hasCustInv = false;
        if (appSettings.storageMode === 'local' && localStorageServiceRef.current) {
          const batchNumber = record['Batch number'];
          if (batchNumber) {
            hasPO = localStorageServiceRef.current.getUploadedFileCount(batchNumber, DocType.PO) > 0;
            hasSO = localStorageServiceRef.current.getUploadedFileCount(batchNumber, DocType.SO) > 0;
            hasSupInv = localStorageServiceRef.current.getUploadedFileCount(batchNumber, DocType.SupplierInvoice) > 0;
            hasCustInv = localStorageServiceRef.current.getUploadedFileCount(batchNumber, DocType.CustomerInvoice) > 0;
          }
        } else {
          hasPO = (recordFiles[DocType.PO] || []).length > 0;
          hasSO = (recordFiles[DocType.SO] || []).length > 0;
          hasSupInv = (recordFiles[DocType.SupplierInvoice] || []).length > 0;
          hasCustInv = (recordFiles[DocType.CustomerInvoice] || []).length > 0;
        }

        const allPresent = hasPO && hasSO && hasSupInv && hasCustInv;
        const anyPresent = hasPO || hasSO || hasSupInv || hasCustInv;

        switch (uploadStatusFilter) {
          case 'complete':
            return allPresent;
          case 'partial':
            return anyPresent && !allPresent;
          case 'none':
            return !anyPresent;
          default:
            return true;
        }
      });
    }

    if (sortConfig.key !== null) {
      const key = sortConfig.key as keyof FscRecord;
      filteredItems.sort((a, b) => {
        const aValue = a[key];
        const bValue = b[key];

        if (aValue == null) return 1;
        if (bValue == null) return -1;

        const aComparable = typeof aValue === 'object' ? JSON.stringify(aValue) : aValue;
        const bComparable = typeof bValue === 'object' ? JSON.stringify(bValue) : bValue;

        let comparison = 0;
        if (typeof aComparable === 'string' && typeof bComparable === 'string') {
          comparison = aComparable.localeCompare(bComparable);
        } else if (aComparable < bComparable) {
          comparison = -1;
        } else if (aComparable > bComparable) {
          comparison = 1;
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return filteredItems;
  }, [data, debouncedTextFilter, dateFilter, createdDateFilter, sortConfig, uploadStatusFilter, allManagedFiles, appSettings.storageMode]);

  const requestSort = (key: keyof FscRecord) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const handleToggleExpand = (recordId: string) => {
    setExpandedRecordId(prevId => (prevId === recordId ? null : recordId));
  };
  
  const fileHandlers = {
    add: (recordId: string, docType: DocType, file: File) => {
      const newManagedFile: ManagedFile = {
        id: Date.now(),
        file,
        suggestedName: file.name,
        completed: false,
      };
      setAllManagedFiles(prev => {
        const recordFiles = prev[recordId] || { [DocType.PO]: [], [DocType.SO]: [], [DocType.SupplierInvoice]: [], [DocType.CustomerInvoice]: [] };
        return {
          ...prev,
          [recordId]: {
            ...recordFiles,
            [docType]: [...recordFiles[docType], newManagedFile],
          },
        };
      });
    },
    remove: (recordId: string, docType: DocType, fileId: number) => {
      setAllManagedFiles(prev => ({
        ...prev,
        [recordId]: {
          ...prev[recordId],
          [docType]: prev[recordId][docType].filter(f => f.id !== fileId),
        },
      }));
    },
    toggleComplete: (recordId: string, docType: DocType, fileId: number) => {
       setAllManagedFiles(prev => ({
        ...prev,
        [recordId]: {
          ...prev[recordId],
          [docType]: prev[recordId][docType].map(f => f.id === fileId ? {...f, completed: !f.completed} : f),
        },
      }));
    },
    rename: (recordId: string, docType: DocType, fileId: number, newName: string) => {
      setAllManagedFiles(prev => ({
        ...prev,
        [recordId]: {
          ...prev[recordId],
          [docType]: prev[recordId][docType].map(f => f.id === fileId ? {...f, suggestedName: newName} : f),
        },
      }));
    },
  };

  // Calculate statistics for filtered data
  const dataStats = useMemo(() => {
    const total = processedData.length;
    let completeCount = 0;
    let partialCount = 0;
    let noneCount = 0;

    processedData.forEach(record => {
      const recordFiles = allManagedFiles[record.id] || { [DocType.PO]: [], [DocType.SO]: [], [DocType.SupplierInvoice]: [], [DocType.CustomerInvoice]: [] };

      let hasPO = false, hasSO = false, hasSupInv = false, hasCustInv = false;
      if (appSettings.storageMode === 'local' && localStorageServiceRef.current) {
        const batchNumber = record['Batch number'];
        if (batchNumber) {
          hasPO = localStorageServiceRef.current.getUploadedFileCount(batchNumber, DocType.PO) > 0;
          hasSO = localStorageServiceRef.current.getUploadedFileCount(batchNumber, DocType.SO) > 0;
          hasSupInv = localStorageServiceRef.current.getUploadedFileCount(batchNumber, DocType.SupplierInvoice) > 0;
          hasCustInv = localStorageServiceRef.current.getUploadedFileCount(batchNumber, DocType.CustomerInvoice) > 0;
        }
      } else {
        hasPO = (recordFiles[DocType.PO] || []).length > 0;
        hasSO = (recordFiles[DocType.SO] || []).length > 0;
        hasSupInv = (recordFiles[DocType.SupplierInvoice] || []).length > 0;
        hasCustInv = (recordFiles[DocType.CustomerInvoice] || []).length > 0;
      }

      const allPresent = hasPO && hasSO && hasSupInv && hasCustInv;
      const anyPresent = hasPO || hasSO || hasSupInv || hasCustInv;

      if (allPresent) {
        completeCount++;
      } else if (anyPresent) {
        partialCount++;
      } else {
        noneCount++;
      }
    });

    return { total, completeCount, partialCount, noneCount };
  }, [processedData, allManagedFiles, appSettings.storageMode]);

  return (
    <div className="min-h-screen text-gray-800 transition-colors duration-300">
      <Header onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)} />
      
      <SettingsPanel
        isOpen={isSettingsOpen}
        settings={appSettings}
        setSettings={setAppSettings}
        onFetchData={handleFetchData}
        onClose={() => setIsSettingsOpen(false)}
        authState={authState}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-full mx-auto px-4">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-4 text-gray-900">FSC Report Dashboard</h1>
            <p className="text-gray-600 mb-6">
              Connect to your Airtable base and OneDrive to view, manage, and organize your FSC documents.
            </p>
            
            <FilterControls
              textFilter={textFilter}
              setTextFilter={setTextFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              createdDateFilter={createdDateFilter}
              setCreatedDateFilter={setCreatedDateFilter}
              uploadStatusFilter={uploadStatusFilter}
              setUploadStatusFilter={setUploadStatusFilter}
            />
            
            {/* Stats Summary */}
            {!isLoading && !error && data.length > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{dataStats.total}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Total Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{dataStats.completeCount}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Fully Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{dataStats.partialCount}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Partially Uploaded</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{dataStats.noneCount}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Not Started</div>
                  </div>
                </div>
                <div className="mt-3 text-center text-xs text-gray-500">
                  {dataStats.completeCount > 0 && (
                    <span>{Math.round((dataStats.completeCount / dataStats.total) * 100)}% completion rate</span>
                  )}
                </div>
              </div>
            )}
            
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</div>
            ) : (
              <DataTable 
                data={processedData} 
                sortConfig={sortConfig} 
                requestSort={requestSort}
                expandedRecordId={expandedRecordId}
                onToggleExpand={handleToggleExpand}
                managedFiles={allManagedFiles}
                fileHandlers={fileHandlers}
                authState={authState}
                oneDriveBasePath={appSettings.oneDriveBasePath}
                oneDriveService={oneDriveServiceRef.current}
                appSettings={appSettings}
                localStorageService={localStorageServiceRef.current}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;