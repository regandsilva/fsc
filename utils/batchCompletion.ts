import { DocType, FscRecord } from '../types';

export interface BatchCompletionStatus {
  batchNumber: string;
  totalRequired: number;
  totalUploaded: number;
  percentage: number;
  isComplete: boolean;
  missingDocTypes: DocType[];
  uploadedDocTypes: DocType[];
  details: {
    [key in DocType]: {
      required: boolean;
      uploaded: number;
    };
  };
}

/**
 * All document types that are typically required for a complete batch
 */
const REQUIRED_DOC_TYPES: DocType[] = [
  DocType.PO,
  DocType.SO,
  DocType.SupplierInvoice,
  DocType.CustomerInvoice,
];

/**
 * Calculate the completion status of a batch based on uploaded files
 * @param record - The FSC record
 * @param getUploadedCount - Function to get count of uploaded files for a doc type
 * @returns Completion status with detailed breakdown
 */
export function calculateBatchCompletion(
  record: FscRecord,
  getUploadedCount: (batchNumber: string, docType: DocType) => number
): BatchCompletionStatus {
  const batchNumber = String(record['Batch number']);
  
  const details: BatchCompletionStatus['details'] = {
    [DocType.PO]: { required: true, uploaded: 0 },
    [DocType.SO]: { required: true, uploaded: 0 },
    [DocType.SupplierInvoice]: { required: true, uploaded: 0 },
    [DocType.CustomerInvoice]: { required: true, uploaded: 0 },
  };

  // Get upload counts for each doc type
  let totalUploaded = 0;
  const missingDocTypes: DocType[] = [];
  const uploadedDocTypes: DocType[] = [];

  for (const docType of REQUIRED_DOC_TYPES) {
    const count = getUploadedCount(batchNumber, docType);
    details[docType].uploaded = count;
    
    if (count > 0) {
      uploadedDocTypes.push(docType);
      totalUploaded++;
    } else {
      missingDocTypes.push(docType);
    }
  }

  const totalRequired = REQUIRED_DOC_TYPES.length;
  const percentage = Math.round((totalUploaded / totalRequired) * 100);
  const isComplete = totalUploaded === totalRequired;

  return {
    batchNumber,
    totalRequired,
    totalUploaded,
    percentage,
    isComplete,
    missingDocTypes,
    uploadedDocTypes,
    details,
  };
}

/**
 * Check if a batch has a specific document type uploaded
 */
export function hasMissingDocType(
  completion: BatchCompletionStatus,
  docType: DocType
): boolean {
  return completion.missingDocTypes.includes(docType);
}

/**
 * Check if a batch has any missing documents
 */
export function hasAnyMissingDocs(completion: BatchCompletionStatus): boolean {
  return completion.missingDocTypes.length > 0;
}

/**
 * Get a user-friendly summary of batch completion
 */
export function getCompletionSummary(completion: BatchCompletionStatus): string {
  if (completion.isComplete) {
    return 'Complete';
  }
  
  if (completion.totalUploaded === 0) {
    return 'No documents uploaded';
  }

  const missing = completion.missingDocTypes
    .map(dt => {
      switch (dt) {
        case DocType.PO: return 'PO';
        case DocType.SO: return 'SO';
        case DocType.SupplierInvoice: return 'Supplier Inv';
        case DocType.CustomerInvoice: return 'Customer Inv';
        default: return dt;
      }
    })
    .join(', ');

  return `Missing: ${missing}`;
}
