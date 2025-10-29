import React, { useState, useEffect } from 'react';
import { FscRecord, SortConfig, DocType, ManagedFile, AuthState, AppSettings } from '../types';
import { FolderKanban, ChevronsUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Upload, CheckCircle, AlertTriangle, RotateCw, Settings } from 'lucide-react';
import { DocStatusIcons } from './DocStatusIcons';
import { FileManagementRow } from './FileManagementRow';
import { OneDriveService } from '../services/oneDriveService';
import { LocalStorageService } from '../services/localStorageService';
import { calculateBatchCompletion, getCompletionSummary } from '../utils/batchCompletion';
import { columnPreferences, ColumnPreferences, DocColumnId } from '../utils/columnPreferences';

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
  authState: AuthState;
  oneDriveBasePath: string;
  oneDriveService: OneDriveService | null;
  appSettings: AppSettings;
  localStorageService: LocalStorageService | null;
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
  oneDriveService: OneDriveService | null;
  localStorageService: LocalStorageService | null;
}

const BatchProgressBar: React.FC<BatchProgressBarProps> = ({
  record,
  appSettings,
  oneDriveService,
  localStorageService
}) => {
  const getUploadedCount = (batchNumber: string, docType: DocType): number => {
    if (appSettings.storageMode === 'local' && localStorageService) {
      return localStorageService.getUploadedFileCount(batchNumber, docType);
    }
    // OneDrive count logic would go here if needed
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
  oneDriveService: OneDriveService | null;
  localStorageService: LocalStorageService | null;
  oneDriveBasePath: string;
}

const FileUploadCell: React.FC<FileUploadCellProps> = ({
  record,
  docType,
  files,
  onFileAdd,
  appSettings,
  oneDriveService,
  localStorageService,
  oneDriveBasePath
}) => {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadedCount, setUploadedCount] = useState(0);

  // Load uploaded count on mount and when storage mode/service changes
  React.useEffect(() => {
    if (appSettings.storageMode === 'local' && localStorageService) {
      const batchNumber = record['Batch number'];
      if (batchNumber) {
        const count = localStorageService.getUploadedFileCount(batchNumber, docType);
        setUploadedCount(count);
      }
    }
  }, [appSettings.storageMode, localStorageService, record, docType]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      onFileAdd(record.id, docType, file);
      e.target.value = '';
      
      // Auto-upload
      setUploading(true);
      setStatus('idle');
      
      try {
        if (appSettings.storageMode === 'local') {
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
        } else {
          if (!oneDriveService || !oneDriveBasePath) {
            throw new Error('OneDrive not configured');
          }
          const path = `${oneDriveBasePath}/Batch_${record['Batch number']}/${folderMap[docType]}/${file.name}`;
          await oneDriveService.uploadFile(file, path);
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

  // For local storage, use uploadedCount; for OneDrive use files.length
  const fileCount = appSettings.storageMode === 'local' ? uploadedCount : files.length;
  const hasFiles = fileCount > 0;

  return (
    <td className="px-4 py-4 text-center">
      <div className="flex flex-col items-center gap-1">
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
  authState,
  oneDriveBasePath,
  oneDriveService,
  appSettings,
  localStorageService
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

  const handleToggleColumnVisibility = (columnId: DocColumnId) => {
    setColumnPrefs(prev => columnPreferences.toggleVisibility(prev, columnId));
  };

  const handleResetColumns = async () => {
    const defaults = await columnPreferences.resetToDefaults();
    setColumnPrefs(defaults);
  };

  const handleColumnReorder = (fromIndex: number, toIndex: number) => {
    // Simple reorder for the modal list display
    const newColumns = [...columnPrefs.docColumns];
    const [removed] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, removed);
    setColumnPrefs({ docColumns: newColumns });
  };

  return (
    <div className="overflow-x-auto">
      {/* Column Settings Button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setShowColumnSettings(true)}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition"
        >
          <Settings className="h-4 w-4" />
          <span>Customize Columns</span>
        </button>
      </div>

      {/* Column Settings Modal */}
      {showColumnSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
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

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Show/hide document columns
                </p>
                <div className="space-y-2">
                  {columnPrefs.docColumns.map((col, index) => (
                    <div
                      key={col.id}
                      className="flex items-center space-x-3 p-2 bg-gray-50 rounded hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() => handleToggleColumnVisibility(col.id)}
                        className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label className="flex-1 text-sm text-gray-700 cursor-pointer" onClick={() => handleToggleColumnVisibility(col.id)}>
                        {col.label}
                      </label>
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
            {displayHeaders.map(header => (
              <th 
                key={header} 
                scope="col" 
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
                <button className="flex items-center group w-full" onClick={() => requestSort(header)}>
                  <span className="mr-1">⋮⋮</span>
                  <span>{header}</span>
                  {getSortIcon(header)}
                </button>
              </th>
            ))}
            {columnPrefs.docColumns.find(c => c.id === 'PO')?.visible && (
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">PO</th>
            )}
            {columnPrefs.docColumns.find(c => c.id === 'SO')?.visible && (
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SO</th>
            )}
            {columnPrefs.docColumns.find(c => c.id === 'SupplierInvoice')?.visible && (
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier Invoice</th>
            )}
            {columnPrefs.docColumns.find(c => c.id === 'CustomerInvoice')?.visible && (
              <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Invoice</th>
            )}
            {columnPrefs.docColumns.find(c => c.id === 'Completion')?.visible && (
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion</th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((record) => (
            <React.Fragment key={record.id}>
              <tr className="hover:bg-gray-50">
                {displayHeaders.map(header => (
                  <td key={header} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {renderCellContent(record[header], header)}
                  </td>
                ))}
                {columnPrefs.docColumns.find(c => c.id === 'PO')?.visible && (
                  <FileUploadCell
                    record={record}
                    docType={DocType.PO}
                    files={managedFiles[record.id]?.[DocType.PO] || []}
                    onFileAdd={fileHandlers.add}
                    appSettings={appSettings}
                    oneDriveService={oneDriveService}
                    localStorageService={localStorageService}
                    oneDriveBasePath={oneDriveBasePath}
                  />
                )}
                {columnPrefs.docColumns.find(c => c.id === 'SO')?.visible && (
                  <FileUploadCell
                    record={record}
                    docType={DocType.SO}
                    files={managedFiles[record.id]?.[DocType.SO] || []}
                    onFileAdd={fileHandlers.add}
                    appSettings={appSettings}
                    oneDriveService={oneDriveService}
                    localStorageService={localStorageService}
                    oneDriveBasePath={oneDriveBasePath}
                  />
                )}
                {columnPrefs.docColumns.find(c => c.id === 'SupplierInvoice')?.visible && (
                  <FileUploadCell
                    record={record}
                    docType={DocType.SupplierInvoice}
                    files={managedFiles[record.id]?.[DocType.SupplierInvoice] || []}
                    onFileAdd={fileHandlers.add}
                    appSettings={appSettings}
                    oneDriveService={oneDriveService}
                    localStorageService={localStorageService}
                    oneDriveBasePath={oneDriveBasePath}
                  />
                )}
                {columnPrefs.docColumns.find(c => c.id === 'CustomerInvoice')?.visible && (
                  <FileUploadCell
                    record={record}
                    docType={DocType.CustomerInvoice}
                    files={managedFiles[record.id]?.[DocType.CustomerInvoice] || []}
                    onFileAdd={fileHandlers.add}
                    appSettings={appSettings}
                    oneDriveService={oneDriveService}
                    localStorageService={localStorageService}
                    oneDriveBasePath={oneDriveBasePath}
                  />
                )}
                {columnPrefs.docColumns.find(c => c.id === 'Completion')?.visible && (
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <BatchProgressBar
                      record={record}
                      appSettings={appSettings}
                      oneDriveService={oneDriveService}
                      localStorageService={localStorageService}
                    />
                  </td>
                )}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      
      {/* Mobile Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:hidden">
        {data.map((record) => (
          <div key={record.id} className="bg-white rounded-lg shadow p-4 space-y-3 border border-gray-200">
            {displayHeaders.map(header => (
              <div key={header}>
                <p className="text-xs font-bold text-gray-500 uppercase">{header}</p>
                <p className="text-sm text-gray-800">{renderCellContent(record[header], header) || 'N/A'}</p>
              </div>
            ))}
             <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Attachments</p>
                <DocStatusIcons files={managedFiles[record.id] || emptyFiles} />
            </div>
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Completion Status</p>
                <BatchProgressBar
                  record={record}
                  appSettings={appSettings}
                  oneDriveService={oneDriveService}
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
                        authState={authState}
                        oneDriveBasePath={oneDriveBasePath}
                        oneDriveService={oneDriveService}
                        appSettings={appSettings}
                        localStorageService={localStorageService}
                    />
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};