import React, { useState } from 'react';
import { X, RotateCw, Trash2, FolderOpen, Eye } from 'lucide-react';
import type { ScanProgress, ScanResult, DuplicateGroup } from '../services/localStorageService';

interface ScanModalProps {
  isOpen: boolean;
  isScanning: boolean;
  scanProgress: ScanProgress | null;
  scanResult: ScanResult | null;
  onClose: () => void;
  onDeleteFiles: (files: Array<{ batchNumber: string; docType: string; fileName: string }>) => Promise<void>;
  onOpenFolder: (batchNumber: string, docType: string) => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  isScanning,
  scanProgress,
  scanResult,
  onClose,
  onDeleteFiles,
  onOpenFolder,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  const toggleGroup = (groupIdx: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupIdx)) {
        newSet.delete(groupIdx);
      } else {
        newSet.add(groupIdx);
      }
      return newSet;
    });
  };

  const selectAllInGroup = (group: DuplicateGroup, groupIdx: number) => {
    // Safety check: ensure group and files array exist
    if (!group || !group.files || !Array.isArray(group.files) || group.files.length === 0) {
      console.warn('⚠️ Invalid group data, cannot select files');
      return;
    }

    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      // Keep the newest file, select others for deletion
      const sortedFiles = [...group.files].sort((a, b) => {
        // Safety check: ensure lastModified exists
        if (!a.lastModified || !b.lastModified) {
          console.warn('⚠️ File missing lastModified date');
          return 0;
        }
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      });
      
      // Skip the first (newest) file
      sortedFiles.slice(1).forEach(file => {
        newSet.add(`${file.batchNumber}/${file.docType}/${file.fileName}`);
      });
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''}?\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const filesToDelete = Array.from(selectedFiles).map((path: string) => {
        const [batchNumber, docType, fileName] = path.split('/');
        return { batchNumber, docType, fileName };
      });

      await onDeleteFiles(filesToDelete);
      setSelectedFiles(new Set());
      alert(`Successfully deleted ${filesToDelete.length} file${filesToDelete.length > 1 ? 's' : ''}!`);
    } catch (error) {
      alert(`Error deleting files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileKey = (file: { batchNumber: string; docType: string; fileName: string }) => {
    return `${file.batchNumber}/${file.docType}/${file.fileName}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {isScanning ? '🔍 Scanning Folder...' : '📊 Scan Complete'}
              </h2>
              {!isScanning && scanResult && (
                <p className="text-sm text-gray-600 mt-1">
                  Review your upload history and manage duplicates
                </p>
              )}
            </div>
            {!isScanning && (
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-200 transition"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Progress Indicator */}
          {isScanning && scanProgress && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <RotateCw className="h-12 w-12 text-blue-600 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-lg font-semibold text-gray-900">{scanProgress.message}</p>
                  {scanProgress.currentFolder && (
                    <p className="text-sm text-gray-600 mt-1 truncate">📁 {scanProgress.currentFolder}</p>
                  )}
                </div>
              </div>
              
              {scanProgress.totalFolders && (
                <div className="space-y-3">
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 h-full transition-all duration-500 ease-out relative overflow-hidden"
                      style={{ width: `${Math.min((scanProgress.scannedCount / scanProgress.totalFolders) * 100, 100)}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" />
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-700">
                      {scanProgress.scannedCount} / {scanProgress.totalFolders} folders scanned
                    </p>
                    <p className="text-sm font-bold text-blue-600">
                      {Math.round((scanProgress.scannedCount / scanProgress.totalFolders) * 100)}%
                    </p>
                  </div>
                  
                  {/* Info Cards */}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-xs text-blue-700 font-medium">Files Found</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">
                        {scanProgress.scannedCount || 0}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-xs text-green-700 font-medium">Progress</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        {Math.round((scanProgress.scannedCount / scanProgress.totalFolders) * 100)}%
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                      <p className="text-xs text-purple-700 font-medium">Status</p>
                      <p className="text-lg font-bold text-purple-600 mt-2">
                        {scanProgress.status === 'detecting-duplicates' ? '🔍 Analyzing' : '📊 Scanning'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-500 italic text-center mt-4">
                ⏳ This may take a few minutes depending on your folder size...
              </p>
            </div>
          )}

          {/* Results */}
          {!isScanning && scanResult && (
            <div className="space-y-6">
              {scanResult.success ? (
                <>
                  {/* Success Banner */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-lg shadow-sm">
                    <div className="flex items-start">
                      <svg className="h-8 w-8 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="ml-4 flex-1">
                        <h3 className="text-xl font-bold text-green-900 mb-2">
                          🎉 Scan Completed Successfully!
                        </h3>
                        <p className="text-sm text-green-700">
                          Your upload history has been rebuilt from the local folder structure.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Statistics Grid */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-blue-700 mb-1">Files Found</p>
                          <p className="text-4xl font-bold text-blue-600">{scanResult.filesFound}</p>
                        </div>
                        <svg className="h-12 w-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-green-700 mb-1">New Entries</p>
                          <p className="text-4xl font-bold text-green-600">{scanResult.newEntriesAdded}</p>
                        </div>
                        <svg className="h-12 w-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-purple-700 mb-1">Preserved</p>
                          <p className="text-4xl font-bold text-purple-600">{scanResult.existingEntriesPreserved}</p>
                        </div>
                        <svg className="h-12 w-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                    </div>
                    
                    {scanResult.backupCreated && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-yellow-700 mb-1">Backup</p>
                            <p className="text-2xl font-bold text-yellow-600">✓ Created</p>
                          </div>
                          <svg className="h-12 w-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Duplicates Section */}
                  {scanResult.duplicateGroups && scanResult.duplicateGroups.length > 0 && (
                    <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start">
                          <svg className="h-8 w-8 text-orange-500 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                          <div className="ml-4">
                            <h3 className="text-lg font-bold text-orange-900">
                              🔍 {scanResult.totalDuplicates} Duplicate Files Detected
                            </h3>
                            <p className="text-sm text-orange-700 mt-1">
                              Found {scanResult.duplicateGroups.length} group{scanResult.duplicateGroups.length !== 1 ? 's' : ''} of duplicate files. Select files to delete or keep the newest version.
                            </p>
                          </div>
                        </div>
                        {selectedFiles.size > 0 && (
                          <button
                            onClick={handleDeleteSelected}
                            disabled={isDeleting}
                            className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span>{isDeleting ? 'Deleting...' : `Delete ${selectedFiles.size} Selected`}</span>
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {scanResult.duplicateGroups.map((group, groupIdx) => (
                          <div key={groupIdx} className="bg-white rounded-lg border-2 border-orange-200 overflow-hidden">
                            {/* Group Header */}
                            <div
                              className="bg-orange-100 p-4 cursor-pointer hover:bg-orange-150 transition flex items-center justify-between"
                              onClick={() => toggleGroup(groupIdx)}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="text-2xl">
                                  {group.reason === 'identical-hash' && '🔒'}
                                  {group.reason === 'identical-size-name' && '📄'}
                                  {group.reason === 'similar-name' && '📝'}
                                </div>
                                <div>
                                  <p className="font-semibold text-orange-900">
                                    {group.reason === 'identical-hash' && 'Identical Files (100% match)'}
                                    {group.reason === 'identical-size-name' && 'Same Name & Size (90% match)'}
                                    {group.reason === 'similar-name' && 'Similar Names (70% match)'}
                                  </p>
                                  <p className="text-sm text-orange-700">
                                    {group.files.length} duplicate files • Click to expand
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectAllInGroup(group, groupIdx);
                                }}
                                className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 transition"
                              >
                                Select Oldest
                              </button>
                            </div>
                            
                            {/* Group Files */}
                            {expandedGroups.has(groupIdx) && (
                              <div className="p-4 space-y-2 bg-gray-50">
                                {group.files
                                  .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
                                  .map((file, fileIdx) => {
                                    const fileKey = getFileKey(file);
                                    const isSelected = selectedFiles.has(fileKey);
                                    const isNewest = fileIdx === 0;
                                    
                                    return (
                                      <div
                                        key={fileIdx}
                                        className={`p-3 rounded-lg border-2 transition ${
                                          isSelected
                                            ? 'bg-red-50 border-red-300'
                                            : isNewest
                                            ? 'bg-green-50 border-green-300'
                                            : 'bg-white border-gray-200'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex items-start space-x-3 flex-1">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleFileSelection(fileKey)}
                                              className="mt-1 h-5 w-5 text-red-600 rounded focus:ring-red-500"
                                            />
                                            <div className="flex-1">
                                              <div className="flex items-center space-x-2">
                                                <p className="font-mono text-sm font-semibold text-gray-900">
                                                  {file.fileName}
                                                </p>
                                                {isNewest && (
                                                  <span className="px-2 py-0.5 text-xs font-bold bg-green-600 text-white rounded-full">
                                                    NEWEST
                                                  </span>
                                                )}
                                              </div>
                                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                                <div>📁 <span className="font-semibold">Batch:</span> {file.batchNumber}</div>
                                                <div>📋 <span className="font-semibold">Type:</span> {file.docType}</div>
                                                <div>💾 <span className="font-semibold">Size:</span> {(file.fileSize / 1024).toFixed(1)} KB</div>
                                                <div>🕐 <span className="font-semibold">Modified:</span> {new Date(file.lastModified).toLocaleString()}</div>
                                              </div>
                                              <div className="mt-1">
                                                <p className="text-xs text-gray-500 font-mono truncate">
                                                  🔒 Hash: {file.contentHash.substring(0, 16)}...
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => onOpenFolder(file.batchNumber, file.docType)}
                                            className="ml-2 p-2 text-blue-600 hover:bg-blue-100 rounded transition"
                                            title="Open folder"
                                          >
                                            <FolderOpen className="h-5 w-5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Orphaned Files */}
                  {scanResult.orphanedFiles.length > 0 && (
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                      <div className="flex items-start">
                        <svg className="h-6 w-6 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="ml-3 flex-1">
                          <h4 className="text-sm font-medium text-yellow-800">
                            ⚠️ {scanResult.orphanedFiles.length} Orphaned File{scanResult.orphanedFiles.length !== 1 ? 's' : ''}
                          </h4>
                          <p className="text-xs text-yellow-700 mt-1">
                            These files are in folders that don't match any batch numbers from Airtable
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
                </>
              ) : (
                <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg">
                  <div className="flex items-start">
                    <svg className="h-8 w-8 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="ml-4 flex-1">
                      <h4 className="text-lg font-medium text-red-800">Scan Failed</h4>
                      <div className="mt-2 text-sm text-red-700">
                        {scanResult.errors.map((error, idx) => (
                          <p key={idx} className="mt-1">• {error}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isScanning && (
          <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
