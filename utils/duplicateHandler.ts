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
  matchReason?: string; // Why it was detected as duplicate
  contentHash?: string; // Hash of file content
  sizeMatch?: boolean; // If file size matches
  modifiedDate?: string; // Last modified date
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
 * Calculate SHA-256 hash of a file for duplicate detection
 */
async function calculateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Error calculating file hash:', error);
    return '';
  }
}

/**
 * Calculate a simple content similarity score based on file size
 */
function calculateSizeSimilarity(size1: number, size2: number): number {
  if (size1 === size2) return 100;
  const diff = Math.abs(size1 - size2);
  const avg = (size1 + size2) / 2;
  const similarity = Math.max(0, 100 - (diff / avg * 100));
  return similarity;
}

/**
 * Check if filename suggests it's the same document
 */
function analyzeNameSimilarity(name1: string, name2: string): {
  isMatch: boolean;
  confidence: number;
  reason: string;
} {
  // Remove extensions for comparison
  const getName = (fullName: string) => {
    const lastDot = fullName.lastIndexOf('.');
    return lastDot === -1 ? fullName : fullName.substring(0, lastDot);
  };
  
  // Remove version numbers in parentheses like (1), (2), etc.
  const removeParenthesesVersion = (name: string) => {
    return name.replace(/\s*\(\d+\)$/, '');
  };
  
  // Remove _v1, _v2 style versions
  const removeUnderscoreVersion = (name: string) => {
    return name.replace(/_v\d+$/, '');
  };
  
  const baseName1 = removeParenthesesVersion(removeUnderscoreVersion(getName(name1).toLowerCase().replace(/[_\s-]+/g, '')));
  const baseName2 = removeParenthesesVersion(removeUnderscoreVersion(getName(name2).toLowerCase().replace(/[_\s-]+/g, '')));
  
  // Exact match (ignoring case, separators, and version suffixes)
  if (baseName1 === baseName2) {
    return { isMatch: true, confidence: 100, reason: 'Identical filename (ignoring version)' };
  }
  
  // Check if one contains the other
  if (baseName1.includes(baseName2) || baseName2.includes(baseName1)) {
    const longer = baseName1.length > baseName2.length ? baseName1 : baseName2;
    const shorter = baseName1.length > baseName2.length ? baseName2 : baseName1;
    const similarity = (shorter.length / longer.length) * 100;
    
    if (similarity > 80) {
      return { isMatch: true, confidence: Math.round(similarity), reason: 'Similar filename' };
    }
  }
  
  return { isMatch: false, confidence: 0, reason: 'Different filename' };
}

/**
 * Detect duplicate files in the upload plan with enhanced detection
 */
/**
 * Detect duplicate files in the upload plan with enhanced detection
 */
export async function detectDuplicates(
  uploadPlan: Map<string, Map<DocType, File[]>>,
  basePath: string,
  localStorageService: LocalStorageService
): Promise<DuplicateDetectionResult> {
  console.log('🔍 detectDuplicates called (Enhanced version)');
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
        
        let isDuplicate = false;
        let matchReason = '';
        let sizeMatch = false;
        
        // Calculate hash for this file
        const fileHash = await calculateFileHash(file);
        
        // Check each existing file
        for (const existing of existingFiles) {
          // Extract original filename from stored format: "{batch} - {docType} - {originalName}"
          // Also handle version suffixes like "PO-1085 (9).pdf" -> "PO-1085.pdf"
          const parts = existing.fileName.split(' - ');
          let existingOriginalName = parts.length >= 3 ? parts.slice(2).join(' - ') : existing.fileName;
          
          // Remove version suffix in parentheses: "filename (2).pdf" -> "filename.pdf"
          existingOriginalName = existingOriginalName.replace(/\s*\(\d+\)(\.[^.]+)$/, '$1');
          
          console.log(`        Comparing "${file.name}" with existing "${existingOriginalName}" (original: "${existing.fileName}")`);
          
          // 1. Check filename similarity
          const nameSimilarity = analyzeNameSimilarity(file.name, existingOriginalName);
          
          // 2. Check file size
          const sizeSimilarity = existing.fileSize ? calculateSizeSimilarity(file.size, existing.fileSize) : 0;
          sizeMatch = sizeSimilarity > 95; // Consider 95%+ as size match
          
          // 3. Check content hash if available
          const hashMatch = existing.contentHash && fileHash ? existing.contentHash === fileHash : false;
          
          // Determine if it's a duplicate based on multiple signals
          if (hashMatch) {
            isDuplicate = true;
            matchReason = '🔒 Identical file content (hash match)';
            console.log(`      ✓ HASH MATCH: ${file.name} === ${existingOriginalName}`);
            break;
          } else if (nameSimilarity.isMatch && sizeMatch) {
            isDuplicate = true;
            matchReason = `📄 ${nameSimilarity.reason} + identical size`;
            console.log(`      ✓ NAME+SIZE MATCH: ${file.name} ~= ${existingOriginalName} (${nameSimilarity.confidence}% name, size ${file.size})`);
            break;
          } else if (nameSimilarity.isMatch && nameSimilarity.confidence >= 95) {
            isDuplicate = true;
            matchReason = `📄 ${nameSimilarity.reason}`;
            console.log(`      ✓ NAME MATCH: ${file.name} ~= ${existingOriginalName} (${nameSimilarity.confidence}%)`);
            break;
          }
        }
        
        console.log(`      File: ${file.name} - isDuplicate: ${isDuplicate}, reason: ${matchReason}`);

        if (isDuplicate) {
          duplicates.push({
            file,
            batchNumber,
            docType,
            existingFileName: file.name,
            action: 'skip', // Default action
            matchReason,
            contentHash: fileHash,
            sizeMatch,
            modifiedDate: new Date(file.lastModified).toISOString(),
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
): Promise<Array<{ file: File; batchNumber: string; docType: DocType; versionedName?: string; forceReplace?: boolean }>> {
  const result: Array<{ file: File; batchNumber: string; docType: DocType; versionedName?: string; forceReplace?: boolean }> = [];

  for (const duplicate of duplicates) {
    if (duplicate.action === 'skip') {
      // Skip this file
      continue;
    } else if (duplicate.action === 'replace') {
      // Upload with original name (will overwrite existing file)
      console.log(`🔄 Replace mode: ${duplicate.file.name} will overwrite existing file`);
      result.push({
        file: duplicate.file,
        batchNumber: duplicate.batchNumber,
        docType: duplicate.docType,
        forceReplace: true, // This flag tells uploadFile to replace the existing file
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
