import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileCheck, AlertTriangle, CheckCircle, X, Sparkles, Ban, FileWarning } from 'lucide-react';
import { FscRecord, DocType, ManagedFile, AppSettings } from '../types';
import { createBulkUploadPlan, FileAnalysis, getDocTypeLabel } from '../utils/aiFileAnalyzer';
import { LocalStorageService } from '../services/localStorageService';


interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: FscRecord[];
  onBulkUpload: (uploads: Map<string, Map<DocType, File[]>>) => Promise<void>;
  appSettings: AppSettings;
  localStorageService: LocalStorageService | null;

}

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({
  isOpen,
  onClose,
  records,
  onBulkUpload,
  appSettings,
  localStorageService,

}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadPlan, setUploadPlan] = useState<ReturnType<typeof createBulkUploadPlan> | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<'select' | 'review' | 'uploading' | 'complete'>('select');
  const [editedAnalyses, setEditedAnalyses] = useState<Map<string, { batch: string; docType: DocType; skipUpload?: boolean }>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for duplicates after analysis
  useEffect(() => {
    if (!isOpen || !uploadPlan || !localStorageService) return;
    
    // Check if we've already checked duplicates for this plan
    const hasCheckedDuplicates = uploadPlan.analyses.some(a => a.isDuplicate === true);
    if (hasCheckedDuplicates) return;
    
    // Check each analysis for duplicates
    let hasAnyDuplicates = false;
    const updatedAnalyses = uploadPlan.analyses.map(analysis => {
      if (analysis.matchedBatch && analysis.matchedDocType) {
        const isDuplicate = localStorageService.isFileUploaded(
          analysis.matchedBatch,
          analysis.matchedDocType,
          analysis.file.name
        );
        
        if (isDuplicate) {
          hasAnyDuplicates = true;
          return {
            ...analysis,
            isDuplicate: true,
            duplicateWarning: `⚠️ File "${analysis.file.name}" already exists. Upload will create a version (${analysis.file.name.replace(/(\.[^.]+)$/, '_v2$1')}).`
          };
        }
      }
      return analysis;
    });
    
    // Only update if we found duplicates
    if (hasAnyDuplicates) {
      setUploadPlan({
        ...uploadPlan,
        analyses: updatedAnalyses
      });
    }
  }, [isOpen, uploadPlan, localStorageService]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const plan = createBulkUploadPlan(selectedFiles, records);
    setUploadPlan(plan);
    setCurrentStep('review');
    setIsAnalyzing(false);
  };

  const handleEditAssignment = (fileName: string, batch: string, docType: DocType) => {
    setEditedAnalyses(prev => {
      const existing = prev.get(fileName);
      return new Map(prev).set(fileName, { batch, docType, skipUpload: existing?.skipUpload });
    });
  };

  const handleToggleSkipUpload = (fileName: string) => {
    setEditedAnalyses(prev => {
      const existing = prev.get(fileName);
      const analysis = uploadPlan?.analyses.find(a => a.file.name === fileName);
      return new Map(prev).set(fileName, {
        batch: existing?.batch || analysis?.matchedBatch || '',
        docType: existing?.docType || analysis?.matchedDocType || DocType.PO,
        skipUpload: !(existing?.skipUpload || false)
      });
    });
  };

  const handleConfirmUpload = async () => {
    if (!uploadPlan) return;

    setCurrentStep('uploading');
    setIsUploading(true);

    // Apply manual edits to the upload plan
    const finalPlan = new Map<string, Map<DocType, File[]>>(uploadPlan.groupedByBatch);
    
    // Apply edited assignments and filter out skipped files
    for (const [fileName, assignment] of editedAnalyses) {
      const file = selectedFiles.find(f => f.name === fileName);
      if (!file) continue;

      // If marked to skip, remove from all locations and continue
      if (assignment.skipUpload) {
        for (const [batch, docTypes] of finalPlan) {
          for (const [docType, files] of docTypes.entries()) {
            const index = files.findIndex(f => f.name === fileName);
            if (index !== -1) {
              files.splice(index, 1);
            }
          }
        }
        continue;
      }

      // Remove from original location
      for (const [batch, docTypes] of finalPlan) {
        for (const [docType, files] of docTypes.entries()) {
          const index = files.findIndex(f => f.name === fileName);
          if (index !== -1) {
            files.splice(index, 1);
          }
        }
      }

      // Add to new location
      if (!finalPlan.has(assignment.batch)) {
        finalPlan.set(assignment.batch, new Map<DocType, File[]>());
      }
      const batchMap = finalPlan.get(assignment.batch)!;
      if (!batchMap.has(assignment.docType)) {
        batchMap.set(assignment.docType, []);
      }
      batchMap.get(assignment.docType)!.push(file);
    }

    try {
      await onBulkUpload(finalPlan);
      setUploadProgress(100);
      setCurrentStep('complete');
    } catch (error) {
      console.error('Bulk upload error:', error);
      alert('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setCurrentStep('review');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setUploadPlan(null);
    setCurrentStep('select');
    setEditedAnalyses(new Map());
    setUploadProgress(0);
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High';
    if (confidence >= 60) return 'Medium';
    return 'Low';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI-Powered Bulk Upload</h2>
              <p className="text-sm text-gray-600">Automatically distribute files to batches</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={isUploading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: File Selection */}
          {currentStep === 'select' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mb-4">
                  <Upload className="h-16 w-16 text-blue-500 mx-auto" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Select Files to Upload
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Choose multiple files. Our AI will analyze filenames and suggest batch assignments.
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center space-x-2"
                >
                  <Upload className="h-5 w-5" />
                  <span>Choose Files</span>
                </button>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Selected Files ({selectedFiles.length})
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <ul className="space-y-2">
                      {selectedFiles.map((file, idx) => (
                        <li key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700 truncate">{file.name}</span>
                          <span className="text-gray-500 text-xs ml-2">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition inline-flex items-center space-x-2 disabled:opacity-50"
                    >
                      {isAnalyzing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5" />
                          <span>Analyze with AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review & Confirm */}
          {currentStep === 'review' && uploadPlan && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <FileCheck className="h-5 w-5 mr-2" />
                  AI Analysis Complete
                </h3>
                <p className="text-sm text-blue-800">
                  {uploadPlan.groupedByBatch.size} batch(es) identified, {' '}
                  {selectedFiles.length - uploadPlan.unmatchedFiles.length} file(s) matched, {' '}
                  {uploadPlan.unmatchedFiles.length} unmatched
                </p>
              </div>

              {/* Warnings */}
              {uploadPlan.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2" />
                    Warnings
                  </h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {uploadPlan.warnings.map((warning, idx) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Matched Files */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Matched Files ({selectedFiles.length - uploadPlan.unmatchedFiles.length})
                </h4>
                <div className="space-y-4">
                  {uploadPlan.analyses
                    .filter(a => a.matchedBatch && a.matchedDocType && a.confidence >= 60)
                    .map((analysis, idx) => {
                      const edited = editedAnalyses.get(analysis.file.name);
                      const displayBatch = edited?.batch || analysis.matchedBatch!;
                      const displayDocType = edited?.docType || analysis.matchedDocType!;
                      const isSkipped = edited?.skipUpload || false;
                      
                      return (
                        <div key={idx} className={`bg-white border rounded-lg p-4 ${isSkipped ? 'border-gray-300 opacity-60' : analysis.isDuplicate ? 'border-orange-300 bg-orange-50' : 'border-gray-200'}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <p className={`font-medium ${isSkipped ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                  {analysis.file.name}
                                </p>
                                {isSkipped && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                                    <Ban className="h-3 w-3 inline mr-1" />
                                    Will Not Upload
                                  </span>
                                )}
                                {analysis.isDuplicate && !isSkipped && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-orange-200 text-orange-800 rounded">
                                    <FileWarning className="h-3 w-3 inline mr-1" />
                                    Duplicate
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{analysis.reason}</p>
                              {analysis.isDuplicate && analysis.duplicateWarning && !isSkipped && (
                                <p className="text-xs text-orange-700 mt-2 bg-orange-100 p-2 rounded">
                                  {analysis.duplicateWarning}
                                </p>
                              )}
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getConfidenceColor(analysis.confidence)}`}>
                              {getConfidenceLabel(analysis.confidence)} ({analysis.confidence}%)
                            </span>
                          </div>
                          
                          {/* Skip Upload Toggle */}
                          <div className="flex items-center space-x-2 mt-3 mb-3">
                            <button
                              onClick={() => handleToggleSkipUpload(analysis.file.name)}
                              className={`flex items-center space-x-2 px-3 py-2 rounded text-sm font-medium transition ${
                                isSkipped
                                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <Ban className="h-4 w-4" />
                              <span>{isSkipped ? 'Marked: Don\'t Upload' : 'Mark as Don\'t Upload'}</span>
                            </button>
                            {isSkipped && (
                              <p className="text-xs text-gray-500 italic">This file will be excluded from upload</p>
                            )}
                          </div>
                          
                          {!isSkipped && (
                            <div className="flex items-center space-x-4">
                              <div className="flex-1">
                                <label className="text-xs text-gray-600 block mb-1">Batch</label>
                                <select
                                  value={displayBatch}
                                  onChange={(e) => handleEditAssignment(analysis.file.name, e.target.value, displayDocType)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                >
                                  {records.map(r => (
                                    <option key={r.id} value={r['Batch number']}>
                                      {r['Batch number']}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              
                              <div className="flex-1">
                                <label className="text-xs text-gray-600 block mb-1">Document Type</label>
                                <select
                                  value={displayDocType}
                                  onChange={(e) => handleEditAssignment(analysis.file.name, displayBatch, e.target.value as DocType)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                >
                                  <option value={DocType.PO}>Purchase Order</option>
                                  <option value={DocType.SO}>Sales Order</option>
                                  <option value={DocType.SupplierInvoice}>Supplier Invoice</option>
                                  <option value={DocType.CustomerInvoice}>Customer Invoice</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Unmatched Files */}
              {uploadPlan.unmatchedFiles.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Unmatched Files ({uploadPlan.unmatchedFiles.length})
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">
                      These files could not be matched automatically. Please assign manually or skip.
                    </p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {uploadPlan.unmatchedFiles.map((file, idx) => (
                        <li key={idx}>• {file.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <button
                  onClick={() => setCurrentStep('select')}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmUpload}
                  disabled={uploadPlan.groupedByBatch.size === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center space-x-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>Confirm & Upload ({selectedFiles.length - uploadPlan.unmatchedFiles.length} files)</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Uploading */}
          {currentStep === 'uploading' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Uploading Files...
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Please wait while we upload your files
              </p>
              <div className="max-w-md mx-auto">
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center py-12">
              <div className="mb-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload Complete!
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                All files have been successfully uploaded and distributed to their batches.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
