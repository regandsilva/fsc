import React, { useState, useEffect } from 'react';
import { FscRecord, SortConfig, DocType, ManagedFile, AppSettings } from '../types';
import { FolderKanban, ChevronsUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Upload, CheckCircle, AlertTriangle, RotateCw, Settings, FolderOpen, Link2 } from 'lucide-react';
import { DocStatusIcons } from './DocStatusIcons';
import { FileManagementRow } from './FileManagementRow';
import { LocalStorageService } from '../services/localStorageService';
import { calculateBatchCompletion, getCompletionSummary } from '../utils/batchCompletion';
import { columnPreferences, ColumnPreferences, ColumnId, AirtableColumnId, AppColumnId } from '../utils/columnPreferences';

interface DataTableProps {
  data: FscRecord[];
  sortConfig: SortConfig;
  requestSort: (key: keyof FscRecord) => void;
  expandedRecordId: string | null;
  onToggleExpand: (recordId: string) => void;
  managedFiles: Record<string, Record<DocType, ManagedFile[]>>;
  fileHandlers: {
    add: (recordId: string, docType: DocType, file: File) => void;
    remove: (recordId: string, docType: DocType, fileId: number) => void;
    toggleComplete: (recordId: string, docType: DocType, fileId: number) => void;
    rename: (recordId: string, docType: DocType, fileId: number, newName: string) => void;
  };
  appSettings: AppSettings;
  localStorageService: LocalStorageService | null;
  onBulkUpload?: () => void;
}

const emptyFiles: Record<DocType, ManagedFile[]> = {
  [DocType.PO]: [],
  [DocType.SO]: [],
  [DocType.SupplierInvoice]: [],
  [DocType.CustomerInvoice]: [],
};

const folderMap: Record<DocType, string> = {
  [DocType.PO]: '1_PurchaseOrders',
  [DocType.SO]: '2_SalesOrders',
  [DocType.SupplierInvoice]: '3_SupplierInvoices',
  [DocType.CustomerInvoice]: '4_CustomerInvoices',
};

interface BatchProgressBarProps {
  record: FscRecord;
  appSettings: AppSettings;
  localStorageService: LocalStorageService | null;
}

const BatchProgressBar: React.FC<BatchProgressBarProps> = ({
  record,
  appSettings,
  localStorageService
}) => {
  const getUploadedCount = (batchNumber: string, docType: DocType): number => {
    if (localStorageService) {
      return localStorageService.getUploadedFileCount(batchNumber, docType);
    }
    return 0;
  };

  const completion = calculateBatchCompletion(record, getUploadedCount);
  const summary = getCompletionSummary(completion);

  // Color based on completion percentage
  let barColor = 'bg-red-500';
  let bgColor = 'bg-red-100';
  if (completion.percentage === 100) {
    barColor = 'bg-green-500';
    bgColor = 'bg-green-100';
  } else if (completion.percentage >= 50) {
    barColor = 'bg-yellow-500';
    bgColor = 'bg-yellow-100';
  }

  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">
          {completion.totalUploaded}/{completion.totalRequired}
        </span>
        <span className="text-gray-500">{completion.percentage}%</span>
      </div>
      <div className={`w-full ${bgColor} rounded-full h-2 overflow-hidden`}>
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${completion.percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 truncate" title={summary}>
        {summary}
      </span>
    </div>
  );
};

interface FileUploadCellProps {
  record: FscRecord;
  docType: DocType;
  files: ManagedFile[];
  onFileAdd: (recordId: string, docType: DocType, file: File) => void;
  appSettings: AppSettings;
  localStorageService: LocalStorageService | null;
  globalUploadMode: 'browse' | 'url';
}

const FileUploadCell: React.FC<FileUploadCellProps> = ({
  record,
  docType,
  files,
  onFileAdd,
  appSettings,
  localStorageService,
  globalUploadMode
}) => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadedCount, setUploadedCount] = useState(0);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  // Load uploaded count on mount
  React.useEffect(() => {
    if (localStorageService) {
      const batchNumber = record['Batch number'];
      if (batchNumber) {
        const count = localStorageService.getUploadedFileCount(batchNumber, docType);
        setUploadedCount(count);
      }
    }
  }, [localStorageService, record, docType]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onFileAdd(record.id, docType, file);
      e.target.value = '';
      
      // Auto-upload
      setUploading(true);
      setStatus('idle');
      
      try {
        if (!localStorageService || !appSettings.localStoragePath) {
          throw new Error('Local storage not configured');
        }
        await localStorageService.uploadFile(record, file, docType, appSettings.localStoragePath);
        // Update count after successful upload
        const batchNumber = record['Batch number'];
        if (batchNumber) {
          const count = localStorageService.getUploadedFileCount(batchNumber, docType);
          setUploadedCount(count);
        }
        setStatus('success');
        setTimeout(() => setStatus('idle'), 2000);
      } catch (error) {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleLoadFromUrl = async () => {
    const url = pdfUrl.trim();
    
    if (!url) {
      setUrlError('Please enter a URL');
      return;
    }

    setUploading(true);
    setStatus('idle');
    setUrlError('');

    try {
      // Direct fetch only - no third-party proxies
      const response = await fetch(url, { 
        mode: 'cors',
        headers: {
          'Accept': 'application/pdf,*/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      // Generate filename
      let filename = `${record['Batch number']}-${docType}-${Date.now()}.pdf`;
      
      const file = new File([blob], filename, { type: 'application/pdf' });
      
      // Add and upload
      onFileAdd(record.id, docType, file);
      
      if (!localStorageService || !appSettings.localStoragePath) {
        throw new Error('Local storage not configured');
      }
      
      await localStorageService.uploadFile(record, file, docType, appSettings.localStoragePath);
      
      // Update count
      const batchNumber = record['Batch number'];
      if (batchNumber) {
        const count = localStorageService.getUploadedFileCount(batchNumber, docType);
        setUploadedCount(count);
      }
      
      setStatus('success');
      setPdfUrl('');
      setShowUrlInput(false);
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      setStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'Failed to load PDF';
      setUrlError(errorMsg + ' - URL must allow CORS or be accessible directly');
      setTimeout(() => setStatus('idle'), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    if (globalUploadMode === 'url') {
      setShowUrlInput(true);
    }
    // If browse mode, the label will trigger the file input automatically
  };

  const fileCount = uploadedCount;
  const hasFiles = fileCount > 0;

  // URL Input Modal
  if (showUrlInput && globalUploadMode === 'url') {
    return (
      <td className="px-4 py-4 text-center">
        <div className="flex flex-col gap-2 min-w-[200px]">
          <input
            type="url"
            value={pdfUrl}
            onChange={(e) => {
              setPdfUrl(e.target.value);
              setUrlError('');
            }}
            placeholder="Paste PDF URL"
            className="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={uploading}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleLoadFromUrl();
              } else if (e.key === 'Escape') {
                setShowUrlInput(false);
                setPdfUrl('');
                setUrlError('');
              }
            }}
          />
          <div className="flex gap-1 justify-center">
            <button
              onClick={handleLoadFromUrl}
              disabled={uploading || !pdfUrl.trim()}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Loading...' : 'Load'}
            </button>
            <button
              onClick={() => {
                setShowUrlInput(false);
                setPdfUrl('');
                setUrlError('');
              }}
              disabled={uploading}
              className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {urlError && (
            <span className="text-xs text-red-600">{urlError}</span>
          )}
        </div>
      </td>
    );
  }

  return (
    <td className="px-4 py-4 text-center">
      <div className="flex flex-col items-center gap-1">
        {globalUploadMode === 'browse' ? (
          <label className={`cursor-pointer inline-flex items-center justify-center px-3 py-1.5 rounded text-xs font-medium transition ${
            uploading ? 'bg-blue-100 text-blue-700' :
            status === 'success' ? 'bg-green-100 text-green-700' :
            status === 'error' ? 'bg-red-100 text-red-700' :
            hasFiles ? 'bg-green-50 text-green-700 hover:bg-green-100' :
            'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}>
            {uploading ? (
              <><RotateCw className="h-3 w-3 mr-1 animate-spin" /> Uploading...</>
            ) : status === 'success' ? (
              <><CheckCircle className="h-3 w-3 mr-1" /> Uploaded</>
            ) : status === 'error' ? (
              <><AlertTriangle className="h-3 w-3 mr-1" /> Error</>
            ) : hasFiles ? (
              <><CheckCircle className="h-3 w-3 mr-1" /> {fileCount}</>
            ) : (
              <><Upload className="h-3 w-3 mr-1" /> Upload</>
            )}
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.xlsx,.xls,.doc,.docx"
              disabled={uploading}
            />
          </label>
        ) : (
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className={`inline-flex items-center justify-center px-3 py-1.5 rounded text-xs font-medium transition ${
              uploading ? 'bg-blue-100 text-blue-700' :
              status === 'success' ? 'bg-green-100 text-green-700' :
              status === 'error' ? 'bg-red-100 text-red-700' :
              hasFiles ? 'bg-green-50 text-green-700 hover:bg-green-100' :
              'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {uploading ? (
              <><RotateCw className="h-3 w-3 mr-1 animate-spin" /> Loading...</>
            ) : status === 'success' ? (
              <><CheckCircle className="h-3 w-3 mr-1" /> ✓</>
            ) : status === 'error' ? (
              <><AlertTriangle className="h-3 w-3 mr-1" /> Error</>
            ) : hasFiles ? (
              <><CheckCircle className="h-3 w-3 mr-1" /> {fileCount}</>
            ) : (
              <><Upload className="h-3 w-3 mr-1" /> Upload</>
            )}
          </button>
        )}
      </div>
    </td>
  );
};

export const DataTable: React.FC<DataTableProps> = ({ 
  data, 
  sortConfig, 
  requestSort, 
  expandedRecordId, 
  onToggleExpand, 
  managedFiles, 
  fileHandlers,
  appSettings,
  localStorageService,
  onBulkUpload
}) => {
  const [columnOrder, setColumnOrder] = useState<(keyof FscRecord)[]>([
    'Batch number',
    'PO REF',
    'SO',
    'FSC Approval Date',
    'Created',
    'FSC Status',
    'FSC Case Number',
    'PRODUCT NAME (MAX 35 CHARACTERS)'
  ]);
  const [draggedColumn, setDraggedColumn] = useState<keyof FscRecord | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<keyof FscRecord | null>(null);
  const [columnPrefs, setColumnPrefs] = useState<ColumnPreferences>(columnPreferences.getDefaultPreferences());
  const [showColumnSettings, setShowColumnSettings] = useState<boolean>(false);
  const [columnPrefsLoaded, setColumnPrefsLoaded] = useState<boolean>(false);
  const [resizingColumn, setResizingColumn] = useState<ColumnId | null>(null);
  const [resizeStartX, setResizeStartX] = useState<number>(0);
  const [resizeStartWidth, setResizeStartWidth] = useState<number>(0);
  const [globalUploadMode, setGlobalUploadMode] = useState<'browse' | 'url'>('browse');

  // Load column preferences on mount
  useEffect(() => {
    const loadColumnPrefs = async () => {
      const prefs = await columnPreferences.loadPreferences();
      setColumnPrefs(prefs);
      setColumnPrefsLoaded(true);
    };
    loadColumnPrefs();
  }, []);

  // Save column preferences when they change
  useEffect(() => {
    if (!columnPrefsLoaded) return;
    const saveColumnPrefs = async () => {
      await columnPreferences.savePreferences(columnPrefs);
    };
    saveColumnPrefs();
  }, [columnPrefs, columnPrefsLoaded]);

  // Load column order from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('fsc-column-order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setColumnOrder(parsed);
        }
      } catch (e) {
        console.warn('Failed to load column order');
      }
    }
  }, []);

  // Save column order to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('fsc-column-order', JSON.stringify(columnOrder));
  }, [columnOrder]);

  const handleDragStart = (e: React.DragEvent, column: keyof FscRecord) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, column: keyof FscRecord) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetColumn: keyof FscRecord) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumn) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    const newOrder = [...columnOrder];
    const draggedIdx = newOrder.indexOf(draggedColumn);
    const targetIdx = newOrder.indexOf(targetColumn);

    // Remove from old position and insert at new position
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedColumn);

    setColumnOrder(newOrder);
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">No data to display.</p>
        <p className="text-sm text-gray-400 mt-2">Try adjusting your filters or fetching data from Airtable.</p>
      </div>
    );
  }
  
  const displayHeaders = columnOrder;

  const getSortIcon = (key: keyof FscRecord) => {
    if (sortConfig.key !== key) {
        return <ChevronsUpDown className="h-4 w-4 ml-2 text-gray-400 group-hover:text-gray-500" />;
    }
    if (sortConfig.direction === 'ascending') {
        return <ArrowUp className="h-4 w-4 ml-2 text-blue-600" />;
    }
    return <ArrowDown className="h-4 w-4 ml-2 text-blue-600" />;
  };

  const renderCellContent = (content: unknown, header: keyof FscRecord): React.ReactNode => {
    if (header === 'FSC Approval Date' && typeof content === 'string') {
        const parts = content.split('/');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${day}/${month}/${year}`;
        }
    }

    if (header === 'Created' && typeof content === 'string') {
        // Format ISO timestamp to readable date
        const date = new Date(content);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            });
        }
    }

    if (content === null || content === undefined) return '';
    if (Array.isArray(content)) return content.map(item => String(item)).join(', ');
    if (typeof content === 'object') {
      if ('name' in content && typeof (content as any).name === 'string') return (content as any).name;
      return JSON.stringify(content);
    }
    return String(content);
  };

  const handleToggleColumnVisibility = (columnId: ColumnId) => {
    setColumnPrefs(prev => columnPreferences.toggleVisibility(prev, columnId));
  };

  const handleUpdateColumnWidth = (columnId: ColumnId, width: number) => {
    setColumnPrefs(prev => columnPreferences.updateWidth(prev, columnId, width));
  };

  const handleResetColumns = async () => {
    const defaults = await columnPreferences.resetToDefaults();
    setColumnPrefs(defaults);
  };

  const handleAutoFitColumn = (columnId: ColumnId) => {
    setColumnPrefs(prev => columnPreferences.setAutoFit(prev, columnId, true));
  };

  // Column resize handlers
  const handleResizeStart = (e: React.MouseEvent, columnId: ColumnId, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(currentWidth);
  };

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(80, resizeStartWidth + diff); // Minimum 80px
      handleUpdateColumnWidth(resizingColumn, newWidth);
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const airtableColumns = columnPreferences.getAirtableColumns(columnPrefs);
  const appColumns = columnPreferences.getAppColumns(columnPrefs);

  return (
    <div className="overflow-x-auto">
      {/* Bulk Upload and Column Settings Buttons */}
      <div className="flex justify-between items-center mb-2">
        {/* Left side: Upload mode toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 font-medium">Upload Mode:</span>
          <button
            onClick={() => setGlobalUploadMode('browse')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
              globalUploadMode === 'browse'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            Browse Files
          </button>
          <button
            onClick={() => setGlobalUploadMode('url')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition ${
              globalUploadMode === 'url'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Link2 className="h-4 w-4" />
            From URL
          </button>
        </div>

        {/* Right side: Bulk Upload and Column Settings */}
        <div className="flex gap-2">
          {onBulkUpload && (
            <button
              onClick={onBulkUpload}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
            >
              <Upload className="h-4 w-4" />
              <span>Bulk Upload</span>
            </button>
          )}
          <button
            onClick={() => setShowColumnSettings(true)}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition"
          >
            <Settings className="h-4 w-4" />
            <span>Customize Columns</span>
          </button>
        </div>
      </div>

      {/* Column Settings Modal */}
      {showColumnSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Customize Columns</h3>
                <button
                  onClick={() => setShowColumnSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Show/hide columns. Drag column edges in the table to resize, or click "Auto" for auto-fit.
              </p>

              {/* Airtable Columns Section */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">Airtable</span>
                  Data Columns
                </h4>
                <div className="space-y-3">
                  {airtableColumns.map((col) => (
                    <div
                      key={col.id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => handleToggleColumnVisibility(col.id)}
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label 
                          className="flex-1 text-sm font-medium text-gray-700 cursor-pointer" 
                          onClick={() => handleToggleColumnVisibility(col.id)}
                        >
                          {col.label}
                        </label>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">{col.autoFit ? 'Auto' : `${col.width}px`}</span>
                          <button
                            onClick={() => handleAutoFitColumn(col.id)}
                            className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition"
                            title="Auto-fit this column"
                          >
                            Auto
                          </button>
                        </div>
                      </div>
                      {col.visible && !col.autoFit && (
                        <div className="ml-7 text-xs text-gray-500 italic">
                          💡 Drag column edges in the table to resize
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* App Columns Section */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-2">App</span>
                  Document Columns
                </h4>
                <div className="space-y-3">
                  {appColumns.map((col) => (
                    <div
                      key={col.id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center space-x-3 mb-2">
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => handleToggleColumnVisibility(col.id)}
                          className="h-4 w-4 text-green-600 rounded focus:ring-green-500"
                        />
                        <label 
                          className="flex-1 text-sm font-medium text-gray-700 cursor-pointer" 
                          onClick={() => handleToggleColumnVisibility(col.id)}
                        >
                          {col.label}
                        </label>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">{col.autoFit ? 'Auto' : `${col.width}px`}</span>
                          <button
                            onClick={() => handleAutoFitColumn(col.id)}
                            className="px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded transition"
                            title="Auto-fit this column"
                          >
                            Auto
                          </button>
                        </div>
                      </div>
                      {col.visible && !col.autoFit && (
                        <div className="ml-7 text-xs text-gray-500 italic">
                          💡 Drag column edges in the table to resize
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button
                  onClick={handleResetColumns}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
                >
                  Reset to Default
                </button>
                <button
                  onClick={() => setShowColumnSettings(false)}
                  className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <table className="min-w-full divide-y divide-gray-200 hidden md:table">
        <thead className="bg-gray-50">
          <tr>
            {displayHeaders.map(header => {
              const colPref = columnPreferences.getColumn(columnPrefs, header as AirtableColumnId);
              if (!colPref?.visible) return null;
              
              return (
                <th 
                  key={header} 
                  scope="col" 
                  style={{ 
                    width: colPref.autoFit ? 'auto' : `${colPref.width}px`, 
                    minWidth: colPref.autoFit ? 'auto' : `${colPref.width}px`,
                    maxWidth: colPref.autoFit ? 'none' : undefined,
                    position: 'relative'
                  }}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-move select-none transition-colors ${
                    dragOverColumn === header ? 'bg-blue-100' : ''
                  } ${
                    draggedColumn === header ? 'opacity-50' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, header)}
                  onDragOver={(e) => handleDragOver(e, header)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, header)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center justify-between w-full">
                    <button className="flex items-center group flex-1" onClick={() => requestSort(header)}>
                      <span className="mr-1">⋮⋮</span>
                      <span className="break-words">{header}</span>
                      {getSortIcon(header)}
                    </button>
                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-gray-300"
                      onMouseDown={(e) => handleResizeStart(e, header as AirtableColumnId, colPref.width)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
              );
            })}
            {(() => {
              const poCol = columnPreferences.getColumn(columnPrefs, 'app-PO');
              return poCol?.visible && (
                <th 
                  scope="col" 
                  style={{ 
                    width: poCol.autoFit ? 'auto' : `${poCol.width}px`, 
                    minWidth: poCol.autoFit ? 'auto' : `${poCol.width}px`,
                    position: 'relative' 
                  }} 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <div className="flex items-center justify-center relative">
                    <span>PO</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-gray-300"
                      onMouseDown={(e) => handleResizeStart(e, 'app-PO', poCol.width)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
              );
            })()}
            {(() => {
              const soCol = columnPreferences.getColumn(columnPrefs, 'app-SO');
              return soCol?.visible && (
                <th 
                  scope="col" 
                  style={{ 
                    width: soCol.autoFit ? 'auto' : `${soCol.width}px`, 
                    minWidth: soCol.autoFit ? 'auto' : `${soCol.width}px`,
                    position: 'relative' 
                  }} 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <div className="flex items-center justify-center relative">
                    <span>SO</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-gray-300"
                      onMouseDown={(e) => handleResizeStart(e, 'app-SO', soCol.width)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
              );
            })()}
            {(() => {
              const supplierCol = columnPreferences.getColumn(columnPrefs, 'app-SupplierInvoice');
              return supplierCol?.visible && (
                <th 
                  scope="col" 
                  style={{ 
                    width: supplierCol.autoFit ? 'auto' : `${supplierCol.width}px`, 
                    minWidth: supplierCol.autoFit ? 'auto' : `${supplierCol.width}px`,
                    position: 'relative' 
                  }} 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <div className="flex items-center justify-center relative">
                    <span>Supplier Invoice</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-gray-300"
                      onMouseDown={(e) => handleResizeStart(e, 'app-SupplierInvoice', supplierCol.width)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
              );
            })()}
            {(() => {
              const customerCol = columnPreferences.getColumn(columnPrefs, 'app-CustomerInvoice');
              return customerCol?.visible && (
                <th 
                  scope="col" 
                  style={{ 
                    width: customerCol.autoFit ? 'auto' : `${customerCol.width}px`, 
                    minWidth: customerCol.autoFit ? 'auto' : `${customerCol.width}px`,
                    position: 'relative' 
                  }} 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <div className="flex items-center justify-center relative">
                    <span>Customer Invoice</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-gray-300"
                      onMouseDown={(e) => handleResizeStart(e, 'app-CustomerInvoice', customerCol.width)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
              );
            })()}
            {(() => {
              const completionCol = columnPreferences.getColumn(columnPrefs, 'app-Completion');
              return completionCol?.visible && (
                <th 
                  scope="col" 
                  style={{ 
                    width: completionCol.autoFit ? 'auto' : `${completionCol.width}px`, 
                    minWidth: completionCol.autoFit ? 'auto' : `${completionCol.width}px`,
                    position: 'relative' 
                  }} 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  <div className="flex items-center justify-between relative">
                    <span>Completion</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 bg-gray-300"
                      onMouseDown={(e) => handleResizeStart(e, 'app-Completion', completionCol.width)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
              );
            })()}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((record) => (
            <React.Fragment key={record.id}>
              <tr className="hover:bg-gray-50">
                {displayHeaders.map(header => {
                  const colPref = columnPreferences.getColumn(columnPrefs, header as AirtableColumnId);
                  if (!colPref?.visible) return null;
                  
                  return (
                    <td 
                      key={header} 
                      style={{ 
                        width: colPref.autoFit ? 'auto' : `${colPref.width}px`, 
                        minWidth: colPref.autoFit ? 'auto' : `${colPref.width}px`,
                        maxWidth: colPref.autoFit ? 'none' : `${colPref.width}px`
                      }} 
                      className="px-6 py-4 text-sm text-gray-500 break-words"
                    >
                      {renderCellContent(record[header], header)}
                    </td>
                  );
                })}
                {(() => {
                  const poCol = columnPreferences.getColumn(columnPrefs, 'app-PO');
                  return poCol?.visible && (
                    <FileUploadCell
                      record={record}
                      docType={DocType.PO}
                      files={managedFiles[record.id]?.[DocType.PO] || []}
                      onFileAdd={fileHandlers.add}
                      appSettings={appSettings}
                      localStorageService={localStorageService}
                      globalUploadMode={globalUploadMode}
                    />
                  );
                })()}
                {(() => {
                  const soCol = columnPreferences.getColumn(columnPrefs, 'app-SO');
                  return soCol?.visible && (
                    <FileUploadCell
                      record={record}
                      docType={DocType.SO}
                      files={managedFiles[record.id]?.[DocType.SO] || []}
                      onFileAdd={fileHandlers.add}
                      appSettings={appSettings}
                      localStorageService={localStorageService}
                      globalUploadMode={globalUploadMode}
                    />
                  );
                })()}
                {(() => {
                  const supplierCol = columnPreferences.getColumn(columnPrefs, 'app-SupplierInvoice');
                  return supplierCol?.visible && (
                    <FileUploadCell
                      record={record}
                      docType={DocType.SupplierInvoice}
                      files={managedFiles[record.id]?.[DocType.SupplierInvoice] || []}
                      onFileAdd={fileHandlers.add}
                      appSettings={appSettings}
                      localStorageService={localStorageService}
                      globalUploadMode={globalUploadMode}
                    />
                  );
                })()}
                {(() => {
                  const customerCol = columnPreferences.getColumn(columnPrefs, 'app-CustomerInvoice');
                  return customerCol?.visible && (
                    <FileUploadCell
                      record={record}
                      docType={DocType.CustomerInvoice}
                      files={managedFiles[record.id]?.[DocType.CustomerInvoice] || []}
                      onFileAdd={fileHandlers.add}
                      appSettings={appSettings}
                      localStorageService={localStorageService}
                      globalUploadMode={globalUploadMode}
                    />
                  );
                })()}
                {(() => {
                  const completionCol = columnPreferences.getColumn(columnPrefs, 'app-Completion');
                  return completionCol?.visible && (
                    <td 
                      style={{ 
                        width: completionCol.autoFit ? 'auto' : `${completionCol.width}px`, 
                        minWidth: completionCol.autoFit ? 'auto' : `${completionCol.width}px`,
                        maxWidth: completionCol.autoFit ? 'none' : `${completionCol.width}px`
                      }} 
                      className="px-6 py-4 text-sm text-gray-500 break-words"
                    >
                      <BatchProgressBar
                        record={record}
                        appSettings={appSettings}

                        localStorageService={localStorageService}
                      />
                    </td>
                  );
                })()}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      
      {/* Mobile Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
        {data.map((record) => (
          <div key={record.id} className="bg-white rounded-lg shadow p-4 space-y-3 border border-gray-200">
            {displayHeaders.map(header => {
              const colPref = columnPreferences.getColumn(columnPrefs, header as AirtableColumnId);
              if (!colPref?.visible) return null;
              
              return (
                <div key={header}>
                  <p className="text-xs font-bold text-gray-500 uppercase">{header}</p>
                  <p className="text-sm text-gray-800">{renderCellContent(record[header], header) || 'N/A'}</p>
                </div>
              );
            })}
             <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Attachments</p>
                <DocStatusIcons files={managedFiles[record.id] || emptyFiles} />
            </div>
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Completion Status</p>
                <BatchProgressBar
                  record={record}
                  appSettings={appSettings}

                  localStorageService={localStorageService}
                />
            </div>
            <button onClick={() => onToggleExpand(record.id)} className="w-full mt-4 flex items-center justify-center space-x-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition">
              <FolderKanban className="h-5 w-5" />
              <span>{expandedRecordId === record.id ? 'Close' : 'Manage Files'}</span>
               {expandedRecordId === record.id ? <ChevronUp className="h-5 w-5 ml-1" /> : <ChevronDown className="h-5 w-5 ml-1" />}
            </button>
            {expandedRecordId === record.id && (
                <div className="p-4 bg-gray-50 rounded-b-lg -m-4 mt-4">
                     <FileManagementRow
                        record={record}
                        managedFiles={managedFiles[record.id] || emptyFiles}
                        fileHandlers={fileHandlers}
                        colSpan={1} // Not applicable here, but required by prop
                        isMobile={true}
                        appSettings={appSettings}
                        localStorageService={localStorageService}
                        globalUploadMode={globalUploadMode}
                    />
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
