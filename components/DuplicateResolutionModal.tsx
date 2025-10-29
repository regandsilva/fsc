import React, { useState } from 'react';
import { AlertTriangle, FileWarning, Check, X, Copy, Replace } from 'lucide-react';
import { DuplicateFile } from '../utils/duplicateHandler';
import { getDocTypeLabel } from '../utils/aiFileAnalyzer';

interface DuplicateResolutionModalProps {
  isOpen: boolean;
  duplicates: DuplicateFile[];
  onResolve: (resolved: DuplicateFile[]) => void;
  onCancel: () => void;
}

export const DuplicateResolutionModal: React.FC<DuplicateResolutionModalProps> = ({
  isOpen,
  duplicates,
  onResolve,
  onCancel,
}) => {
  const [resolutions, setResolutions] = useState<Map<number, 'skip' | 'replace' | 'version'>>(
    new Map(duplicates.map((_, idx) => [idx, 'skip']))
  );

  if (!isOpen || duplicates.length === 0) return null;

  const handleActionChange = (index: number, action: 'skip' | 'replace' | 'version') => {
    setResolutions(prev => new Map(prev).set(index, action));
  };

  const handleApplyToAll = (action: 'skip' | 'replace' | 'version') => {
    const newResolutions = new Map<number, 'skip' | 'replace' | 'version'>();
    duplicates.forEach((_, idx) => newResolutions.set(idx, action));
    setResolutions(newResolutions);
  };

  const handleConfirm = () => {
    const resolved = duplicates.map((dup, idx) => ({
      ...dup,
      action: resolutions.get(idx) || 'skip',
    }));
    onResolve(resolved);
  };

  const getCounts = () => {
    let skip = 0, replace = 0, version = 0;
    resolutions.forEach(action => {
      if (action === 'skip') skip++;
      else if (action === 'replace') replace++;
      else if (action === 'version') version++;
    });
    return { skip, replace, version };
  };

  const counts = getCounts();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-orange-50 border-b border-orange-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <FileWarning className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Duplicate Files Detected
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {duplicates.length} file{duplicates.length > 1 ? 's' : ''} already exist{duplicates.length === 1 ? 's' : ''}. Choose how to handle each one.
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Apply to all files:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleApplyToAll('skip')}
                className="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition flex items-center space-x-1"
              >
                <X className="h-3 w-3" />
                <span>Skip All</span>
              </button>
              <button
                onClick={() => handleApplyToAll('replace')}
                className="px-3 py-1.5 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition flex items-center space-x-1"
              >
                <Replace className="h-3 w-3" />
                <span>Replace All</span>
              </button>
              <button
                onClick={() => handleApplyToAll('version')}
                className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition flex items-center space-x-1"
              >
                <Copy className="h-3 w-3" />
                <span>Version All</span>
              </button>
            </div>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {duplicates.map((duplicate, index) => {
              const action = resolutions.get(index) || 'skip';
              
              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="font-medium text-gray-900">{duplicate.file.name}</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          Batch: <span className="font-medium">{duplicate.batchNumber}</span>
                        </div>
                        <div>
                          Type: <span className="font-medium">{getDocTypeLabel(duplicate.docType)}</span>
                        </div>
                        <div>
                          Size: <span className="font-medium">{(duplicate.file.size / 1024).toFixed(1)} KB</span>
                        </div>
                        {duplicate.matchReason && (
                          <div className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {duplicate.matchReason}
                          </div>
                        )}
                        {duplicate.visualSimilarity && duplicate.visualSimilarity.similarity > 0 && (
                          <div className="mt-2 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                            👁️ Visual similarity: {duplicate.visualSimilarity.similarity}% 
                            <span className="ml-1">({duplicate.visualSimilarity.matchType.replace(/-/g, ' ')})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleActionChange(index, 'skip')}
                        className={`px-4 py-2 rounded text-sm font-medium transition flex items-center space-x-2 ${
                          action === 'skip'
                            ? 'bg-gray-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <X className="h-4 w-4" />
                        <span>Skip</span>
                      </button>
                      <button
                        onClick={() => handleActionChange(index, 'replace')}
                        className={`px-4 py-2 rounded text-sm font-medium transition flex items-center space-x-2 ${
                          action === 'replace'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        <Replace className="h-4 w-4" />
                        <span>Replace</span>
                      </button>
                      <button
                        onClick={() => handleActionChange(index, 'version')}
                        className={`px-4 py-2 rounded text-sm font-medium transition flex items-center space-x-2 ${
                          action === 'version'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <Copy className="h-4 w-4" />
                        <span>Keep Both</span>
                      </button>
                    </div>
                  </div>

                  {/* Action Description */}
                  <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                    {action === 'skip' && (
                      <p className="text-gray-600">
                        <span className="font-medium">Skip:</span> This file will not be uploaded. The existing file will remain unchanged.
                      </p>
                    )}
                    {action === 'replace' && (
                      <p className="text-red-700">
                        <span className="font-medium">Replace:</span> The existing file will be overwritten with this new version. This cannot be undone.
                      </p>
                    )}
                    {action === 'version' && (
                      <p className="text-blue-700">
                        <span className="font-medium">Keep Both:</span> This file will be uploaded as "{duplicate.file.name.replace(/(\.[^.]+)$/, '_v2$1')}" so both versions are kept.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Summary:</span>{' '}
              {counts.skip} skip, {counts.replace} replace, {counts.version} version
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>Confirm & Continue</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
