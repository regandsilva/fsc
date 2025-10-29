import React, { useEffect, useState } from 'react';

interface FolderViewModalProps {
  isOpen: boolean;
  batchNumber: string;
  docType: string;
  files: Array<{ name: string; size: number; lastModified: Date }>;
  folderPath?: string; // Optional full folder path for trying to open in explorer
  onClose: () => void;
  onDownloadFile?: (fileName: string) => void;
}

export const FolderViewModal: React.FC<FolderViewModalProps> = ({
  isOpen,
  batchNumber,
  docType,
  files,
  folderPath,
  onClose,
  onDownloadFile,
}) => {
  if (!isOpen) return null;

  const handleOpenInExplorer = () => {
    if (folderPath) {
      // Note: Modern browsers block file:// protocol for security reasons
      // Show alert with copyable path instead
      alert(
        'Cannot open folder directly in browser due to security restrictions.\n\n' +
        'Folder path:\n' + folderPath + '\n\n' +
        'Please copy this path and open it manually in File Explorer.'
      );
    } else {
      alert('Folder path not available. This feature requires the local storage path to be configured.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📂 Folder Contents</h2>
            <p className="text-sm text-gray-600 mt-1">
              {batchNumber} / {docType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-6">
          {files.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-500">This folder is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b">
                <div className="col-span-6">File Name</div>
                <div className="col-span-3">Size</div>
                <div className="col-span-3">Modified</div>
              </div>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className="col-span-6 flex items-center space-x-2">
                    {/* File Icon */}
                    <svg
                      className="h-5 w-5 text-blue-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-sm text-gray-900 truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center text-sm text-gray-600">
                    {formatFileSize(file.size)}
                  </div>
                  <div className="col-span-3 flex items-center justify-between text-sm text-gray-600">
                    <span>{formatDate(file.lastModified)}</span>
                    {onDownloadFile && (
                      <button
                        onClick={() => onDownloadFile(file.name)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-blue-600 hover:text-blue-800"
                        title="Download file"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {files.length} {files.length === 1 ? 'file' : 'files'} in this folder
          </div>
          <div className="flex items-center space-x-3">
            {folderPath && (
              <button
                onClick={handleOpenInExplorer}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                title="Try to open folder in File Explorer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <span>Open in Explorer</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
