/**
 * Multi-File Relationship Detection for FSC Document Hub
 * 
 * Identifies relationships between files:
 * - Multiple files belonging to same PO/SO
 * - Document sequences (Page 1 of 3, Page 2 of 3, etc.)
 * - Related document types (PO + matching invoices)
 * - Split documents (single PO across multiple PDFs)
 * 
 * Benefits:
 * - Automatically group related files
 * - Suggest uploading as a complete set
 * - Prevent incomplete uploads
 * - Better document organization
 */

import { FscRecord, DocType } from '../types';

export interface FileRelationship {
  groupId: string; // Unique identifier for the relationship group
  relationshipType: 'same-po' | 'same-so' | 'sequence' | 'po-invoice-set' | 'so-invoice-set';
  files: Array<{
    file: File;
    fileName: string;
    detectedReference: string; // PO/SO number
    sequenceNumber?: number; // For "Page 1 of 3" type files
    totalInSequence?: number; // For "Page 1 of 3" type files
    docType?: DocType;
  }>;
  confidence: number; // 0-100 confidence that these files are related
  completeness: {
    isComplete: boolean;
    expectedCount?: number; // If sequence detected
    missingItems?: string[]; // E.g., "Page 2 missing"
  };
  suggestion: string; // Human-readable suggestion
  warnings?: string[]; // Potential issues
}

export interface RelationshipAnalysis {
  groups: FileRelationship[];
  orphanedFiles: File[]; // Files with no detected relationships
  summary: {
    totalGroups: number;
    completeGroups: number;
    incompleteGroups: number;
    orphanedCount: number;
  };
}

/**
 * Analyze multiple files for relationships
 */
export function detectFileRelationships(
  files: File[],
  extractedReferences?: Map<File, { po?: string[]; so?: string[]; batch?: string[] }>
): RelationshipAnalysis {
  console.log(`🔗 Analyzing ${files.length} files for relationships...`);
  
  const groups: FileRelationship[] = [];
  const processedFiles = new Set<File>();
  
  // Extract references if not provided
  const references = extractedReferences || extractReferencesFromFiles(files);
  
  // Group by PO number
  const poGroups = groupByReference(files, references, 'po');
  for (const [poNumber, groupFiles] of poGroups.entries()) {
    if (groupFiles.length > 1) {
      const group = createRelationshipGroup(
        'same-po',
        poNumber,
        groupFiles,
        references
      );
      groups.push(group);
      groupFiles.forEach(f => processedFiles.add(f));
    }
  }
  
  // Group by SO number
  const soGroups = groupByReference(files, references, 'so');
  for (const [soNumber, groupFiles] of soGroups.entries()) {
    if (groupFiles.length > 1) {
      const group = createRelationshipGroup(
        'same-so',
        soNumber,
        groupFiles,
        references
      );
      groups.push(group);
      groupFiles.forEach(f => processedFiles.add(f));
    }
  }
  
  // Detect document sequences (Page 1 of 3, etc.)
  const sequenceGroups = detectSequences(files.filter(f => !processedFiles.has(f)));
  for (const group of sequenceGroups) {
    groups.push(group);
    group.files.forEach(f => processedFiles.add(f.file));
  }
  
  // Detect PO + Invoice sets
  const poInvoiceSets = detectPoInvoiceSets(files, references);
  for (const group of poInvoiceSets) {
    // Only add if files aren't already in other groups
    const newFiles = group.files.filter(f => !processedFiles.has(f.file));
    if (newFiles.length > 1) {
      groups.push({
        ...group,
        files: newFiles,
      });
      newFiles.forEach(f => processedFiles.add(f.file));
    }
  }
  
  // Orphaned files
  const orphanedFiles = files.filter(f => !processedFiles.has(f));
  
  // Calculate summary
  const completeGroups = groups.filter(g => g.completeness.isComplete).length;
  const incompleteGroups = groups.length - completeGroups;
  
  console.log(`✅ Found ${groups.length} relationship groups (${completeGroups} complete, ${incompleteGroups} incomplete)`);
  console.log(`📄 ${orphanedFiles.length} orphaned files`);
  
  return {
    groups,
    orphanedFiles,
    summary: {
      totalGroups: groups.length,
      completeGroups,
      incompleteGroups,
      orphanedCount: orphanedFiles.length,
    },
  };
}

/**
 * Extract PO/SO/Batch references from filenames
 */
function extractReferencesFromFiles(
  files: File[]
): Map<File, { po?: string[]; so?: string[]; batch?: string[] }> {
  const references = new Map<File, { po?: string[]; so?: string[]; batch?: string[] }>();
  
  for (const file of files) {
    const fileName = file.name;
    const extracted: { po?: string[]; so?: string[]; batch?: string[] } = {};
    
    // Extract PO numbers
    const poMatches = [
      ...fileName.matchAll(/\b(?:PO|P\.O\.?|Purchase[_\s-]*Order)[_\s-]*(\d{3,6}[A-Z]?)/gi),
      ...fileName.matchAll(/\bPO[_-]?(\d{3,6}[A-Z]?)\b/gi),
    ];
    if (poMatches.length > 0) {
      extracted.po = [...new Set(poMatches.map(m => m[1].toUpperCase()))];
    }
    
    // Extract SO numbers
    const soMatches = [
      ...fileName.matchAll(/\b(?:SO|S\.O\.?|Sales[_\s-]*Order)[_\s-]*(\d{3,6})/gi),
      ...fileName.matchAll(/\b((?:JLOV|ROX|PNFS|HLOV)\d{3,6}(?:-\d{1,3})?)/gi),
      ...fileName.matchAll(/\b([A-Z]{2,4}\d{3,6}(?:-\d{1,3})?)\b/g),
    ];
    if (soMatches.length > 0) {
      extracted.so = [...new Set(soMatches.map(m => m[1].toUpperCase()))];
    }
    
    // Extract batch numbers
    const batchMatches = [
      ...fileName.matchAll(/\b(?:FSC[_-]?|Batch[_\s-]*)(\d{3,6})\b/gi),
      ...fileName.matchAll(/\b(\d{4,6})\b/g), // Generic 4-6 digit numbers
    ];
    if (batchMatches.length > 0) {
      extracted.batch = [...new Set(batchMatches.map(m => m[1]))];
    }
    
    if (Object.keys(extracted).length > 0) {
      references.set(file, extracted);
    }
  }
  
  return references;
}

/**
 * Group files by a specific reference type (PO, SO, or Batch)
 */
function groupByReference(
  files: File[],
  references: Map<File, { po?: string[]; so?: string[]; batch?: string[] }>,
  refType: 'po' | 'so' | 'batch'
): Map<string, File[]> {
  const groups = new Map<string, File[]>();
  
  for (const file of files) {
    const refs = references.get(file);
    if (!refs) continue;
    
    const refNumbers = refs[refType];
    if (!refNumbers || refNumbers.length === 0) continue;
    
    // Add file to all matching reference groups
    for (const refNumber of refNumbers) {
      const normalized = normalizeReference(refNumber, refType);
      if (!groups.has(normalized)) {
        groups.set(normalized, []);
      }
      groups.get(normalized)!.push(file);
    }
  }
  
  return groups;
}

/**
 * Normalize reference numbers for comparison
 */
function normalizeReference(ref: string, type: 'po' | 'so' | 'batch'): string {
  // Remove common prefixes
  let normalized = ref.toUpperCase()
    .replace(/^PO[_-]?/, '')
    .replace(/^SO[_-]?/, '')
    .replace(/^FSC[_-]?/, '')
    .replace(/^BATCH[_-]?/, '');
  
  // For SO numbers, keep the full format including suffixes
  if (type === 'so') {
    return normalized;
  }
  
  // For PO numbers, remove letter suffixes for grouping (PO-1544A -> 1544)
  if (type === 'po') {
    normalized = normalized.replace(/[A-Z]+$/, '');
  }
  
  return normalized;
}

/**
 * Create a relationship group
 */
function createRelationshipGroup(
  type: 'same-po' | 'same-so' | 'sequence' | 'po-invoice-set' | 'so-invoice-set',
  referenceNumber: string,
  files: File[],
  references: Map<File, { po?: string[]; so?: string[]; batch?: string[] }>
): FileRelationship {
  const groupFiles = files.map(file => {
    const refs = references.get(file);
    const detectedRef = type === 'same-po' 
      ? (refs?.po?.[0] || referenceNumber)
      : type === 'same-so'
      ? (refs?.so?.[0] || referenceNumber)
      : referenceNumber;
    
    return {
      file,
      fileName: file.name,
      detectedReference: detectedRef,
    };
  });
  
  // Detect if this is a complete set
  const sequenceInfo = detectSequenceInfo(files);
  const isComplete = sequenceInfo.isComplete;
  
  let suggestion = '';
  const warnings: string[] = [];
  
  if (type === 'same-po') {
    suggestion = `${files.length} files belong to PO ${referenceNumber}`;
    if (!isComplete && sequenceInfo.missingItems) {
      warnings.push(`Possibly incomplete: ${sequenceInfo.missingItems.join(', ')}`);
    }
  } else if (type === 'same-so') {
    suggestion = `${files.length} files belong to SO ${referenceNumber}`;
    if (!isComplete && sequenceInfo.missingItems) {
      warnings.push(`Possibly incomplete: ${sequenceInfo.missingItems.join(', ')}`);
    }
  }
  
  return {
    groupId: `${type}-${referenceNumber}`,
    relationshipType: type,
    files: groupFiles,
    confidence: 90, // High confidence for reference-based grouping
    completeness: {
      isComplete,
      expectedCount: sequenceInfo.expectedCount,
      missingItems: sequenceInfo.missingItems,
    },
    suggestion,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Detect document sequences (Page 1 of 3, Part 1, etc.)
 */
function detectSequences(files: File[]): FileRelationship[] {
  const sequenceGroups: FileRelationship[] = [];
  const processedFiles = new Set<File>();
  
  // Common sequence patterns
  const patterns = [
    /(?:page|pg|p)[\s_-]*(\d+)[\s_-]*(?:of|\/)?[\s_-]*(\d+)/i,
    /(?:part|pt)[\s_-]*(\d+)[\s_-]*(?:of|\/)?[\s_-]*(\d+)/i,
    /\((\d+)[\s_-]*of[\s_-]*(\d+)\)/i,
    /_(\d+)_of_(\d+)/i,
  ];
  
  // Group files by base name (without sequence numbers)
  const baseNameGroups = new Map<string, Array<{
    file: File;
    sequence: number;
    total: number;
  }>>();
  
  for (const file of files) {
    if (processedFiles.has(file)) continue;
    
    const fileName = file.name;
    let matched = false;
    
    for (const pattern of patterns) {
      const match = fileName.match(pattern);
      if (match) {
        const sequence = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        
        // Remove sequence info to get base name
        const baseName = fileName.replace(pattern, '').trim();
        
        if (!baseNameGroups.has(baseName)) {
          baseNameGroups.set(baseName, []);
        }
        
        baseNameGroups.get(baseName)!.push({
          file,
          sequence,
          total,
        });
        
        matched = true;
        processedFiles.add(file);
        break;
      }
    }
  }
  
  // Create groups from base name matches
  for (const [baseName, fileInfos] of baseNameGroups.entries()) {
    if (fileInfos.length > 1) {
      // Sort by sequence number
      fileInfos.sort((a, b) => a.sequence - b.sequence);
      
      const expectedTotal = fileInfos[0].total;
      const sequences = fileInfos.map(f => f.sequence);
      const missingSequences: number[] = [];
      
      for (let i = 1; i <= expectedTotal; i++) {
        if (!sequences.includes(i)) {
          missingSequences.push(i);
        }
      }
      
      const isComplete = missingSequences.length === 0 && fileInfos.length === expectedTotal;
      
      sequenceGroups.push({
        groupId: `sequence-${baseName}`,
        relationshipType: 'sequence',
        files: fileInfos.map(fi => ({
          file: fi.file,
          fileName: fi.file.name,
          detectedReference: baseName,
          sequenceNumber: fi.sequence,
          totalInSequence: fi.total,
        })),
        confidence: 95, // Very high confidence for explicit sequences
        completeness: {
          isComplete,
          expectedCount: expectedTotal,
          missingItems: missingSequences.length > 0
            ? missingSequences.map(n => `Page ${n}`)
            : undefined,
        },
        suggestion: isComplete
          ? `Complete sequence: ${fileInfos.length} pages`
          : `Incomplete sequence: ${fileInfos.length} of ${expectedTotal} pages`,
        warnings: !isComplete
          ? [`Missing pages: ${missingSequences.join(', ')}`]
          : undefined,
      });
    }
  }
  
  return sequenceGroups;
}

/**
 * Detect sequence information from file names
 */
function detectSequenceInfo(files: File[]): {
  isComplete: boolean;
  expectedCount?: number;
  missingItems?: string[];
} {
  // Check for explicit sequence markers
  const sequencePattern = /(?:page|pg|p|part|pt)[\s_-]*(\d+)[\s_-]*(?:of|\/)?[\s_-]*(\d+)/i;
  
  let expectedCount: number | undefined;
  const foundNumbers: number[] = [];
  
  for (const file of files) {
    const match = file.name.match(sequencePattern);
    if (match) {
      const num = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      foundNumbers.push(num);
      expectedCount = total;
    }
  }
  
  if (expectedCount !== undefined && foundNumbers.length > 0) {
    const missing: number[] = [];
    for (let i = 1; i <= expectedCount; i++) {
      if (!foundNumbers.includes(i)) {
        missing.push(i);
      }
    }
    
    return {
      isComplete: missing.length === 0 && foundNumbers.length === expectedCount,
      expectedCount,
      missingItems: missing.length > 0 ? missing.map(n => `Page ${n}`) : undefined,
    };
  }
  
  // No explicit sequence detected
  return {
    isComplete: true, // Assume complete if no sequence markers
  };
}

/**
 * Detect PO + Invoice sets (PO with matching supplier invoices)
 */
function detectPoInvoiceSets(
  files: File[],
  references: Map<File, { po?: string[]; so?: string[]; batch?: string[] }>
): FileRelationship[] {
  const sets: FileRelationship[] = [];
  
  // Group files by PO number
  const poGroups = groupByReference(files, references, 'po');
  
  for (const [poNumber, groupFiles] of poGroups.entries()) {
    // Check if group contains both PO and invoice files
    const poFiles: File[] = [];
    const invoiceFiles: File[] = [];
    
    for (const file of groupFiles) {
      const fileName = file.name.toLowerCase();
      if (fileName.includes('invoice') || fileName.includes('inv')) {
        invoiceFiles.push(file);
      } else if (fileName.includes('po') || fileName.includes('purchase') || fileName.includes('order')) {
        poFiles.push(file);
      }
    }
    
    // If we have both PO and invoices, create a relationship
    if (poFiles.length > 0 && invoiceFiles.length > 0) {
      sets.push({
        groupId: `po-invoice-${poNumber}`,
        relationshipType: 'po-invoice-set',
        files: [...poFiles, ...invoiceFiles].map(file => ({
          file,
          fileName: file.name,
          detectedReference: poNumber,
          docType: file.name.toLowerCase().includes('invoice')
            ? DocType.SupplierInvoice
            : DocType.PO,
        })),
        confidence: 85,
        completeness: {
          isComplete: true, // We have at least one of each
        },
        suggestion: `PO ${poNumber} with ${invoiceFiles.length} related invoice(s)`,
      });
    }
  }
  
  return sets;
}

/**
 * Check if files should be uploaded as a group
 */
export function suggestGroupUpload(
  analysis: RelationshipAnalysis
): {
  shouldUploadAsGroup: boolean;
  groups: FileRelationship[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const groupsToUpload: FileRelationship[] = [];
  
  for (const group of analysis.groups) {
    if (group.files.length > 1) {
      groupsToUpload.push(group);
      
      if (!group.completeness.isComplete) {
        warnings.push(
          `⚠️ ${group.suggestion} - ${group.completeness.missingItems?.join(', ') || 'potentially incomplete'}`
        );
      }
    }
  }
  
  return {
    shouldUploadAsGroup: groupsToUpload.length > 0,
    groups: groupsToUpload,
    warnings,
  };
}
