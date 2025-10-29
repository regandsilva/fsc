// AI-powered file name analyzer for automatic document distribution
import { FscRecord, DocType } from '../types';

export interface FileAnalysis {
  file: File;
  matchedBatch: string | null;
  matchedDocType: DocType | null;
  confidence: number; // 0-100
  reason: string;
  suggestions: Array<{ batch: string; docType: DocType; confidence: number }>;
  skipUpload: boolean; // User can mark file to not upload
  isDuplicate: boolean; // Flag if file already exists
  duplicateWarning?: string; // Warning message about duplicate
}

export interface BulkUploadPlan {
  analyses: FileAnalysis[];
  groupedByBatch: Map<string, Map<DocType, File[]>>;
  unmatchedFiles: File[];
  warnings: string[];
}

/**
 * Extract potential reference numbers from filename
 * Looks for batch numbers, PO numbers, SO numbers, and invoice numbers
 */
function extractReferenceNumbers(filename: string): {
  batchNumbers: string[];
  poNumbers: string[];
  soNumbers: string[];
  invoiceNumbers: string[];
} {
  const cleanName = filename.toLowerCase().replace(/\s+/g, '');
  
  const batchNumbers = new Set<string>();
  const poNumbers = new Set<string>();
  const soNumbers = new Set<string>();
  const invoiceNumbers = new Set<string>();

  // Extract FSC batch numbers
  const fscPatterns = [
    /FSC[_-]?(\d{3,6})/gi,
    /batch[_-]?(\d{3,6})/gi,
    /(\d{6})/g,
    /(\d{5})/g,
    /(\d{4})/g,
    /(\d{3})/g,
  ];

  for (const pattern of fscPatterns) {
    const matches = cleanName.matchAll(pattern);
    for (const match of matches) {
      const num = match[1] || match[0];
      if (num && num.length >= 3) {
        batchNumbers.add(num.replace(/^0+/, ''));
      }
    }
  }

  // Extract PO numbers - look for PO followed by numbers or alphanumeric
  const poPatterns = [
    /po[_-]?([a-z0-9]{3,15})/gi,
    /p\.?o\.?[_-]?([a-z0-9]{3,15})/gi,
    /purchase[_-]?order[_-]?([a-z0-9]{3,15})/gi,
  ];

  for (const pattern of poPatterns) {
    const matches = cleanName.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        poNumbers.add(match[1].toUpperCase());
      }
    }
  }

  // Extract SO numbers - look for SO followed by numbers or alphanumeric
  const soPatterns = [
    /so[_-]?([a-z0-9]{3,15})/gi,
    /s\.?o\.?[_-]?([a-z0-9]{3,15})/gi,
    /sales[_-]?order[_-]?([a-z0-9]{3,15})/gi,
  ];

  for (const pattern of soPatterns) {
    const matches = cleanName.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        soNumbers.add(match[1].toUpperCase());
      }
    }
  }

  // Extract invoice numbers - look for INV/INVOICE followed by numbers or alphanumeric
  const invPatterns = [
    /inv[_-]?([a-z0-9]{3,15})/gi,
    /invoice[_-]?([a-z0-9]{3,15})/gi,
  ];

  for (const pattern of invPatterns) {
    const matches = cleanName.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        invoiceNumbers.add(match[1].toUpperCase());
      }
    }
  }

  return {
    batchNumbers: Array.from(batchNumbers),
    poNumbers: Array.from(poNumbers),
    soNumbers: Array.from(soNumbers),
    invoiceNumbers: Array.from(invoiceNumbers),
  };
}

/**
 * Detect document type from filename
 */
function detectDocType(filename: string): Array<{ type: DocType; confidence: number }> {
  const lower = filename.toLowerCase();
  const results: Array<{ type: DocType; confidence: number }> = [];

  // Purchase Order patterns
  if (
    /\b(po|purchase.?order|p\.o\.?)\b/i.test(lower) ||
    /\bpo[_-]?\d+/i.test(lower)
  ) {
    results.push({ type: DocType.PO, confidence: 90 });
  }

  // Sales Order patterns
  if (
    /\b(so|sales.?order|s\.o\.?)\b/i.test(lower) ||
    /\bso[_-]?\d+/i.test(lower)
  ) {
    results.push({ type: DocType.SO, confidence: 90 });
  }

  // Supplier Invoice patterns
  if (
    /\b(supplier|vendor|purchase).?(invoice|inv)\b/i.test(lower) ||
    /\bsupp?.?(inv|invoice)\b/i.test(lower) ||
    /\binv.?in\b/i.test(lower)
  ) {
    results.push({ type: DocType.SupplierInvoice, confidence: 85 });
  }

  // Customer Invoice patterns
  if (
    /\b(customer|sales|client).?(invoice|inv)\b/i.test(lower) ||
    /\bcust?.?(inv|invoice)\b/i.test(lower) ||
    /\binv.?out\b/i.test(lower) ||
    (/\binvoice\b/i.test(lower) && !/supplier|vendor|purchase/i.test(lower))
  ) {
    results.push({ type: DocType.CustomerInvoice, confidence: 80 });
  }

  // Generic invoice (lower confidence)
  if (/\binv(oice)?\b/i.test(lower) && results.length === 0) {
    results.push({ type: DocType.CustomerInvoice, confidence: 50 });
    results.push({ type: DocType.SupplierInvoice, confidence: 50 });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Find best matching record from available records using PO, SO, and invoice numbers
 * NOTE: Batch numbers are NOT used for matching - only PO/SO references
 */
function findMatchingRecord(
  references: {
    batchNumbers: string[];
    poNumbers: string[];
    soNumbers: string[];
    invoiceNumbers: string[];
  },
  records: FscRecord[],
  detectedDocType: DocType | null
): Array<{ record: FscRecord; matchType: string; confidence: number }> {
  const matches: Array<{ record: FscRecord; matchType: string; confidence: number }> = [];

  for (const record of records) {
    const recordPO = String(record['PO REF'] || '').trim().toUpperCase();
    const recordSO = String(record['SO'] || '').trim().toUpperCase();
    
    // Match PO numbers (very high confidence for PO documents)
    if (recordPO && references.poNumbers.length > 0) {
      for (const extractedPO of references.poNumbers) {
        const cleanPO = extractedPO.toUpperCase();
        if (recordPO === cleanPO) {
          const conf = detectedDocType === DocType.PO ? 98 : 90;
          matches.push({ 
            record, 
            matchType: `PO: ${recordPO}`, 
            confidence: conf 
          });
        } else if (recordPO.includes(cleanPO) || cleanPO.includes(recordPO)) {
          const conf = detectedDocType === DocType.PO ? 85 : 75;
          matches.push({ 
            record, 
            matchType: `PO: ${recordPO} (partial)`, 
            confidence: conf 
          });
        }
      }
    }

    // Match SO numbers (very high confidence for SO documents)
    if (recordSO && references.soNumbers.length > 0) {
      for (const extractedSO of references.soNumbers) {
        const cleanSO = extractedSO.toUpperCase();
        if (recordSO === cleanSO) {
          const conf = detectedDocType === DocType.SO ? 98 : 90;
          matches.push({ 
            record, 
            matchType: `SO: ${recordSO}`, 
            confidence: conf 
          });
        } else if (recordSO.includes(cleanSO) || cleanSO.includes(recordSO)) {
          const conf = detectedDocType === DocType.SO ? 85 : 75;
          matches.push({ 
            record, 
            matchType: `SO: ${recordSO} (partial)`, 
            confidence: conf 
          });
        }
      }
    }
  }

  // Remove duplicates (keep highest confidence per record)
  const uniqueMatches = new Map<string, { record: FscRecord; matchType: string; confidence: number }>();
  
  for (const match of matches) {
    const key = String(match.record['Batch number']);
    const existing = uniqueMatches.get(key);
    
    if (!existing || match.confidence > existing.confidence) {
      uniqueMatches.set(key, match);
    }
  }

  // Sort by confidence and return top matches
  return Array.from(uniqueMatches.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/**
 * Analyze a single file
 */
export function analyzeFile(file: File, records: FscRecord[]): FileAnalysis {
  const filename = file.name;
  
  // Extract reference numbers (batch, PO, SO, invoice)
  const references = extractReferenceNumbers(filename);
  
  // Detect document type
  const docTypes = detectDocType(filename);
  const detectedDocType = docTypes.length > 0 ? docTypes[0].type : null;
  
  // Find matching records using all reference types
  const recordMatches = findMatchingRecord(references, records, detectedDocType);
  
  // Determine best match
  let matchedBatch: string | null = null;
  let matchedDocType: DocType | null = null;
  let confidence = 0;
  let reason = '';
  const suggestions: Array<{ batch: string; docType: DocType; confidence: number }> = [];

  if (recordMatches.length > 0 && docTypes.length > 0) {
    const bestMatch = recordMatches[0];
    matchedBatch = String(bestMatch.record['Batch number']);
    matchedDocType = docTypes[0].type;
    
    // Calculate combined confidence
    const matchConfidence = bestMatch.confidence;
    const docTypeConfidence = docTypes[0].confidence;
    confidence = Math.round((matchConfidence + docTypeConfidence) / 2);
    
    reason = `Matched via ${bestMatch.matchType} with ${matchConfidence}% confidence. `;
    reason += `Document type "${getDocTypeLabel(matchedDocType)}" detected with ${docTypeConfidence}% confidence.`;
    
    // Add PO/SO reference info to reason if available
    const po = bestMatch.record['PO REF'];
    const so = bestMatch.record['SO'];
    if (po) reason += ` PO: ${po}.`;
    if (so) reason += ` SO: ${so}.`;
    
    // Generate suggestions for alternative matches
    for (const match of recordMatches.slice(0, 3)) {
      for (const docType of docTypes.slice(0, 2)) {
        suggestions.push({
          batch: String(match.record['Batch number']),
          docType: docType.type,
          confidence: Math.round((match.confidence + docType.confidence) / 2),
        });
      }
    }
  } else if (recordMatches.length > 0) {
    // Found batch/PO/SO match but no doc type detected
    const bestMatch = recordMatches[0];
    matchedBatch = String(bestMatch.record['Batch number']);
    confidence = Math.round(bestMatch.confidence * 0.7); // Reduce confidence without doc type
    reason = `Matched via ${bestMatch.matchType} with ${bestMatch.confidence}% confidence, but document type unclear. Please select manually.`;
    
    const po = bestMatch.record['PO REF'];
    const so = bestMatch.record['SO'];
    if (po) reason += ` PO: ${po}.`;
    if (so) reason += ` SO: ${so}.`;
    
  } else if (docTypes.length > 0) {
    // Found doc type but no batch match
    matchedDocType = docTypes[0].type;
    confidence = Math.round(docTypes[0].confidence * 0.6); // Low confidence without batch match
    reason = `Document type "${getDocTypeLabel(matchedDocType)}" detected with ${docTypes[0].confidence}% confidence, but no matching PO/SO found. Please select batch manually.`;
  } else {
    // No matches found
    reason = 'Could not detect PO, SO, or document type from filename. Please assign manually.';
  }

  return {
    file,
    matchedBatch,
    matchedDocType,
    confidence,
    reason,
    suggestions: suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5),
    skipUpload: false, // Default: don't skip
    isDuplicate: false, // Will be checked later
  };
}

/**
 * Analyze multiple files and create upload plan
 */
export function createBulkUploadPlan(
  files: File[],
  records: FscRecord[]
): BulkUploadPlan {
  const analyses: FileAnalysis[] = [];
  const groupedByBatch = new Map<string, Map<DocType, File[]>>();
  const unmatchedFiles: File[] = [];
  const warnings: string[] = [];

  // Analyze each file
  for (const file of files) {
    const analysis = analyzeFile(file, records);
    analyses.push(analysis);

    if (analysis.matchedBatch && analysis.matchedDocType && analysis.confidence >= 60) {
      // Group by batch and doc type
      if (!groupedByBatch.has(analysis.matchedBatch)) {
        groupedByBatch.set(analysis.matchedBatch, new Map());
      }
      const batchGroup = groupedByBatch.get(analysis.matchedBatch)!;
      
      if (!batchGroup.has(analysis.matchedDocType)) {
        batchGroup.set(analysis.matchedDocType, []);
      }
      batchGroup.get(analysis.matchedDocType)!.push(file);
    } else {
      unmatchedFiles.push(file);
      warnings.push(`Low confidence match for "${file.name}": ${analysis.reason}`);
    }
  }

  // Check for potential issues
  for (const [batch, docTypes] of groupedByBatch) {
    for (const [docType, files] of docTypes) {
      if (files.length > 1) {
        warnings.push(
          `Multiple files (${files.length}) detected for ${batch} - ${docType}. ` +
          `This is normal for split POs/SOs.`
        );
      }
    }
  }

  if (unmatchedFiles.length > 0) {
    warnings.push(
      `${unmatchedFiles.length} file(s) could not be matched automatically. ` +
      `Please review and assign manually.`
    );
  }

  return {
    analyses,
    groupedByBatch,
    unmatchedFiles,
    warnings
  };
}

/**
 * Get document type label for display
 */
export function getDocTypeLabel(docType: DocType): string {
  switch (docType) {
    case DocType.PO: return 'Purchase Order';
    case DocType.SO: return 'Sales Order';
    case DocType.SupplierInvoice: return 'Supplier Invoice';
    case DocType.CustomerInvoice: return 'Customer Invoice';
    default: return docType;
  }
}
