import { FscRecord, DocType } from '../types';
import { getDirectoryHandle } from '../utils/dirHandleStore';

export interface UploadedFileRecord {
  batchNumber: string;
  docType: DocType;
  fileName: string;
  uploadedAt: string;
  filePath: string;
}

export interface ScanProgress {
  status: 'scanning' | 'validating' | 'complete' | 'error';
  currentFolder?: string;
  scannedCount: number;
  totalFolders?: number;
  message: string;
}

export interface ScanResult {
  success: boolean;
  filesFound: number;
  newEntriesAdded: number;
  orphanedFiles: string[]; // Files in unknown batches
  existingEntriesPreserved: number;
  errors: string[];
  backupCreated: boolean;
  backupPath?: string;
}

/**
 * Local storage service for saving files to the local PC.
 * Uses Electron IPC to interact with the file system.
 * Tracks uploads in a .upload-history.json file in each batch folder.
 */
export class LocalStorageService {
  private uploadHistory: Map<string, UploadedFileRecord> = new Map();
  private basePath: string = '';
  private dirHandle: FileSystemDirectoryHandle | null = null;

  constructor() {
    // History will be loaded when uploadFile is called with basePath
  }

  /**
   * Load upload history from .upload-history.json in the base folder
   */
  private async loadUploadHistory(basePath: string): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electron) {
      try {
        const historyFile = `${basePath.replace(/\\/g, '/')}/.upload-history.json`;
        console.log('📖 Loading upload history from:', historyFile);
        const content = await (window as any).electron.readFile(historyFile);
        if (content) {
          const history = JSON.parse(content);
          if (history && Array.isArray(history)) {
            this.uploadHistory = new Map(history.map((item: any) => {
              // Ensure batchNumber is always a string
              const normalizedItem: UploadedFileRecord = {
                ...item,
                batchNumber: String(item.batchNumber)
              };
              return [
                this.getFileKey(normalizedItem.batchNumber, normalizedItem.docType, normalizedItem.fileName),
                normalizedItem
              ];
            }));
            console.log(`✅ Loaded ${history.length} upload records from history`);
          }
        }
      } catch (error) {
        console.log('ℹ️ No existing upload history found (this is normal for first run)');
      }
      return;
    }
    // Web: File System Access API
    if (this.dirHandle) {
      try {
        const fileHandle = await this.dirHandle.getFileHandle('.upload-history.json');
        const file = await fileHandle.getFile();
        const content = await file.text();
        const history: any[] = JSON.parse(content);
        if (Array.isArray(history)) {
          this.uploadHistory = new Map(history.map((item: any) => {
            // Ensure batchNumber is always a string
            const normalizedItem: UploadedFileRecord = {
              ...item,
              batchNumber: String(item.batchNumber)
            };
            return [
              this.getFileKey(normalizedItem.batchNumber, normalizedItem.docType, normalizedItem.fileName),
              normalizedItem
            ];
          }));
          console.log(`✅ Loaded ${history.length} upload records from history (web)`);
        }
      } catch (_err) {
        console.log('ℹ️ No existing upload history found in web folder');
      }
    }
  }

  /**
   * Scan the actual folder to verify which files exist and reconcile with upload history.
   * Removes stale entries for files that were deleted from disk.
   */
  private async scanAndReconcileFolder(basePath: string): Promise<void> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron;
    
    if (isElectron && !basePath) return;
    if (!isElectron && !this.dirHandle) return;

    console.log('🔍 Scanning folder to verify uploaded files...');
    
    const existingFiles = new Set<string>();

    if (isElectron) {
      // Electron: Since we removed Electron code, just clear history on path change
      // User can re-upload as needed
      console.log('⚠️ Electron mode detected but no IPC available. Clearing history.');
      this.uploadHistory.clear();
      return;
    } else {
      // Web: use File System Access API to scan directory
      try {
        // Request permission before scanning
        // @ts-ignore
        const permission = await this.dirHandle!.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          // @ts-ignore
          const newPermission = await this.dirHandle!.requestPermission({ mode: 'readwrite' });
          if (newPermission !== 'granted') {
            console.warn('Permission denied to scan folder. Counts may be inaccurate.');
            return;
          }
        }
        
        // @ts-ignore
        for await (const batchEntry of this.dirHandle!.values()) {
          if (batchEntry.kind !== 'directory') continue;
          const batchName = batchEntry.name;
          
          // @ts-ignore
          for await (const docTypeEntry of batchEntry.values()) {
            if (docTypeEntry.kind !== 'directory') continue;
            const docTypeName = docTypeEntry.name;
            
            // @ts-ignore
            for await (const fileEntry of docTypeEntry.values()) {
              if (fileEntry.kind === 'file') {
                const fileName = fileEntry.name;
                const key = this.getFileKey(batchName, docTypeName as DocType, fileName);
                existingFiles.add(key);
              }
            }
          }
        }
        
        // Remove history entries that don't have corresponding files
        const keysToRemove: string[] = [];
        for (const key of this.uploadHistory.keys()) {
          if (!existingFiles.has(key)) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => this.uploadHistory.delete(key));
        if (keysToRemove.length > 0) {
          console.log(`🧹 Removed ${keysToRemove.length} stale entries from web folder history`);
          await this.saveUploadHistory('');
        }
        
        console.log(`✅ Scan complete: ${existingFiles.size} files found in folder`);
      } catch (error) {
        console.warn('Could not scan web folder:', error);
      }
    }
  }

  /**
   * Save upload history to .upload-history.json in the base folder
   */
  private async saveUploadHistory(basePath: string): Promise<void> {
    const history = Array.from(this.uploadHistory.values());
    const content = JSON.stringify(history, null, 2);
    if (typeof window !== 'undefined' && (window as any).electron) {
      try {
        const historyFile = `${basePath.replace(/\\/g, '/')}/.upload-history.json`;
        console.log('💾 Saving upload history to:', historyFile);
        await (window as any).electron.writeFile(historyFile, content);
        console.log(`✅ Saved ${history.length} upload records`);
      } catch (error) {
        console.error('Failed to save upload history:', error);
      }
      return;
    }
    // Web write
    if (this.dirHandle) {
      try {
        // Request permission before writing
        // @ts-ignore
        const permission = await this.dirHandle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          // @ts-ignore
          const newPermission = await this.dirHandle.requestPermission({ mode: 'readwrite' });
          if (newPermission !== 'granted') {
            console.warn('Permission denied to save upload history');
            return;
          }
        }
        
        const fileHandle = await this.dirHandle.getFileHandle('.upload-history.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([content], { type: 'application/json' }));
        await writable.close();
        console.log(`✅ Saved ${history.length} upload records (web)`);
      } catch (error) {
        console.error('Failed to save upload history (web):', error);
      }
    }
  }

  /**
   * Generate a unique key for a file
   */
  private getFileKey(batchNumber: string, docType: DocType, fileName: string): string {
    return `${batchNumber}|${docType}|${fileName}`;
  }

  /**
   * Ensure upload history is loaded (public method for duplicate detection)
   */
  public async ensureHistoryLoaded(basePath: string): Promise<void> {
    if (this.basePath !== basePath || this.uploadHistory.size === 0) {
      this.basePath = basePath;
      await this.loadUploadHistory(basePath);
      console.log(`📚 Upload history loaded: ${this.uploadHistory.size} records`);
    }
  }

  /**
   * Check if a file has already been uploaded
   */
  public isFileUploaded(batchNumber: string | number, docType: DocType, fileName: string): boolean {
    const key = this.getFileKey(String(batchNumber), docType, fileName);
    const exists = this.uploadHistory.has(key);
    console.log(`🔍 Checking if file exists: ${fileName} in batch ${batchNumber}, docType ${docType} = ${exists}`);
    return exists;
  }

  /**
   * Get uploaded file info
   */
  public getUploadedFile(batchNumber: string | number, docType: DocType, fileName: string): UploadedFileRecord | undefined {
    const key = this.getFileKey(String(batchNumber), docType, fileName);
    return this.uploadHistory.get(key);
  }

  /**
   * Generate smart file name based on batch, PO/SO, and doc type
   * Format: {BatchNumber} - {DocType} - {PO/SO Number}
   * If duplicate exists, adds (1), (2), etc.
   */
  private generateFileName(record: FscRecord, docType: DocType, originalName: string, basePath: string): string {
    const batchNumber = record['Batch number'] || 'NOBATCH';
    const sanitizeBatch = batchNumber.toString().replace(/[^a-zA-Z0-9-_]/g, '_');
    
    // Use PO or SO depending on doc type
    let refNumber = '';
    if (docType === DocType.PO || docType === DocType.SupplierInvoice) {
      refNumber = record['PO REF'] || 'NOREF';
    } else if (docType === DocType.SO || docType === DocType.CustomerInvoice) {
      refNumber = record['SO'] || 'NOREF';
    }
    const sanitizeRef = refNumber.toString().replace(/[^a-zA-Z0-9-_]/g, '_');
    
    // Get file extension
    const ext = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
    
    // Base file name without number suffix
    const baseFileName = `${sanitizeBatch} - ${docType} - ${sanitizeRef}`;
    
    // Check if file exists and add number suffix if needed
    let fileName = `${baseFileName}${ext}`;
    let counter = 1;
    const folderPath = this.generateFolderPath(basePath, batchNumber, docType);
    
    // Keep incrementing until we find a name that doesn't exist
    while (this.isFileInHistory(batchNumber, docType, fileName)) {
      fileName = `${baseFileName} (${counter})${ext}`;
      counter++;
    }
    
    return fileName;
  }

  /**
   * Check if a file exists in upload history
   */
  private isFileInHistory(batchNumber: string | number, docType: DocType, fileName: string): boolean {
    const key = this.getFileKey(String(batchNumber), docType, fileName);
    return this.uploadHistory.has(key);
  }

  /**
   * Generate folder path: {BasePath}/{BatchNumber}/{DocType}/
   */
  private generateFolderPath(basePath: string, batchNumber: string, docType: DocType): string {
    const sanitizeBatch = batchNumber.toString().replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizeDocType = docType.replace(/[^a-zA-Z0-9-_\s]/g, '_');
    
    // Normalize path separators to forward slashes, Electron will handle conversion
    const normalizedBase = basePath.replace(/\\/g, '/');
    return `${normalizedBase}/${sanitizeBatch}/${sanitizeDocType}`;
  }

  private async ensureWebSubfolder(batchNumber: string, docType: DocType): Promise<FileSystemDirectoryHandle> {
    if (!this.dirHandle) throw new Error('No folder selected. Click Browse to choose a base folder.');
    
    // Request permission before accessing
    try {
      // @ts-ignore
      const permission = await this.dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        // @ts-ignore
        const newPermission = await this.dirHandle.requestPermission({ mode: 'readwrite' });
        if (newPermission !== 'granted') {
          throw new Error('Permission denied to access the folder. Please re-select the folder in Settings.');
        }
      }
    } catch (e) {
      console.warn('Permission check failed:', e);
      throw new Error('Permission denied to access the folder. Please re-select the folder in Settings.');
    }
    
    const sanitizeBatch = batchNumber.toString().replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizeDocType = docType.replace(/[^a-zA-Z0-9-_\s]/g, '_');
    const batchDir = await this.dirHandle.getDirectoryHandle(sanitizeBatch, { create: true });
    const typeDir = await batchDir.getDirectoryHandle(sanitizeDocType, { create: true });
    return typeDir;
  }

  /**
   * Scan all folders and rebuild upload history from actual files on disk
   * @param basePath - The base folder path to scan (Electron only, pass empty string for web)
   * @param validBatchNumbers - Optional set of valid batch numbers from Airtable to validate against
   * @param onProgress - Optional callback for progress updates
   * @returns ScanResult with details about the scan
   */
  public async scanAndRebuildHistory(
    basePath: string,
    validBatchNumbers?: Set<string>,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ScanResult> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron;
    
    // For now, only support web mode with File System Access API
    if (isElectron) {
      return {
        success: false,
        filesFound: 0,
        newEntriesAdded: 0,
        orphanedFiles: [],
        existingEntriesPreserved: 0,
        errors: ['Scan & Rebuild for Electron mode coming soon. Currently only supported for web browser with File System Access API.'],
        backupCreated: false,
      };
    }

    if (!this.dirHandle) {
      return {
        success: false,
        filesFound: 0,
        newEntriesAdded: 0,
        orphanedFiles: [],
        existingEntriesPreserved: 0,
        errors: ['No folder selected. Please select a folder in Settings first.'],
        backupCreated: false,
      };
    }

    const result: ScanResult = {
      success: false,
      filesFound: 0,
      newEntriesAdded: 0,
      orphanedFiles: [],
      existingEntriesPreserved: 0,
      errors: [],
      backupCreated: false,
    };

    try {
      // Step 1: Create backup of existing history
      onProgress?.({
        status: 'scanning',
        message: 'Creating backup of existing upload history...',
        scannedCount: 0,
      });

      // Save backup of existing history
      const existingHistory = new Map(this.uploadHistory);
      result.existingEntriesPreserved = existingHistory.size;
      
      if (existingHistory.size > 0) {
        try {
          const backupData = JSON.stringify(Array.from(existingHistory.values()), null, 2);
          const backupFileName = `.upload-history.backup-${Date.now()}.json`;
          const backupHandle = await this.dirHandle.getFileHandle(backupFileName, { create: true });
          const writable = await backupHandle.createWritable();
          await writable.write(new Blob([backupData], { type: 'application/json' }));
          await writable.close();
          result.backupCreated = true;
          result.backupPath = backupFileName;
          console.log('✅ Backup created:', backupFileName);
        } catch (e) {
          console.warn('Could not create backup:', e);
        }
      }

      // Step 2: Clear and prepare for rebuild
      this.uploadHistory.clear();

      onProgress?.({
        status: 'scanning',
        message: 'Scanning folders for uploaded files...',
        scannedCount: 0,
      });

      // Step 3: Scan the folder using File System Access API
      const scannedFiles: Array<{
        batchNumber: string;
        docType: DocType;
        fileName: string;
        filePath: string;
        lastModified: Date;
      }> = [];

      // Request permission before scanning
      try {
        // @ts-ignore
        const permission = await this.dirHandle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          // @ts-ignore
          const newPermission = await this.dirHandle.requestPermission({ mode: 'readwrite' });
          if (newPermission !== 'granted') {
            throw new Error('Permission denied to scan folder');
          }
        }
      } catch (e) {
        throw new Error('Permission denied to scan folder. Please re-select the folder in Settings.');
      }

      // Get list of batch folders
      const batchFolders: string[] = [];
      // @ts-ignore
      for await (const batchEntry of this.dirHandle.values()) {
        if (batchEntry.kind === 'directory' && !batchEntry.name.startsWith('.')) {
          batchFolders.push(batchEntry.name);
        }
      }

      onProgress?.({
        status: 'scanning',
        message: `Found ${batchFolders.length} batch folders. Scanning...`,
        scannedCount: 0,
        totalFolders: batchFolders.length,
      });

      let scannedCount = 0;
      // @ts-ignore
      for await (const batchEntry of this.dirHandle.values()) {
        if (batchEntry.kind !== 'directory' || batchEntry.name.startsWith('.')) continue;
        
        const batchNumber = batchEntry.name;
        
        onProgress?.({
          status: 'scanning',
          currentFolder: batchNumber,
          message: `Scanning batch: ${batchNumber}...`,
          scannedCount: scannedCount,
          totalFolders: batchFolders.length,
        });

        try {
          // @ts-ignore - Get doc type subfolders
          for await (const docTypeEntry of batchEntry.values()) {
            if (docTypeEntry.kind !== 'directory') continue;
            
            const docTypeName = docTypeEntry.name;
            // Match to DocType enum
            const matchedDocType = Object.values(DocType).find(
              dt => dt === docTypeName || dt.replace(/[^a-zA-Z0-9-_\s]/g, '_') === docTypeName
            );
            
            if (!matchedDocType) continue;

            // @ts-ignore - Get files in doc type folder
            for await (const fileEntry of docTypeEntry.values()) {
              if (fileEntry.kind !== 'file') continue;
              
              const file = await fileEntry.getFile();
              
              scannedFiles.push({
                batchNumber: batchNumber,
                docType: matchedDocType,
                fileName: fileEntry.name,
                filePath: `${batchNumber}/${docTypeName}/${fileEntry.name}`,
                lastModified: new Date(file.lastModified || Date.now()),
              });
            }
          }
        } catch (error) {
          result.errors.push(`Error scanning batch ${batchNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        scannedCount++;
      }

      result.filesFound = scannedFiles.length;

      // Step 4: Validate and add to history
      onProgress?.({
        status: 'validating',
        message: `Validating ${scannedFiles.length} files...`,
        scannedCount: scannedFiles.length,
      });

      for (const scannedFile of scannedFiles) {
        // Check if batch is valid (if validation set provided)
        if (validBatchNumbers && !validBatchNumbers.has(scannedFile.batchNumber)) {
          result.orphanedFiles.push(
            `${scannedFile.batchNumber}/${scannedFile.docType}/${scannedFile.fileName}`
          );
          continue; // Skip orphaned files
        }

        const key = this.getFileKey(scannedFile.batchNumber, scannedFile.docType, scannedFile.fileName);
        
        // Check if this file was in the old history
        const existingRecord = existingHistory.get(key);
        
        const uploadRecord: UploadedFileRecord = {
          batchNumber: scannedFile.batchNumber,
          docType: scannedFile.docType,
          fileName: scannedFile.fileName,
          uploadedAt: existingRecord?.uploadedAt || scannedFile.lastModified.toISOString(),
          filePath: scannedFile.filePath,
        };

        this.uploadHistory.set(key, uploadRecord);
        
        if (!existingRecord) {
          result.newEntriesAdded++;
        }
      }

      // Step 5: Save the rebuilt history
      onProgress?.({
        status: 'complete',
        message: 'Saving rebuilt upload history...',
        scannedCount: scannedFiles.length,
      });

      await this.saveUploadHistory('');

      result.success = true;
      
      onProgress?.({
        status: 'complete',
        message: 'Scan complete!',
        scannedCount: scannedFiles.length,
      });

      console.log('✅ Scan & Rebuild complete:', {
        filesFound: result.filesFound,
        newEntriesAdded: result.newEntriesAdded,
        orphanedFiles: result.orphanedFiles.length,
        existingPreserved: result.existingEntriesPreserved,
      });

    } catch (error) {
      result.success = false;
      result.errors.push(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('❌ Scan & Rebuild failed:', error);
      
      onProgress?.({
        status: 'error',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        scannedCount: 0,
      });
    }

    return result;
  }

  /**
   * Upload a file to local storage
   */
  public async uploadFile(
    record: FscRecord,
    file: File,
    docType: DocType,
    basePath: string
  ): Promise<void> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron;
    if (isElectron && !basePath) throw new Error('Local storage path is not configured');
    if (!isElectron && !this.dirHandle) throw new Error('No folder selected. Click Browse to choose a base folder.');

    // Load history if base path changed
    if (this.basePath !== basePath || (!isElectron && !this.uploadHistory.size)) {
      this.basePath = basePath;
      await this.loadUploadHistory(basePath);
    }

    const batchNumber = record['Batch number'] || 'NOBATCH';
    const batchNumberStr = String(batchNumber); // Ensure it's always a string
    const fileName = this.generateFileName(record, docType, file.name, basePath);
    
    console.log('📁 Uploading to local storage:', {
      batchNumber: batchNumberStr,
      docType,
      fileName,
      folderPath: isElectron ? this.generateFolderPath(basePath, batchNumberStr, docType) : `(web folder)/${batchNumberStr}/${docType}`,
      fileSize: file.size
    });
    
    try {
      if (isElectron) {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const folderPath = this.generateFolderPath(basePath, batchNumberStr, docType);
        console.log('💾 Calling Electron IPC to save file...');
        const savedPath = await (window as any).electron.saveFile(folderPath, fileName, buffer);
        console.log('✅ File saved successfully:', savedPath);
      } else {
        // Web write to selected directory
        const targetDir = await this.ensureWebSubfolder(batchNumberStr, docType);
        const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        console.log('✅ File saved successfully in web folder');
      }

      // Record the upload
      const key = this.getFileKey(batchNumberStr, docType, fileName);
      const uploadRecord: UploadedFileRecord = {
        batchNumber: batchNumberStr,
        docType,
        fileName,
        uploadedAt: new Date().toISOString(),
        filePath: isElectron ? this.generateFolderPath(basePath, batchNumberStr, docType) + '/' + fileName : `${batchNumberStr}/${docType}/${fileName}`,
      };

      this.uploadHistory.set(key, uploadRecord);
      await this.saveUploadHistory(basePath);

      console.log(`📝 Upload history updated`);
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all uploaded files for a batch
   */
  public getUploadedFilesForBatch(batchNumber: string | number): UploadedFileRecord[] {
    const batchStr = String(batchNumber); // Ensure string comparison
    return Array.from(this.uploadHistory.values()).filter(
      record => record.batchNumber === batchStr
    );
  }

  /**
   * Get count of uploaded files for a specific batch and doc type
   */
  public getUploadedFileCount(batchNumber: string | number, docType: DocType): number {
    const batchStr = String(batchNumber); // Ensure string comparison
    return Array.from(this.uploadHistory.values()).filter(
      record => record.batchNumber === batchStr && record.docType === docType
    ).length;
  }

  /**
   * Initialize and load history for a given base path
   */
  public async initialize(basePath: string): Promise<void> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron;
    if (isElectron) {
      if (this.basePath !== basePath) {
        this.basePath = basePath;
        await this.loadUploadHistory(basePath);
        await this.scanAndReconcileFolder(basePath);
      }
      return;
    }
    // Web: load persisted directory handle (if available)
    try {
      this.dirHandle = await getDirectoryHandle();
      if (this.dirHandle) {
        await this.loadUploadHistory('');
        await this.scanAndReconcileFolder('');
      }
    } catch (e) {
      console.warn('No persisted directory handle found for web local storage');
    }
  }

  /**
   * Clear upload history (for testing or reset)
   */
  public async clearHistory(): Promise<void> {
    this.uploadHistory.clear();
    if (this.basePath) {
      await this.saveUploadHistory(this.basePath);
    }
  }
}
