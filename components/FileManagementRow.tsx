import React, { useState } from 'react';
import { FscRecord, ManagedFile, DocType, AuthState, AppSettings } from '../types';
import { UploadCloud, FileText as FileIcon, Download, RotateCw, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { createZip } from '../services/zipService';
import { OneDriveService } from '../services/oneDriveService';
import { LocalStorageService } from '../services/localStorageService';

interface FileManagementRowProps {
  record: FscRecord;
  managedFiles: Record<DocType, ManagedFile[]>;
  fileHandlers: {
    add: (recordId: string, docType: DocType, file: File) => void;
    remove: (recordId: string, docType: DocType, fileId: number) => void;
    toggleComplete: (recordId: string, docType: DocType, fileId: number) => void;
    rename: (recordId: string, docType: DocType, fileId: number, newName: string) => void;
  };
  colSpan: number;
  isMobile?: boolean;
  authState: AuthState;
  oneDriveBasePath: string;
  oneDriveService: OneDriveService | null;
  appSettings: AppSettings;
  localStorageService: LocalStorageService | null;
}

const docTypes = [DocType.PO, DocType.SO, DocType.SupplierInvoice, DocType.CustomerInvoice];
const folderMap: Record<DocType, string> = {
    [DocType.PO]: '1_PurchaseOrders',
    [DocType.SO]: '2_SalesOrders',
    [DocType.SupplierInvoice]: '3_SupplierInvoices',
    [DocType.CustomerInvoice]: '4_CustomerInvoices',
};

type UploadStatus = {
    state: 'idle' | 'uploading' | 'success' | 'error';
    message: string;
};


export const FileManagementRow: React.FC<FileManagementRowProps> = ({ 
    record, 
    managedFiles, 
    fileHandlers, 
    colSpan, 
    isMobile,
    authState,
    oneDriveBasePath,
    oneDriveService,
    appSettings,
    localStorageService
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ state: 'idle', message: '' });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, docType: DocType) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      fileHandlers.add(record.id, docType, file);
      e.target.value = ''; // Reset input
      
      // Auto-upload immediately after adding file
      await handleUploadSingleFile(file, docType);
    }
  };

  const handleUploadSingleFile = async (file: File, docType: DocType) => {
    // Check storage mode
    if (appSettings.storageMode === 'local') {
      return handleUploadSingleFileLocal(file, docType);
    } else {
      return handleUploadSingleFileOneDrive(file, docType);
    }
  };

  const handleUploadSingleFileOneDrive = async (file: File, docType: DocType) => {
    if (!oneDriveService || !oneDriveBasePath) {
      setUploadStatus({ state: 'error', message: 'OneDrive service is not configured.' });
      return;
    }

    const path = `${oneDriveBasePath}/Batch_${record['Batch number']}/${folderMap[docType]}/${file.name}`;
    
    setUploadStatus({ state: 'uploading', message: `Uploading ${file.name}...` });
    
    try {
      await oneDriveService.uploadFile(file, path);
      setUploadStatus({ state: 'success', message: `Uploaded ${file.name}` });
      setTimeout(() => setUploadStatus({ state: 'idle', message: '' }), 3000);
    } catch (error) {
      setUploadStatus({ state: 'error', message: `Failed to upload ${file.name}: ${(error as Error).message}` });
    }
  };

  const handleUploadSingleFileLocal = async (file: File, docType: DocType) => {
    if (!localStorageService || !appSettings.localStoragePath) {
      setUploadStatus({ state: 'error', message: 'Local storage is not configured. Please select a folder in settings.' });
      return;
    }

    setUploadStatus({ state: 'uploading', message: `Saving ${file.name}...` });
    
    try {
      await localStorageService.uploadFile(record, file, docType, appSettings.localStoragePath);
      setUploadStatus({ state: 'success', message: `Saved ${file.name}` });
      setTimeout(() => setUploadStatus({ state: 'idle', message: '' }), 3000);
    } catch (error) {
      setUploadStatus({ state: 'error', message: `Failed to save ${file.name}: ${(error as Error).message}` });
    }
  };
  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      await createZip(managedFiles, record);
    } catch (error) {
      alert(`Failed to create zip file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsZipping(false);
    }
  };

  const hasFiles = Object.values(managedFiles).some(fileList => (fileList as ManagedFile[]).length > 0);

  const content = (
    <div className="p-6 bg-blue-50/50 space-y-6">
      <p className="text-sm text-gray-600">
        Upload documents for Batch <span className="font-bold">{record['Batch number']}</span>. Files upload automatically when added.
      </p>
      <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-6`}>
        {docTypes.map(docType => (
          <div key={docType} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white shadow-sm">
            <h3 className="font-bold text-lg text-gray-800">{docType}</h3>
            {managedFiles[docType]?.map((managedFile) => (
              <div key={managedFile.id} className="bg-gray-50 p-3 rounded-md border space-y-2">
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={managedFile.completed}
                    onChange={() => fileHandlers.toggleComplete(record.id, docType, managedFile.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`Mark ${managedFile.suggestedName} as complete`}
                  />
                  <div className="flex-grow">
                     <div className="flex items-center space-x-2 text-sm bg-white border p-2 rounded">
                        <FileIcon className="h-5 w-5 text-gray-500 shrink-0"/>
                        <input
                          type="text"
                          value={managedFile.suggestedName}
                          onChange={(e) => fileHandlers.rename(record.id, docType, managedFile.id, e.target.value)}
                          className="w-full bg-transparent outline-none text-gray-800"
                        />
                    </div>
                  </div>
                  <button onClick={() => fileHandlers.remove(record.id, docType, managedFile.id)} className="p-1 text-gray-400 hover:text-red-500 transition">
                    <Trash2 className="h-4 w-4"/>
                  </button>
                </div>
              </div>
            ))}

            <label htmlFor={`${docType}-${record.id}`} className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition">
              <UploadCloud className="h-8 w-8 text-gray-400" />
              <span className="mt-2 text-sm font-semibold text-gray-700">Add a file</span>
              <input id={`${docType}-${record.id}`} type="file" className="hidden" onChange={(e) => handleFileChange(e, docType)} accept=".pdf,.xlsx,.xls,.doc,.docx" />
            </label>
          </div>
        ))}
      </div>
      <div className="pt-4 border-t space-y-3">
        {/* Upload status message */}
        {uploadStatus.state !== 'idle' && (
            <div className={`flex items-center space-x-2 text-sm p-2 rounded-md ${
                uploadStatus.state === 'success' ? 'bg-green-100 text-green-800' :
                uploadStatus.state === 'error' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
            }`}>
                {uploadStatus.state === 'success' && <CheckCircle className="h-5 w-5" />}
                {uploadStatus.state === 'error' && <AlertTriangle className="h-5 w-5" />}
                {uploadStatus.state === 'uploading' && <RotateCw className="h-5 w-5 animate-spin"/>}
                <span>{uploadStatus.message}</span>
            </div>
        )}
        
        <button
          onClick={handleDownloadZip}
          disabled={!hasFiles || isZipping}
          className="w-full flex items-center justify-center space-x-2 bg-gray-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition"
        >
          {isZipping ? <RotateCw className="h-5 w-5 animate-spin"/> : <Download className="h-5 w-5" />}
          <span>{isZipping ? 'Creating Package...' : 'Download as ZIP'}</span>
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return content;
  }

  return (
    <tr>
      <td colSpan={colSpan}>
        {content}
      </td>
    </tr>
  );
};