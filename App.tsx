import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { SettingsPanel } from './components/SettingsPanel';
import { DataTable } from './components/DataTable';
import { BulkUploadModal } from './components/BulkUploadModal';
import { DuplicateResolutionModal } from './components/DuplicateResolutionModal';
import { FscRecord, AppSettings, SortConfig, DateFilter, DocType, ManagedFile } from './types';
import { fetchFscRecords } from './services/airtableService';
import { useDebounce } from './hooks/useDebounce';
import { FilterControls } from './components/FilterControls';
import { LocalStorageService, ScanResult } from './services/localStorageService';
import { electronStore } from './utils/electronStore';
import { calculateBatchCompletion, hasMissingDocType } from './utils/batchCompletion';
import { filterPersistence } from './utils/filterPersistence';
import { detectDuplicates, applyVersioning, DuplicateFile } from './utils/duplicateHandler';

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
    localStoragePath: '',
  });
  const [data, setData] = useState<FscRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(true);
  
  // Initialize filters with default values - will be loaded from storage
  const [textFilter, setTextFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>({ operator: 'exact', date1: '', date2: '' });
  const [createdDateFilter, setCreatedDateFilter] = useState<DateFilter>({ operator: 'exact', date1: '', date2: '' });
  const [smartFilter, setSmartFilter] = useState<'all' | 'missing-po' | 'missing-so' | 'missing-supplier-inv' | 'missing-customer-inv' | 'complete' | 'incomplete'>('all');
  const [filtersLoaded, setFiltersLoaded] = useState<boolean>(false);
  
  const debouncedTextFilter = useDebounce(textFilter, 300);
  
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'ascending' });
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [allManagedFiles, setAllManagedFiles] = useState<Record<string, Record<DocType, ManagedFile[]>>>({});
  const [showBulkUploadModal, setShowBulkUploadModal] = useState<boolean>(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [pendingUploadPlan, setPendingUploadPlan] = useState<Map<string, Map<DocType, File[]>> | null>(null);
  const [detectedDuplicates, setDetectedDuplicates] = useState<DuplicateFile[]>([]);
  
  const localStorageServiceRef = useRef<LocalStorageService | null>(null);

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

  // Load filters from persistent storage on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const savedFilters = await filterPersistence.loadFilters();
        if (savedFilters) {
          setSmartFilter(savedFilters.smartFilter);
          setTextFilter(savedFilters.textFilter);
          setDateFilter(savedFilters.dateFilter);
          setCreatedDateFilter(savedFilters.createdDateFilter);
        }
      } catch (error) {
        console.error('Error loading filters:', error);
      } finally {
        setFiltersLoaded(true);
      }
    };
    loadFilters();
  }, []);

  // Save filters to persistent storage whenever they change
  useEffect(() => {
    // Only save after filters have been loaded from storage
    if (!filtersLoaded) return;

    const saveFilters = async () => {
      try {
        await filterPersistence.saveFilters({
          smartFilter,
          textFilter,
          dateFilter,
          createdDateFilter,
        });
      } catch (error) {
        console.error('Error saving filters:', error);
      }
    };
    saveFilters();
  }, [smartFilter, textFilter, dateFilter, createdDateFilter, filtersLoaded]);

  // Save settings to persistent storage whenever they change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await electronStore.saveSettings(appSettings);
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    };
    // Only save if settings are not empty
    if (appSettings.apiKey || appSettings.baseId || appSettings.tableName || appSettings.localStoragePath) {
      saveSettings();
    }
  }, [appSettings]);

  // Initialize LocalStorageService
  useEffect(() => {
    const initializeLocalStorage = async () => {
      if (appSettings.localStoragePath) {
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
  }, [appSettings.localStoragePath]);

  const handleScanAndRebuild = async () => {
    if (!localStorageServiceRef.current) {
      throw new Error('Local storage not initialized');
    }

    // Create a set of valid batch numbers from current Airtable data
    const validBatchNumbers = new Set(
      data.map(record => String(record['Batch number']))
    );

    // Call the scan method with progress callback
    return await localStorageServiceRef.current.scanAndRebuildHistory(
      appSettings.localStoragePath,
      validBatchNumbers,
      (progress) => {
        console.log('Scan progress:', progress);
        // Progress updates are handled by SettingsPanel internally
      }
    );
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

    // Filter by Created Date
    const { operator: createdOperator, date1: createdDate1, date2: createdDate2 } = createdDateFilter;
    if (createdDate1) {
      const filterDate1 = parseDateToUTC(createdDate1);
      
      if (filterDate1) {
        filteredItems = filteredItems.filter(record => {
          const recordDateStr = record['Created'];
          // Created is an ISO string, so we can parse it directly
          const recordDate = recordDateStr ? new Date(recordDateStr) : null;
          
          if (!recordDate || isNaN(recordDate.getTime())) return false;

          // Convert to UTC for comparison
          const recordDateUTC = new Date(Date.UTC(
            recordDate.getFullYear(),
            recordDate.getMonth(),
            recordDate.getDate()
          ));

          switch (createdOperator) {
            case 'exact':
              return recordDateUTC.getTime() === filterDate1.getTime();
            case 'before':
              return recordDateUTC.getTime() <= filterDate1.getTime();
            case 'after':
              return recordDateUTC.getTime() >= filterDate1.getTime();
            case 'between':
              if (createdDate2) {
                const filterDate2 = parseDateToUTC(createdDate2);
                if (filterDate2) {
                  return recordDateUTC.getTime() >= filterDate1.getTime() && recordDateUTC.getTime() <= filterDate2.getTime();
                }
              }
              return true; 
            default:
              return true;
          }
        });
      }
    }

    // Smart Filter - Filter by missing document types or completion status
    if (smartFilter !== 'all') {
      filteredItems = filteredItems.filter(record => {
        const getUploadedCount = (batchNumber: string, docType: DocType): number => {
          if (localStorageServiceRef.current) {
            return localStorageServiceRef.current.getUploadedFileCount(batchNumber, docType);
          }
          return 0;
        };

        const completion = calculateBatchCompletion(record, getUploadedCount);

        switch (smartFilter) {
          case 'complete':
            return completion.isComplete;
          case 'incomplete':
            return !completion.isComplete;
          case 'missing-po':
            return hasMissingDocType(completion, DocType.PO);
          case 'missing-so':
            return hasMissingDocType(completion, DocType.SO);
          case 'missing-supplier-inv':
            return hasMissingDocType(completion, DocType.SupplierInvoice);
          case 'missing-customer-inv':
            return hasMissingDocType(completion, DocType.CustomerInvoice);
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
  }, [data, debouncedTextFilter, dateFilter, createdDateFilter, sortConfig, smartFilter, allManagedFiles, localStorageServiceRef]);

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

  // Bulk upload handler with duplicate detection and actual file upload
  const handleBulkUpload = async (uploadPlan: Map<string, Map<DocType, File[]>>) => {
    try {
      console.log('🔍 Starting duplicate detection...');
      console.log('📦 Upload plan:', uploadPlan);
      
      if (!localStorageServiceRef.current) {
        throw new Error('Local storage service not initialized');
      }
      
      // Step 1: Detect duplicates
      const duplicateResult = await detectDuplicates(
        uploadPlan,
        appSettings.localStoragePath,
        localStorageServiceRef.current
      );

      console.log('✅ Duplicate detection complete');
      console.log('🔄 Duplicates found:', duplicateResult.duplicates.length);
      console.log('📄 Duplicate files:', duplicateResult.duplicates);

      // Step 2: If there are duplicates, show resolution modal
      if (duplicateResult.duplicates.length > 0) {
        console.log('🚨 Showing duplicate resolution modal');
        setDetectedDuplicates(duplicateResult.duplicates);
        setPendingUploadPlan(uploadPlan);
        setShowBulkUploadModal(false);
        setShowDuplicateModal(true);
        return;
      }

      console.log('✨ No duplicates, proceeding with upload');
      // Step 3: No duplicates, proceed with upload
      await performBulkUpload(uploadPlan);
      
    } catch (error) {
      console.error('Error during bulk upload:', error);
      alert('An error occurred during bulk upload. Please try again.');
    }
  };

  // Handle duplicate resolution
  const handleDuplicateResolution = async (resolvedDuplicates: DuplicateFile[]) => {
    if (!pendingUploadPlan || !localStorageServiceRef.current) return;

    setShowDuplicateModal(false);

    try {
      // Apply versioning to resolved duplicates
      const versionedFiles = await applyVersioning(
        resolvedDuplicates,
        appSettings.localStoragePath,
        localStorageServiceRef.current
      );

      // Add versioned files back to the upload plan
      for (const versionedFile of versionedFiles) {
        if (!pendingUploadPlan.has(versionedFile.batchNumber)) {
          pendingUploadPlan.set(versionedFile.batchNumber, new Map());
        }
        const batchMap = pendingUploadPlan.get(versionedFile.batchNumber)!;
        if (!batchMap.has(versionedFile.docType)) {
          batchMap.set(versionedFile.docType, []);
        }
        batchMap.get(versionedFile.docType)!.push(versionedFile.file);
      }

      // Perform the actual upload
      await performBulkUpload(pendingUploadPlan);
      
      // Clear pending state
      setPendingUploadPlan(null);
      setDetectedDuplicates([]);
      setShowBulkUploadModal(false);
      
    } catch (error) {
      console.error('Error processing duplicates:', error);
      alert('An error occurred while processing duplicates. Please try again.');
      setShowDuplicateModal(false);
    }
  };

  // Actual upload function
  const performBulkUpload = async (uploadPlan: Map<string, Map<DocType, File[]>>) => {
    let totalFiles = 0;
    let uploadedFiles = 0;
    let errors: string[] = [];

    // Count total files
    for (const docTypeMap of uploadPlan.values()) {
      for (const files of docTypeMap.values()) {
        totalFiles += files.length;
      }
    }

    console.log(`🚀 Starting bulk upload of ${totalFiles} files...`);

    // Process each batch
    for (const [batchNumber, docTypeMap] of uploadPlan.entries()) {
      // Find the record for this batch
      const record = data.find(r => String(r['Batch number']) === batchNumber);
      if (!record) {
        errors.push(`Batch ${batchNumber} not found in records`);
        continue;
      }

      // Process each document type
      for (const [docType, files] of docTypeMap.entries()) {
        for (const file of files) {
          try {
            // Upload using local storage
            if (localStorageServiceRef.current && appSettings.localStoragePath) {
              await localStorageServiceRef.current.uploadFile(record, file, docType, appSettings.localStoragePath);
            } else {
              throw new Error('Local storage not configured');
            }

            uploadedFiles++;
            console.log(`✅ Uploaded ${file.name} to batch ${batchNumber} (${uploadedFiles}/${totalFiles})`);

          } catch (error) {
            const errorMsg = `Failed to upload ${file.name} to batch ${batchNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error('❌', errorMsg);
          }
        }
      }
    }

    // Show results
    if (errors.length > 0) {
      const message = `Upload completed with errors:\n- ${uploadedFiles} files uploaded successfully\n- ${errors.length} files failed\n\nErrors:\n${errors.join('\n')}`;
      alert(message);
    } else {
      alert(`✅ Successfully uploaded ${uploadedFiles} file${uploadedFiles > 1 ? 's' : ''}!`);
    }

    // Refresh data to update counts
    if (appSettings.apiKey && appSettings.baseId && appSettings.tableName) {
      handleFetchData();
    }
  };

  // Calculate statistics for filtered data using batch completion
  const dataStats = useMemo(() => {
    const total = processedData.length;
    let completeBatches = 0;
    let incompleteBatches = 0;
    let missingPO = 0;
    let missingSO = 0;
    let missingSupplierInv = 0;
    let missingCustomerInv = 0;

    const getUploadedCount = (batchNumber: string, docType: DocType): number => {
      if (localStorageServiceRef.current) {
        return localStorageServiceRef.current.getUploadedFileCount(batchNumber, docType);
      }
      return 0;
    };

    processedData.forEach(record => {
      const completion = calculateBatchCompletion(record, getUploadedCount);
      
      if (completion.isComplete) {
        completeBatches++;
      } else {
        incompleteBatches++;
      }

      // Count missing document types
      if (hasMissingDocType(completion, DocType.PO)) missingPO++;
      if (hasMissingDocType(completion, DocType.SO)) missingSO++;
      if (hasMissingDocType(completion, DocType.SupplierInvoice)) missingSupplierInv++;
      if (hasMissingDocType(completion, DocType.CustomerInvoice)) missingCustomerInv++;
    });

    return { 
      total, 
      completeBatches, 
      incompleteBatches, 
      missingPO, 
      missingSO, 
      missingSupplierInv, 
      missingCustomerInv 
    };
  }, [processedData, localStorageServiceRef]);

  return (
    <div className="min-h-screen text-gray-800 transition-colors duration-300">
      <Header 
        onToggleSettings={() => setIsSettingsOpen(!isSettingsOpen)}
        onRefresh={handleFetchData}
        isRefreshing={isLoading}
      />
      
      <SettingsPanel
        isOpen={isSettingsOpen}
        settings={appSettings}
        setSettings={setAppSettings}
        onFetchData={handleFetchData}
        onClose={() => setIsSettingsOpen(false)}
        onScanAndRebuild={handleScanAndRebuild}
      />

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-full mx-auto px-4">
          <div className="bg-white shadow-md rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-4 text-gray-900">FSC Report Dashboard</h1>
            <p className="text-gray-600 mb-6">
              Connect to your Airtable base to view, manage, and organize your FSC documents locally.
            </p>
            
            <FilterControls
              textFilter={textFilter}
              setTextFilter={setTextFilter}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              createdDateFilter={createdDateFilter}
              setCreatedDateFilter={setCreatedDateFilter}
              smartFilter={smartFilter}
              setSmartFilter={setSmartFilter}
            />
            
            {/* Stats Summary */}
            {!isLoading && !error && data.length > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{dataStats.total}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Total Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{dataStats.completeBatches}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Complete</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{dataStats.incompleteBatches}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Incomplete</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{dataStats.missingPO}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Missing PO</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{dataStats.missingSO}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Missing SO</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{dataStats.missingSupplierInv}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Missing Supplier Inv</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{dataStats.missingCustomerInv}</div>
                    <div className="text-xs text-gray-600 uppercase tracking-wide">Missing Customer Inv</div>
                  </div>
                </div>
                <div className="mt-3 text-center text-xs text-gray-500">
                  {dataStats.completeBatches > 0 && (
                    <span>{Math.round((dataStats.completeBatches / dataStats.total) * 100)}% completion rate</span>
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
              <>
                <DataTable 
                  data={processedData} 
                  sortConfig={sortConfig} 
                  requestSort={requestSort}
                  expandedRecordId={expandedRecordId}
                  onToggleExpand={handleToggleExpand}
                  managedFiles={allManagedFiles}
                  fileHandlers={fileHandlers}
                  appSettings={appSettings}
                  localStorageService={localStorageServiceRef.current}
                  onBulkUpload={() => setShowBulkUploadModal(true)}
                />
                
                {/* Bulk Upload Modal */}
                <BulkUploadModal
                  isOpen={showBulkUploadModal}
                  onClose={() => setShowBulkUploadModal(false)}
                  records={data}
                  onBulkUpload={handleBulkUpload}
                  appSettings={appSettings}
                  localStorageService={localStorageServiceRef.current}
                />

                {/* Duplicate Resolution Modal */}
                <DuplicateResolutionModal
                  isOpen={showDuplicateModal}
                  duplicates={detectedDuplicates}
                  onResolve={handleDuplicateResolution}
                  onCancel={() => {
                    setShowDuplicateModal(false);
                    setPendingUploadPlan(null);
                    setDetectedDuplicates([]);
                    setShowBulkUploadModal(true);
                  }}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;