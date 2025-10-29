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
  // Use word boundaries to avoid partial matches
  const poPatterns = [
    /\bpo[-_]?([a-z0-9]{3,15})\b/gi,
    /\bp\.?o\.?[-_]?([a-z0-9]{3,15})\b/gi,
    /\bpurchase[-_]?order[-_]?([a-z0-9]{3,15})\b/gi,
  ];

  for (const pattern of poPatterns) {
    const matches = filename.matchAll(pattern);  // Use original filename, not cleanName
    for (const match of matches) {
      if (match[1]) {
        const poNum = match[1].toUpperCase();
        // Filter out obvious non-PO patterns
        if (!poNum.startsWith('SO') && !poNum.startsWith('INV')) {
          poNumbers.add(poNum);
        }
      }
    }
  }

  // Extract SO numbers - look for SO followed by numbers or alphanumeric
  // Also handle formats like ROX1371-3, PNFS1346-5, JLOV1293-11, JLOV1293-11A
  const soPatterns = [
    /so[_-]?([a-z0-9]{3,15})/gi,
    /s\.?o\.?[_-]?([a-z0-9]{3,15})/gi,
    /sales[_-]?order[_-]?([a-z0-9]{3,15})/gi,
    // Specific patterns for common SO formats
    /\b(JLOV\d+[-_]?\d*[A-Z]?)\b/gi,  // JLOV1293-11, JLOV1293-11A
    /\b(ROX\d+[-_]?\d*)\b/gi,         // ROX1371-3
    /\b(PNFS\d+[-_]?\d*)\b/gi,        // PNFS1346-5
    // Generic pattern: 2-4 letters + 3-6 digits + optional dash/number + optional letter suffix
    /\b([A-Z]{2,4}\d{3,6}[-_]?\d*[A-Z]?)\b/gi,
  ];

  for (const pattern of soPatterns) {
    const matches = cleanName.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        const soNum = match[1].toUpperCase();
        // Filter out obvious non-SO patterns
        if (!soNum.startsWith('PO') && !soNum.startsWith('INV')) {
          soNumbers.add(soNum);
        }
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
 * Detect document type from filename with enhanced pattern recognition
 */
function detectDocType(filename: string, references?: {
  batchNumbers: string[];
  poNumbers: string[];
  soNumbers: string[];
  invoiceNumbers: string[];
}): Array<{ type: DocType; confidence: number }> {
  const lower = filename.toLowerCase();
  const results: Array<{ type: DocType; confidence: number }> = [];

  // Check if we have SO numbers extracted - if so, very likely a Sales Order
  const hasSONumber = references && references.soNumbers.length > 0;
  const hasPONumber = references && references.poNumbers.length > 0;
  const hasInvoiceNumber = references && references.invoiceNumbers.length > 0;

  // Sales Order patterns - CHECK FIRST for specific formats
  // JLOV, ROX, PNFS style sales orders (alphanumeric code + dash + numbers)
  if (
    /\b(JLOV\d+[-_]?\d*[A-Z]?)\b/i.test(filename) ||
    /\b(ROX\d+[-_]?\d*)\b/i.test(filename) ||
    /\b(PNFS\d+[-_]?\d*)\b/i.test(filename) ||
    /\b([A-Z]{3,4}\d{3,6}[-_]?\d+[A-Z]?)\b/i.test(filename) // Generic: 3-4 letters + digits + dash/number
  ) {
    results.push({ type: DocType.SO, confidence: 95 });
  }
  // If we extracted an SO number, assume it's a Sales Order
  else if (hasSONumber && !hasPONumber) {
    results.push({ type: DocType.SO, confidence: 90 });
  }
  // Traditional SO keywords
  else if (
    /\b(so|sales.?order|s\.o\.?)\b/i.test(lower) ||
    /\bso[_-]?\d+/i.test(lower)
  ) {
    results.push({ type: DocType.SO, confidence: 90 });
  }

  // Purchase Order patterns
  if (
    /\b(po|purchase.?order|p\.o\.?)\b/i.test(lower) ||
    /\bpo[_-]?\d+/i.test(lower)
  ) {
    results.push({ type: DocType.PO, confidence: 90 });
  }
  // If we have PO number but not SO, likely a PO
  else if (hasPONumber && !hasSONumber && !hasInvoiceNumber) {
    results.push({ type: DocType.PO, confidence: 85 });
  }

  // Supplier Invoice patterns
  if (
    /\b(supplier|vendor|purchase).?(invoice|inv)\b/i.test(lower) ||
    /\bsupp?.?(inv|invoice)\b/i.test(lower) ||
    /\binv.?in\b/i.test(lower) ||
    /\bpurchase.?inv/i.test(lower)
  ) {
    results.push({ type: DocType.SupplierInvoice, confidence: 85 });
  }
  // If has invoice keyword with PO reference, likely supplier invoice
  else if (hasInvoiceNumber && hasPONumber) {
    results.push({ type: DocType.SupplierInvoice, confidence: 80 });
  }

  // Customer Invoice patterns
  if (
    /\b(customer|sales|client).?(invoice|inv)\b/i.test(lower) ||
    /\bcust?.?(inv|invoice)\b/i.test(lower) ||
    /\binv.?out\b/i.test(lower) ||
    /\bsales.?inv/i.test(lower) ||
    (/\binvoice\b/i.test(lower) && !/supplier|vendor|purchase/i.test(lower))
  ) {
    results.push({ type: DocType.CustomerInvoice, confidence: 80 });
  }
  // If has invoice keyword with SO reference, likely customer invoice
  else if (hasInvoiceNumber && hasSONumber) {
    results.push({ type: DocType.CustomerInvoice, confidence: 80 });
  }

  // Generic invoice (lower confidence) - only if no specific type detected
  if (/\b(inv|invoice)\b/i.test(lower) && results.length === 0) {
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
        
        // Normalize both for comparison - strip common prefixes
        const normalizeRefNum = (num: string) => {
          const normalized = num.toUpperCase().trim();
          // Remove common prefixes: PO-, PO, P.O., P.O-
          return normalized
            .replace(/^PO[-_]?/i, '')
            .replace(/^P\.?O\.?[-_]?/i, '');
        };
        
        const normalizedRecord = normalizeRefNum(recordPO);
        const normalizedExtracted = normalizeRefNum(cleanPO);
        
        // Exact match (after normalization)
        if (normalizedRecord === normalizedExtracted) {
          const conf = detectedDocType === DocType.PO ? 98 : 95;
          matches.push({ 
            record, 
            matchType: `PO: ${recordPO}`, 
            confidence: conf 
          });
        } 
        // Letter suffix variant (e.g., PO-1544A matches PO-1544)
        else if (normalizedExtracted.match(/^(.+)([A-Z])$/) && normalizedRecord === normalizedExtracted.slice(0, -1)) {
          const conf = detectedDocType === DocType.PO ? 95 : 90;
          matches.push({ 
            record, 
            matchType: `PO: ${recordPO} (letter suffix variant)`, 
            confidence: conf 
          });
        }
        // Reverse: record has letter suffix
        else if (normalizedRecord.match(/^(.+)([A-Z])$/) && normalizedExtracted === normalizedRecord.slice(0, -1)) {
          const conf = detectedDocType === DocType.PO ? 95 : 90;
          matches.push({ 
            record, 
            matchType: `PO: ${recordPO} (letter suffix variant)`, 
            confidence: conf 
          });
        }
        // ONLY do substring matching for very close matches with prefix at start
        else {
          const lengthDiff = Math.abs(normalizedRecord.length - normalizedExtracted.length);
          
          // Only match if:
          // 1. Both numbers are EXACTLY the same length (no partial matches)
          // 2. OR one has a single extra character that's clearly a version/suffix
          // This prevents 154 from matching 1544
          
          if (lengthDiff === 0) {
            // Already handled by exact match above
          } else if (lengthDiff === 1) {
            // Only allow if the extra character is non-numeric (like a version letter)
            const shorter = normalizedRecord.length < normalizedExtracted.length ? normalizedRecord : normalizedExtracted;
            const longer = normalizedRecord.length < normalizedExtracted.length ? normalizedExtracted : normalizedRecord;
            const extraChar = longer[longer.length - 1];
            
            // Only match if:
            // - Extra character is a letter (not a digit)
            // - AND shorter is the full prefix of longer
            if (!/\d/.test(extraChar) && longer.startsWith(shorter) && longer === shorter + extraChar) {
              const conf = detectedDocType === DocType.PO ? 80 : 70;
              matches.push({ 
                record, 
                matchType: `PO: ${recordPO} (close match)`, 
                confidence: conf 
              });
            }
          }
          // No substring matching allowed - prevents 154 matching 1544
        }
      }
    }

    // Match SO numbers (very high confidence for SO documents)
    if (recordSO && references.soNumbers.length > 0) {
      for (const extractedSO of references.soNumbers) {
        const cleanSO = extractedSO.toUpperCase();
        
        // Exact match - highest confidence
        if (recordSO === cleanSO) {
          const conf = detectedDocType === DocType.SO ? 98 : 95;
          matches.push({ 
            record, 
            matchType: `SO: ${recordSO}`, 
            confidence: conf 
          });
        } 
        // Letter suffix variant (e.g., JLOV1293-11A matches JLOV1293-11)
        else if (cleanSO.match(/^(.+)([A-Z])$/) && recordSO === cleanSO.slice(0, -1)) {
          const conf = detectedDocType === DocType.SO ? 95 : 90;
          matches.push({ 
            record, 
            matchType: `SO: ${recordSO} (letter suffix variant)`, 
            confidence: conf 
          });
        }
        // Reverse: record has letter suffix, filename doesn't (e.g., JLOV1293-11 matches JLOV1293-11A)
        else if (recordSO.match(/^(.+)([A-Z])$/) && cleanSO === recordSO.slice(0, -1)) {
          const conf = detectedDocType === DocType.SO ? 95 : 90;
          matches.push({ 
            record, 
            matchType: `SO: ${recordSO} (letter suffix variant)`, 
            confidence: conf 
          });
        }
        // Number suffix variant (e.g., JLOV1293-11-1 matches JLOV1293-11)
        else if (cleanSO.match(/^(.+)[-_](\d+)$/) && recordSO === cleanSO.replace(/[-_]\d+$/, '')) {
          const conf = detectedDocType === DocType.SO ? 92 : 85;
          matches.push({ 
            record, 
            matchType: `SO: ${recordSO} (sub-split variant)`, 
            confidence: conf 
          });
        }
        // Reverse: record has number suffix
        else if (recordSO.match(/^(.+)[-_](\d+)$/) && cleanSO === recordSO.replace(/[-_]\d+$/, '')) {
          const conf = detectedDocType === DocType.SO ? 92 : 85;
          matches.push({ 
            record, 
            matchType: `SO: ${recordSO} (sub-split variant)`, 
            confidence: conf 
          });
        }
        // Base match ONLY if the numbers after dash are different by 1-2
        // (e.g., JLOV1293-11 and JLOV1293-12 might be related, but JLOV1293-11 and JLOV1293-14 are probably not)
        else {
          const extractBase = (str: string) => {
            const match = str.match(/^([A-Z]+\d+)[-_]?(\d+)?([A-Z])?$/i);
            if (match) {
              return {
                prefix: match[1],        // JLOV1293
                number: match[2] ? parseInt(match[2]) : null,  // 11, 14, etc.
                suffix: match[3] || null // A, B, etc.
              };
            }
            return null;
          };
          
          const baseRecord = extractBase(recordSO);
          const baseExtracted = extractBase(cleanSO);
          
          // If base prefix matches and numbers are close (within 2)
          if (baseRecord && baseExtracted && 
              baseRecord.prefix === baseExtracted.prefix &&
              baseRecord.number !== null && baseExtracted.number !== null) {
            
            const numberDiff = Math.abs(baseRecord.number - baseExtracted.number);
            
            // Only match if numbers are very close (within 2)
            if (numberDiff <= 2 && numberDiff > 0) {
              const conf = detectedDocType === DocType.SO ? 75 : 65;
              matches.push({ 
                record, 
                matchType: `SO: ${recordSO} (related order)`, 
                confidence: conf 
              });
            }
          }
          // Otherwise, check for general substring match (lowest priority)
          else if (recordSO.includes(cleanSO) || cleanSO.includes(recordSO)) {
            const conf = detectedDocType === DocType.SO ? 70 : 60;
            matches.push({ 
              record, 
              matchType: `SO: ${recordSO} (partial)`, 
              confidence: conf 
            });
          }
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
 * Analyze a single file with enhanced intelligence
 */
export function analyzeFile(file: File, records: FscRecord[]): FileAnalysis {
  const filename = file.name;
  
  // Extract reference numbers (batch, PO, SO, invoice)
  const references = extractReferenceNumbers(filename);
  
  // Detect document type - NOW PASS REFERENCES for context-aware detection
  const docTypes = detectDocType(filename, references);
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
    
    // Calculate combined confidence with boost for exact matches
    const matchConfidence = bestMatch.confidence;
    const docTypeConfidence = docTypes[0].confidence;
    
    // BOOST: If we have exact SO/PO match AND detected doc type, high confidence
    const isExactMatch = bestMatch.matchType.includes('SO:') || bestMatch.matchType.includes('PO:');
    const hasNoPartialFlag = !bestMatch.matchType.includes('(partial)');
    
    if (isExactMatch && hasNoPartialFlag && docTypeConfidence >= 85) {
      confidence = Math.min(98, Math.round((matchConfidence * 0.6) + (docTypeConfidence * 0.4)));
    } else {
      confidence = Math.round((matchConfidence + docTypeConfidence) / 2);
    }
    
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
    
    // IMPROVEMENT: Infer document type from what we matched
    if (bestMatch.matchType.includes('SO:')) {
      matchedDocType = DocType.SO;
      confidence = Math.round(bestMatch.confidence * 0.9); // High confidence if SO matched
      reason = `Matched via ${bestMatch.matchType}. Auto-detected as Sales Order based on SO number match.`;
    } else if (bestMatch.matchType.includes('PO:')) {
      matchedDocType = DocType.PO;
      confidence = Math.round(bestMatch.confidence * 0.9); // High confidence if PO matched
      reason = `Matched via ${bestMatch.matchType}. Auto-detected as Purchase Order based on PO number match.`;
    } else {
      confidence = Math.round(bestMatch.confidence * 0.7); // Reduce confidence without doc type
      reason = `Matched via ${bestMatch.matchType} with ${bestMatch.confidence}% confidence, but document type unclear. Please select manually.`;
    }
    
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

    // Determine confidence threshold based on match quality
    // - Exact SO/PO match: 60% threshold (default)
    // - Letter suffix variant: 70% threshold
    // - Close match or related order: 85% threshold (strict - these are risky)
    let confidenceThreshold = 60;
    
    if (analysis.reason.includes('(related order)') || analysis.reason.includes('(close match)')) {
      confidenceThreshold = 85; // Related orders and close matches need high confidence
    } else if (analysis.reason.includes('(letter suffix variant)') || analysis.reason.includes('(sub-split variant)')) {
      confidenceThreshold = 70; // Suffix variants need decent confidence
    } else if (analysis.reason.includes('Auto-detected')) {
      confidenceThreshold = 70; // Auto-inferred types need decent confidence
    } else if (analysis.reason.includes('(partial)')) {
      confidenceThreshold = 85; // Partial matches are risky
    }

    if (analysis.matchedBatch && analysis.matchedDocType && analysis.confidence >= confidenceThreshold) {
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
      
      // Better warning messages
      if (analysis.confidence > 0 && analysis.confidence < confidenceThreshold) {
        warnings.push(`Low confidence (${analysis.confidence}%) for "${file.name}": ${analysis.reason}`);
      } else {
        warnings.push(`Could not match "${file.name}": ${analysis.reason}`);
      }
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
