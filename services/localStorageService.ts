import { FscRecord, DocType } from '../types';
import { getDirectoryHandle } from '../utils/dirHandleStore';

export interface UploadedFileRecord {
  batchNumber: string;
  docType: DocType;
  fileName: string;
  uploadedAt: string;
  filePath: string;
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
            this.uploadHistory = new Map(history.map((item: UploadedFileRecord) => [
              this.getFileKey(item.batchNumber, item.docType, item.fileName),
              item
            ]));
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
        const history: UploadedFileRecord[] = JSON.parse(content);
        if (Array.isArray(history)) {
          this.uploadHistory = new Map(history.map((item: UploadedFileRecord) => [
            this.getFileKey(item.batchNumber, item.docType, item.fileName),
            item
          ]));
          console.log(`✅ Loaded ${history.length} upload records from history (web)`);
        }
      } catch (_err) {
        console.log('ℹ️ No existing upload history found in web folder');
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
   * Check if a file has already been uploaded
   */
  public isFileUploaded(batchNumber: string, docType: DocType, fileName: string): boolean {
    const key = this.getFileKey(batchNumber, docType, fileName);
    return this.uploadHistory.has(key);
  }

  /**
   * Get uploaded file info
   */
  public getUploadedFile(batchNumber: string, docType: DocType, fileName: string): UploadedFileRecord | undefined {
    const key = this.getFileKey(batchNumber, docType, fileName);
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
  private isFileInHistory(batchNumber: string, docType: DocType, fileName: string): boolean {
    const key = this.getFileKey(batchNumber, docType, fileName);
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

  // Web helpers using the File System Access API
  private async ensureWebSubfolder(batchNumber: string, docType: DocType): Promise<FileSystemDirectoryHandle> {
    if (!this.dirHandle) throw new Error('No folder selected. Click Browse to choose a base folder.');
    const sanitizeBatch = batchNumber.toString().replace(/[^a-zA-Z0-9-_]/g, '_');
    const sanitizeDocType = docType.replace(/[^a-zA-Z0-9-_\s]/g, '_');
    const batchDir = await this.dirHandle.getDirectoryHandle(sanitizeBatch, { create: true });
    const typeDir = await batchDir.getDirectoryHandle(sanitizeDocType, { create: true });
    return typeDir;
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
    const fileName = this.generateFileName(record, docType, file.name, basePath);
    
    console.log('📁 Uploading to local storage:', {
      batchNumber,
      docType,
      fileName,
      folderPath: isElectron ? this.generateFolderPath(basePath, batchNumber, docType) : `(web folder)/${batchNumber}/${docType}`,
      fileSize: file.size
    });
    
    try {
      if (isElectron) {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const folderPath = this.generateFolderPath(basePath, batchNumber, docType);
        console.log('💾 Calling Electron IPC to save file...');
        const savedPath = await (window as any).electron.saveFile(folderPath, fileName, buffer);
        console.log('✅ File saved successfully:', savedPath);
      } else {
        // Web write to selected directory
        const targetDir = await this.ensureWebSubfolder(batchNumber, docType);
        const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        console.log('✅ File saved successfully in web folder');
      }

      // Record the upload
      const key = this.getFileKey(batchNumber, docType, fileName);
      const uploadRecord: UploadedFileRecord = {
        batchNumber,
        docType,
        fileName,
        uploadedAt: new Date().toISOString(),
        filePath: isElectron ? this.generateFolderPath(basePath, batchNumber, docType) + '/' + fileName : `${batchNumber}/${docType}/${fileName}`,
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
  public getUploadedFilesForBatch(batchNumber: string): UploadedFileRecord[] {
    return Array.from(this.uploadHistory.values()).filter(
      record => record.batchNumber === batchNumber
    );
  }

  /**
   * Get count of uploaded files for a specific batch and doc type
   */
  public getUploadedFileCount(batchNumber: string, docType: DocType): number {
    return Array.from(this.uploadHistory.values()).filter(
      record => record.batchNumber === batchNumber && record.docType === docType
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
      }
      return;
    }
    // Web: load persisted directory handle (if available)
    try {
      this.dirHandle = await getDirectoryHandle();
      await this.loadUploadHistory('');
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
