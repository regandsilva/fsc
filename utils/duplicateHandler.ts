// Duplicate file detection and versioning utility
import { FscRecord, DocType } from '../types';
import { LocalStorageService } from '../services/localStorageService';

export interface DuplicateFile {
  file: File;
  batchNumber: string;
  docType: DocType;
  existingFileName: string;
  action: 'skip' | 'replace' | 'version';
  versionNumber?: number;
}

export interface DuplicateDetectionResult {
  duplicates: DuplicateFile[];
  nonDuplicates: Array<{ file: File; batchNumber: string; docType: DocType }>;
}

/**
 * Generate a versioned filename (e.g., "invoice.pdf" -> "invoice_v2.pdf")
 */
export function generateVersionedFilename(originalFilename: string, version: number): string {
  const lastDotIndex = originalFilename.lastIndexOf('.');
  
  if (lastDotIndex === -1) {
    // No extension
    return `${originalFilename}_v${version}`;
  }
  
  const name = originalFilename.substring(0, lastDotIndex);
  const extension = originalFilename.substring(lastDotIndex);
  
  return `${name}_v${version}${extension}`;
}

/**
 * Find the next available version number for a filename
 */
export async function findNextVersion(
  basePath: string,
  batchNumber: string,
  docType: DocType,
  originalFilename: string,
  localStorageService: LocalStorageService
): Promise<number> {
  const folderMap: Record<DocType, string> = {
    [DocType.PO]: '1_PurchaseOrders',
    [DocType.SO]: '2_SalesOrders',
    [DocType.SupplierInvoice]: '3_SupplierInvoices',
    [DocType.CustomerInvoice]: '4_CustomerInvoices',
  };

  const lastDotIndex = originalFilename.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex === -1 ? originalFilename : originalFilename.substring(0, lastDotIndex);
  const extension = lastDotIndex === -1 ? '' : originalFilename.substring(lastDotIndex);

  let version = 2;
  const maxAttempts = 100; // Prevent infinite loops

  // Check upload history for existing versions
  while (version < maxAttempts) {
    const versionedFilename = `${nameWithoutExt}_v${version}${extension}`;
    const exists = localStorageService.isFileUploaded(batchNumber, docType, versionedFilename);
    if (!exists) {
      return version;
    }
    version++;
  }

  return version;
}

/**
 * Detect duplicate files in the upload plan
 */
export async function detectDuplicates(
  uploadPlan: Map<string, Map<DocType, File[]>>,
  basePath: string,
  localStorageService: LocalStorageService
): Promise<DuplicateDetectionResult> {
  console.log('🔍 detectDuplicates called');
  console.log('  LocalStorage service available:', !!localStorageService);
  console.log('  Base path:', basePath);
  
  // Load upload history before checking duplicates
  if (localStorageService && basePath) {
    console.log('📖 Loading upload history before duplicate check...');
    await localStorageService.ensureHistoryLoaded(basePath);
  }
  
  const duplicates: DuplicateFile[] = [];
  const nonDuplicates: Array<{ file: File; batchNumber: string; docType: DocType }> = [];

  for (const [batchNumber, docTypeMap] of uploadPlan.entries()) {
    console.log(`  Checking batch: ${batchNumber}`);
    for (const [docType, files] of docTypeMap.entries()) {
      console.log(`    Checking docType: ${DocType[docType]} (${files.length} files)`);
      for (const file of files) {
        // Get all files in this batch/docType to check for matches
        const existingFiles = localStorageService.getUploadedFilesForBatch(batchNumber)
          .filter(record => record.docType === docType);
        
        console.log(`      Existing files in batch ${batchNumber}, docType ${docType}:`, existingFiles.map(f => f.fileName));
        
        // Check if a file with the same original name exists
        // The uploaded filename format is: "{batch} - {docType} - {originalName}"
        const originalNamePattern = file.name.replace(/\.[^.]+$/, ''); // Remove extension
        const isDuplicate = existingFiles.some(existing => {
          // Check if existing filename contains the original filename
          const match = existing.fileName.includes(file.name) || 
                       existing.fileName.includes(originalNamePattern);
          if (match) {
            console.log(`      ✓ MATCH: ${existing.fileName} contains ${file.name}`);
          }
          return match;
        });
        
        console.log(`      File: ${file.name} - isDuplicate: ${isDuplicate}`);

        if (isDuplicate) {
          duplicates.push({
            file,
            batchNumber,
            docType,
            existingFileName: file.name,
            action: 'skip', // Default action
          });
        } else {
          nonDuplicates.push({ file, batchNumber, docType });
        }
      }
    }
  }

  console.log(`✅ Detection complete: ${duplicates.length} duplicates, ${nonDuplicates.length} new files`);
  return { duplicates, nonDuplicates };
}

/**
 * Apply versioning to duplicate files based on user choices
 */
export async function applyVersioning(
  duplicates: DuplicateFile[],
  basePath: string,
  localStorageService: LocalStorageService
): Promise<Array<{ file: File; batchNumber: string; docType: DocType; versionedName?: string }>> {
  const result: Array<{ file: File; batchNumber: string; docType: DocType; versionedName?: string }> = [];

  for (const duplicate of duplicates) {
    if (duplicate.action === 'skip') {
      // Skip this file
      continue;
    } else if (duplicate.action === 'replace') {
      // Upload with original name (will overwrite)
      result.push({
        file: duplicate.file,
        batchNumber: duplicate.batchNumber,
        docType: duplicate.docType,
      });
    } else if (duplicate.action === 'version') {
      // Generate versioned filename
      const version = await findNextVersion(
        basePath,
        duplicate.batchNumber,
        duplicate.docType,
        duplicate.file.name,
        localStorageService
      );
      const versionedName = generateVersionedFilename(duplicate.file.name, version);
      
      // Create a new File object with the versioned name
      const versionedFile = new File([duplicate.file], versionedName, { type: duplicate.file.type });
      
      result.push({
        file: versionedFile,
        batchNumber: duplicate.batchNumber,
        docType: duplicate.docType,
        versionedName,
      });
    }
  }

  return result;
}
