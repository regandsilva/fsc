import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileCheck, AlertTriangle, CheckCircle, X, Sparkles, Ban, FileWarning } from 'lucide-react';
import { FscRecord, DocType, ManagedFile, AppSettings } from '../types';
import { createBulkUploadPlan, FileAnalysis, getDocTypeLabel } from '../utils/aiFileAnalyzer';
import { LocalStorageService } from '../services/localStorageService';
import { SearchableDropdown } from './SearchableDropdown';


interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: FscRecord[];
  onBulkUpload: (uploads: Map<string, Map<DocType, File[]>>, onProgress?: (current: number, total: number, fileName: string) => void) => Promise<void>;
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
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [currentStep, setCurrentStep] = useState<'select' | 'review' | 'uploading' | 'complete'>('select');
  const [editedAnalyses, setEditedAnalyses] = useState<Map<string, { batch: string; docType: DocType; skipUpload?: boolean }>>(new Map());
  const [duplicateFileNames, setDuplicateFileNames] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect duplicates for preview purposes only (not for resolution)
  useEffect(() => {
    if (!uploadPlan || !localStorageService || !appSettings.localStoragePath) {
      setDuplicateFileNames(new Set());
      return;
    }

    const checkDuplicates = async () => {
      const duplicates = new Set<string>();
      
      // Helper function to extract the base name from a formatted filename
      // "6890 - Purchase Order - PO-1085.pdf" or "6890 - Purchase Order - PO-1085 (2).pdf" -> "PO-1085.pdf"
      const extractBaseName = (fileName: string): string => {
        // Remove version numbers like " (2)"
        const withoutVersion = fileName.replace(/\s*\(\d+\)(\.[^.]+)$/, '$1');
        // Extract the reference part after the last dash
        const parts = withoutVersion.split(' - ');
        if (parts.length >= 3) {
          return parts[parts.length - 1].trim();
        }
        return fileName;
      };

      // Helper to normalize filename for comparison (remove extension, lowercase, trim)
      const normalizeForComparison = (fileName: string): string => {
        return fileName.replace(/\.[^.]+$/, '').toLowerCase().trim();
      };
      
      for (const [batchNumber, docTypeMap] of uploadPlan.groupedByBatch) {
        for (const [docType, files] of docTypeMap.entries()) {
          // Get all uploaded files for this batch
          const uploadedFiles = localStorageService.getUploadedFilesForBatch(batchNumber);
          
          // Filter by docType
          const uploadedForDocType = uploadedFiles.filter(f => f.docType === docType);
          
          // Extract base names from all uploaded files
          const uploadedBaseNames = uploadedForDocType.map(f => ({
            original: f.fileName,
            base: extractBaseName(f.fileName),
            normalized: normalizeForComparison(extractBaseName(f.fileName)),
            size: f.fileSize,
            hash: f.contentHash
          }));
          
          console.log(`🔍 Checking duplicates in batch ${batchNumber} (${docType}):`, {
            uploadedFiles: uploadedBaseNames.length,
            newFiles: files.length
          });
          
          for (const file of files) {
            const newFileNormalized = normalizeForComparison(file.name);
            
            // Check for name-based duplicates
            const nameMatches = uploadedBaseNames.filter(uploaded => 
              uploaded.normalized === newFileNormalized
            );
            
            if (nameMatches.length > 0) {
              duplicates.add(file.name);
              console.log(`⚠️ DUPLICATE FOUND: "${file.name}" matches ${nameMatches.length} existing file(s):`, 
                nameMatches.map(m => m.original)
              );
            }
          }
        }
      }
      
      console.log(`✅ Duplicate check complete: ${duplicates.size} duplicates found out of ${selectedFiles.length} files`);
      if (duplicates.size > 0) {
        console.log('📋 Duplicate files:', Array.from(duplicates));
      }
      setDuplicateFileNames(duplicates);
    };

    checkDuplicates();
  }, [uploadPlan, localStorageService, appSettings.localStoragePath, selectedFiles.length]);

  // Early return AFTER all hooks
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
    
    // Initialize unmatched files as "skip by default"
    const newEdits = new Map<string, { batch: string; docType: DocType; skipUpload?: boolean }>();
    plan.unmatchedFiles.forEach(file => {
      newEdits.set(file.name, {
        batch: records[0]?.['Batch number'] || '',
        docType: DocType.PO,
        skipUpload: true // Default to skip for unmatched files
      });
    });
    setEditedAnalyses(newEdits);
    
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
    
    // DON'T transition to uploading yet - wait for App.tsx to start actual upload
    // The progress callback below will be called when upload starts
    
    // Pass the plan to App.tsx which will:
    // 1. Detect duplicates
    // 2. Show DuplicateResolutionModal if needed
    // 3. Start actual upload (progress callback triggers uploading state)
    try {
      await onBulkUpload(finalPlan, (current, total, fileName) => {
        // This callback is called during actual upload (after duplicate resolution)
        // First call transitions to uploading state
        if (currentStep !== 'uploading') {
          setCurrentStep('uploading');
        }
        
        const percentage = Math.round((current / total) * 100);
        setUploadProgress(percentage);
        setUploadProgressText(`Uploading ${current}/${total}: ${fileName}`);
      });
      
      // If we get here, upload completed successfully
      setUploadProgress(100);
      setUploadProgressText('Upload complete!');
      setCurrentStep('complete');
    } catch (error) {
      console.error('Bulk upload error:', error);
      // Reset to review state on error
      setCurrentStep('review');
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setUploadPlan(null);
    setCurrentStep('select');
    setEditedAnalyses(new Map());
    setUploadProgress(0);
    setUploadProgressText('');
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
                
                {/* Duplicate Warning Banner */}
                {duplicateFileNames.size > 0 && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-400 rounded-lg shadow-sm">
                    <div className="flex items-start space-x-3">
                      <FileWarning className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="text-sm font-semibold text-orange-900 mb-1">
                          ⚠️ {duplicateFileNames.size} Duplicate File{duplicateFileNames.size > 1 ? 's' : ''} Detected
                        </h5>
                        <p className="text-xs text-orange-800">
                          Some files already exist in storage. You'll be able to choose whether to skip, replace, or create versioned copies after clicking "Start Upload".
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  {uploadPlan.analyses
                    .filter(a => a.matchedBatch && a.matchedDocType && a.confidence >= 60)
                    .map((analysis, idx) => {
                      const edited = editedAnalyses.get(analysis.file.name);
                      const displayBatch = edited?.batch || analysis.matchedBatch!;
                      const displayDocType = edited?.docType || analysis.matchedDocType!;
                      const isSkipped = edited?.skipUpload || false;
                      const isDuplicate = duplicateFileNames.has(analysis.file.name);
                      
                      return (
                        <div key={idx} className={`border rounded-lg p-4 transition-all ${
                          isSkipped 
                            ? 'border-gray-300 bg-gray-50 opacity-75' 
                            : isDuplicate
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-gray-200 bg-white'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <p className={`font-medium text-base ${isSkipped ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                  {analysis.file.name}
                                </p>
                                {isDuplicate && !isSkipped && (
                                  <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded-full shadow-sm animate-pulse">
                                    DUPLICATE
                                  </span>
                                )}
                                {isSkipped && (
                                  <span className="px-2 py-1 text-xs font-bold bg-gray-600 text-white rounded-full shadow-sm">
                                    <Ban className="h-3 w-3 inline mr-1" />
                                    SKIPPED
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{analysis.reason}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${getConfidenceColor(analysis.confidence)}`}>
                              {getConfidenceLabel(analysis.confidence)} ({analysis.confidence}%)
                            </span>
                          </div>
                          
                          {/* Simple Skip Toggle */}
                          <div className="flex items-center space-x-2 mt-3 mb-3">
                            <button
                              onClick={() => handleToggleSkipUpload(analysis.file.name)}
                              className={`flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium transition ${
                                isSkipped
                                  ? 'bg-gray-600 text-white hover:bg-gray-700'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              <Ban className="h-3 w-3" />
                              <span>{isSkipped ? 'Skipped (Click to Include)' : 'Include in Upload'}</span>
                            </button>
                            {isSkipped && (
                              <span className="text-xs text-gray-500 italic">⚠️ Will not be uploaded</span>
                            )}
                          </div>
                          
                          {/* Manual Edit Assignments (only if not skipped) */}
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
                                    <option key={r.id} value={String(r['Batch number'] || '')}>
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
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                    Unmatched Files ({uploadPlan.unmatchedFiles.length})
                  </h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-4">
                      These files could not be matched automatically. Please assign them manually below or mark them to skip.
                    </p>
                    <div className="space-y-4">
                      {uploadPlan.unmatchedFiles.map((file, idx) => {
                        const analysis = uploadPlan.analyses.find(a => a.file.name === file.name);
                        if (!analysis) return null;
                        
                        const edited = editedAnalyses.get(file.name);
                        const isSkipped = edited?.skipUpload || false;
                        const displayBatch = edited?.batch || records[0]?.['Batch number'] || '';
                        const displayDocType = edited?.docType || analysis.matchedDocType || DocType.PO;
                        
                        return (
                          <div key={idx} className="bg-white border border-yellow-300 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <FileWarning className="h-4 w-4 text-yellow-600" />
                                  <span className="font-medium text-gray-900">{file.name}</span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1">{analysis.reason}</p>
                              </div>
                            </div>
                            
                            {/* Skip Upload Toggle */}
                            <div className="flex items-center space-x-2 mb-3">
                              <button
                                onClick={() => handleToggleSkipUpload(file.name)}
                                className={`flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-medium transition ${
                                  isSkipped
                                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                              >
                                <Ban className="h-3 w-3" />
                                <span>{isSkipped ? 'Skipped (Click to Include)' : 'Include in Upload'}</span>
                              </button>
                              {isSkipped && (
                                <span className="text-xs text-gray-500 italic">⚠️ Will not be uploaded</span>
                              )}
                            </div>
                            
                            {/* Manual Assignment */}
                            {!isSkipped && (
                              <div className="space-y-4">
                                {/* Batch Selection with Embedded Search */}
                                <div className="flex items-center space-x-4">
                                  <SearchableDropdown
                                    label="Select Batch"
                                    options={records.map(r => ({
                                      value: String(r['Batch number'] || ''),
                                      label: String(r['Batch number'] || ''),
                                      subtitle: `PO: ${r['PO REF'] || 'N/A'} | SO: ${r['SO'] || 'N/A'} | ${r['PRODUCT NAME (MAX 35 CHARACTERS)']?.substring(0, 30) || 'No Product'}`
                                    }))}
                                    value={displayBatch}
                                    onChange={(value) => handleEditAssignment(file.name, value, displayDocType)}
                                    placeholder="Choose batch..."
                                    searchPlaceholder="🔍 Quick Search: batch, PO, SO, product, FSC..."
                                    className="flex-1"
                                  />
                                  
                                  <SearchableDropdown
                                    label="Document Type"
                                    options={[
                                      { value: DocType.PO, label: 'Purchase Order' },
                                      { value: DocType.SO, label: 'Sales Order' },
                                      { value: DocType.SupplierInvoice, label: 'Supplier Invoice' },
                                      { value: DocType.CustomerInvoice, label: 'Customer Invoice' }
                                    ]}
                                    value={displayDocType}
                                    onChange={(value) => handleEditAssignment(file.name, displayBatch, value as DocType)}
                                    placeholder="Select type..."
                                    enableQuickSearch={false}
                                    className="flex-1"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  onClick={() => setCurrentStep('select')}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Back
                </button>
                
                <div className="flex items-center space-x-4">
                  {/* Summary Stats */}
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Ready to upload</p>
                    <p className="text-sm font-bold text-gray-900">
                      {(() => {
                        // Count matched files that aren't marked as skipped
                        let count = 0;
                        for (const docTypeMap of uploadPlan.groupedByBatch.values()) {
                          for (const files of docTypeMap.values()) {
                            count += files.length;
                          }
                        }
                        // Add manually assigned unmatched files (not skipped)
                        uploadPlan.unmatchedFiles.forEach(file => {
                          const edited = editedAnalyses.get(file.name);
                          if (edited && !edited.skipUpload) {
                            count++;
                          }
                        });
                        // Subtract any matched files marked as skip
                        uploadPlan.analyses.forEach(analysis => {
                          if (analysis.matchedBatch && analysis.matchedDocType) {
                            const edited = editedAnalyses.get(analysis.file.name);
                            if (edited?.skipUpload) {
                              count--;
                            }
                          }
                        });
                        return count;
                      })()}
                      {' '}files
                    </p>
                  </div>
                  
                  <button
                    onClick={handleConfirmUpload}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg inline-flex items-center space-x-2 font-bold"
                  >
                    <Upload className="h-5 w-5" />
                    <span>Start Upload</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Uploading */}
          {currentStep === 'uploading' && (
            <div className="text-center py-12 px-6">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Uploading Files...
              </h3>
              <p className="text-sm font-medium text-gray-700 mb-1">
                {uploadProgressText || 'Please wait while we upload your files'}
              </p>
              <p className="text-2xl font-bold text-blue-600 mb-6">
                {uploadProgress}%
              </p>
              
              {/* Enhanced Progress Bar */}
              <div className="max-w-2xl mx-auto">
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner mb-4">
                  <div
                    className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 h-full transition-all duration-500 ease-out relative overflow-hidden"
                    style={{ width: `${uploadProgress}%` }}
                  >
                    {/* Animated shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer" 
                         style={{ 
                           animation: 'shimmer 2s infinite',
                           backgroundSize: '200% 100%'
                         }} 
                    />
                  </div>
                </div>
                
                {/* Progress milestones */}
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span className={uploadProgress >= 0 ? 'text-blue-600 font-medium' : ''}>Start</span>
                  <span className={uploadProgress >= 25 ? 'text-blue-600 font-medium' : ''}>25%</span>
                  <span className={uploadProgress >= 50 ? 'text-blue-600 font-medium' : ''}>50%</span>
                  <span className={uploadProgress >= 75 ? 'text-blue-600 font-medium' : ''}>75%</span>
                  <span className={uploadProgress === 100 ? 'text-green-600 font-medium' : ''}>Complete</span>
                </div>
                
                {/* Upload stats */}
                <div className="mt-6 grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <Upload className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Status</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {uploadProgress === 100 ? 'Done' : 'Uploading'}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Progress</p>
                    <p className="text-sm font-semibold text-gray-900">{uploadProgress}%</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <Sparkles className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Speed</p>
                    <p className="text-sm font-semibold text-gray-900">Fast</p>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mt-6 italic">
                  ⏳ Please don't close this window until the upload is complete
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center py-12 px-6">
              <div className="mb-6 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-20 w-20 bg-green-100 rounded-full animate-ping opacity-20" />
                </div>
                <CheckCircle className="h-20 w-20 text-green-500 mx-auto relative" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                🎉 Upload Complete!
              </h3>
              <p className="text-base text-gray-700 mb-6 max-w-md mx-auto">
                All files have been successfully uploaded and distributed to their batches.
              </p>
              
              {/* Success stats */}
              {uploadPlan && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Files Uploaded</p>
                      <p className="text-3xl font-bold text-green-600">
                        {uploadPlan.analyses.filter(a => !editedAnalyses.get(a.file.name)?.skipUpload).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Batches Updated</p>
                      <p className="text-3xl font-bold text-green-600">
                        {new Set(uploadPlan.analyses
                          .filter(a => !editedAnalyses.get(a.file.name)?.skipUpload)
                          .map(a => editedAnalyses.get(a.file.name)?.batch || a.matchedBatch)
                        ).size}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-md hover:shadow-lg"
                >
                  ✓ Done
                </button>
                <button
                  onClick={() => {
                    setSelectedFiles([]);
                    setUploadPlan(null);
                    setCurrentStep('select');
                    setEditedAnalyses(new Map());
                    setUploadProgress(0);
                    setUploadProgressText('');
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-md hover:shadow-lg"
                >
                  📤 Upload More
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
