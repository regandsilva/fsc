/**
 * Visual Similarity Detection for FSC Document Hub
 * 
 * Detects duplicate documents based on visual characteristics:
 * - PDF page count and structure
 * - Image similarity using simple perceptual hashing
 * - File type and format analysis
 * 
 * This helps identify:
 * - Renamed duplicates (same document, different filename)
 * - Scanned vs digital versions
 * - Version differences (pages added/removed)
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Constants for visual similarity thresholds
const PAGE_COUNT_MATCH_THRESHOLD = 0.9; // 90% page count match
const STRUCTURE_MATCH_THRESHOLD = 0.85; // 85% structural similarity
const IMAGE_HASH_MATCH_THRESHOLD = 0.92; // 92% perceptual hash match
const MIN_CONFIDENCE_FOR_VISUAL_DUPLICATE = 75; // Minimum confidence to report as duplicate

export interface VisualSimilarityResult {
  similarity: number; // 0-100 confidence score
  matchType: 'identical-structure' | 'similar-structure' | 'different-pages' | 'different-format' | 'no-match';
  details: {
    pageCountMatch?: number; // 0-100
    structureMatch?: number; // 0-100
    imageHashMatch?: number; // 0-100
    pageCountDiff?: number; // Difference in page count
    reasonText: string; // Human-readable explanation
  };
  isDuplicate: boolean; // True if confidence >= threshold
}

export interface FileFingerprint {
  fileName: string;
  fileType: string; // 'pdf', 'image', 'other'
  fileSize: number;
  pageCount?: number; // For PDFs
  imageHash?: string; // For images and PDF first page
  structureHash?: string; // For PDFs (page sizes, text positions)
  metadata?: {
    width?: number;
    height?: number;
    hasText?: boolean;
  };
}

/**
 * Generate a fingerprint of a file for visual comparison
 */
export async function generateFileFingerprint(file: File): Promise<FileFingerprint> {
  const fileType = getFileType(file);
  
  const fingerprint: FileFingerprint = {
    fileName: file.name,
    fileType,
    fileSize: file.size,
  };

  try {
    if (fileType === 'pdf') {
      await addPdfFingerprint(file, fingerprint);
    } else if (fileType === 'image') {
      await addImageFingerprint(file, fingerprint);
    }
  } catch (error) {
    console.warn(`Could not generate full fingerprint for ${file.name}:`, error);
  }

  return fingerprint;
}

/**
 * Compare two file fingerprints for visual similarity
 */
export function compareVisualSimilarity(
  fingerprint1: FileFingerprint,
  fingerprint2: FileFingerprint
): VisualSimilarityResult {
  // Different file types - no visual similarity
  if (fingerprint1.fileType !== fingerprint2.fileType) {
    return {
      similarity: 0,
      matchType: 'different-format',
      details: {
        reasonText: `Different file types: ${fingerprint1.fileType} vs ${fingerprint2.fileType}`,
      },
      isDuplicate: false,
    };
  }

  const result: VisualSimilarityResult = {
    similarity: 0,
    matchType: 'no-match',
    details: { reasonText: '' },
    isDuplicate: false,
  };

  if (fingerprint1.fileType === 'pdf' && fingerprint2.fileType === 'pdf') {
    return comparePdfFingerprints(fingerprint1, fingerprint2);
  } else if (fingerprint1.fileType === 'image' && fingerprint2.fileType === 'image') {
    return compareImageFingerprints(fingerprint1, fingerprint2);
  }

  return result;
}

/**
 * Get file type from extension
 */
function getFileType(file: File): 'pdf' | 'image' | 'other' {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image';
  
  return 'other';
}

/**
 * Add PDF-specific fingerprint data
 */
async function addPdfFingerprint(file: File, fingerprint: FileFingerprint): Promise<void> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    fingerprint.pageCount = pdf.numPages;
    
    // Get structure hash (page dimensions + text presence)
    const structureData: string[] = [];
    
    // Sample first 5 pages for structure (performance)
    const pagesToSample = Math.min(5, pdf.numPages);
    for (let i = 1; i <= pagesToSample; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      
      // Get text content
      const textContent = await page.getTextContent();
      const hasText = textContent.items.length > 0;
      
      structureData.push(`${Math.round(viewport.width)}x${Math.round(viewport.height)}_${hasText ? 'T' : 'N'}`);
    }
    
    fingerprint.structureHash = await simpleHash(structureData.join('|'));
    
    // Generate perceptual hash of first page as image
    try {
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 0.5 }); // Low res for speed
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Get text content before rendering
        const firstPageTextContent = await firstPage.getTextContent();
        
        await firstPage.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        } as any).promise;
        
        fingerprint.imageHash = await generatePerceptualHash(canvas);
        
        fingerprint.metadata = {
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
          hasText: firstPageTextContent.items.length > 0,
        };
      }
    } catch (error) {
      console.warn('Could not generate image hash for PDF first page:', error);
    }
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
}

/**
 * Add image-specific fingerprint data
 */
async function addImageFingerprint(file: File, fingerprint: FileFingerprint): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Resize to reasonable dimensions for hashing
        const maxDim = 512;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        fingerprint.imageHash = await generatePerceptualHash(canvas);
        fingerprint.metadata = {
          width: img.width,
          height: img.height,
        };
        
        URL.revokeObjectURL(url);
        resolve();
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    
    img.src = url;
  });
}

/**
 * Generate a simple perceptual hash (average hash algorithm)
 * This is a simplified implementation for browser environments
 */
async function generatePerceptualHash(canvas: HTMLCanvasElement): Promise<string> {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas context');
  
  // Resize to 8x8 for hashing
  const hashSize = 8;
  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = hashSize;
  smallCanvas.height = hashSize;
  const smallContext = smallCanvas.getContext('2d');
  
  if (!smallContext) throw new Error('No small canvas context');
  
  // Draw scaled-down version
  smallContext.drawImage(canvas, 0, 0, hashSize, hashSize);
  
  // Get grayscale pixel data
  const imageData = smallContext.getImageData(0, 0, hashSize, hashSize);
  const pixels = imageData.data;
  
  const grayscale: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    // Convert to grayscale (simple average)
    const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    grayscale.push(gray);
  }
  
  // Calculate average
  const average = grayscale.reduce((sum, val) => sum + val, 0) / grayscale.length;
  
  // Generate hash: 1 if pixel > average, 0 otherwise
  let hash = '';
  for (const gray of grayscale) {
    hash += gray > average ? '1' : '0';
  }
  
  return hash;
}

/**
 * Compare two perceptual hashes (Hamming distance)
 */
function comparePerceptualHashes(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;
  
  let matches = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) matches++;
  }
  
  return (matches / hash1.length) * 100;
}

/**
 * Compare two PDF fingerprints
 */
function comparePdfFingerprints(
  fp1: FileFingerprint,
  fp2: FileFingerprint
): VisualSimilarityResult {
  const details: VisualSimilarityResult['details'] = { reasonText: '' };
  let totalSimilarity = 0;
  let factors = 0;
  
  // Compare page counts
  if (fp1.pageCount !== undefined && fp2.pageCount !== undefined) {
    const pageCountDiff = Math.abs(fp1.pageCount - fp2.pageCount);
    details.pageCountDiff = pageCountDiff;
    
    if (fp1.pageCount === fp2.pageCount) {
      details.pageCountMatch = 100;
      totalSimilarity += 100;
      factors++;
    } else {
      // Calculate similarity based on difference
      const maxPages = Math.max(fp1.pageCount, fp2.pageCount);
      const similarity = Math.max(0, (1 - pageCountDiff / maxPages) * 100);
      details.pageCountMatch = Math.round(similarity);
      
      if (similarity >= PAGE_COUNT_MATCH_THRESHOLD * 100) {
        totalSimilarity += similarity;
        factors++;
      }
    }
  }
  
  // Compare structure hashes
  if (fp1.structureHash && fp2.structureHash) {
    const structureMatch = fp1.structureHash === fp2.structureHash ? 100 : 0;
    details.structureMatch = structureMatch;
    totalSimilarity += structureMatch;
    factors++;
  }
  
  // Compare image hashes (first page)
  if (fp1.imageHash && fp2.imageHash) {
    const imageHashMatch = comparePerceptualHashes(fp1.imageHash, fp2.imageHash);
    details.imageHashMatch = Math.round(imageHashMatch);
    totalSimilarity += imageHashMatch;
    factors++;
  }
  
  // Calculate overall similarity
  const averageSimilarity = factors > 0 ? totalSimilarity / factors : 0;
  
  // Determine match type and reason
  let matchType: VisualSimilarityResult['matchType'] = 'no-match';
  let reasonText = '';
  
  if (averageSimilarity >= 95) {
    matchType = 'identical-structure';
    reasonText = `Highly similar PDFs: ${fp1.pageCount} pages, ${Math.round(averageSimilarity)}% match`;
  } else if (averageSimilarity >= STRUCTURE_MATCH_THRESHOLD * 100) {
    matchType = 'similar-structure';
    reasonText = `Similar PDFs: ${fp1.pageCount} vs ${fp2.pageCount} pages, ${Math.round(averageSimilarity)}% match`;
  } else if (details.pageCountDiff !== undefined && details.pageCountDiff > 0) {
    matchType = 'different-pages';
    reasonText = `Different page counts: ${fp1.pageCount} vs ${fp2.pageCount} pages`;
  } else {
    reasonText = `Low similarity: ${Math.round(averageSimilarity)}% match`;
  }
  
  details.reasonText = reasonText;
  
  return {
    similarity: Math.round(averageSimilarity),
    matchType,
    details,
    isDuplicate: averageSimilarity >= MIN_CONFIDENCE_FOR_VISUAL_DUPLICATE,
  };
}

/**
 * Compare two image fingerprints
 */
function compareImageFingerprints(
  fp1: FileFingerprint,
  fp2: FileFingerprint
): VisualSimilarityResult {
  const details: VisualSimilarityResult['details'] = { reasonText: '' };
  
  if (!fp1.imageHash || !fp2.imageHash) {
    return {
      similarity: 0,
      matchType: 'no-match',
      details: { reasonText: 'Could not compare image hashes' },
      isDuplicate: false,
    };
  }
  
  const imageHashMatch = comparePerceptualHashes(fp1.imageHash, fp2.imageHash);
  details.imageHashMatch = Math.round(imageHashMatch);
  
  let matchType: VisualSimilarityResult['matchType'] = 'no-match';
  let reasonText = '';
  
  if (imageHashMatch >= 98) {
    matchType = 'identical-structure';
    reasonText = `Identical images: ${Math.round(imageHashMatch)}% match`;
  } else if (imageHashMatch >= IMAGE_HASH_MATCH_THRESHOLD * 100) {
    matchType = 'similar-structure';
    reasonText = `Similar images: ${Math.round(imageHashMatch)}% match (possibly resized or compressed)`;
  } else {
    reasonText = `Different images: ${Math.round(imageHashMatch)}% match`;
  }
  
  details.reasonText = reasonText;
  
  return {
    similarity: Math.round(imageHashMatch),
    matchType,
    details,
    isDuplicate: imageHashMatch >= MIN_CONFIDENCE_FOR_VISUAL_DUPLICATE,
  };
}

/**
 * Simple string hashing function
 */
async function simpleHash(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Batch compare multiple files for visual similarity
 * Returns groups of visually similar files
 */
export async function findVisualDuplicates(
  files: File[]
): Promise<Array<{ files: File[]; similarity: number; reason: string }>> {
  console.log(`🔍 Analyzing ${files.length} files for visual similarity...`);
  
  // Generate fingerprints for all files
  const fingerprints = await Promise.all(
    files.map(async (file) => {
      try {
        const fp = await generateFileFingerprint(file);
        return { file, fingerprint: fp };
      } catch (error) {
        console.warn(`Could not fingerprint ${file.name}:`, error);
        return null;
      }
    })
  );
  
  const validFingerprints = fingerprints.filter(fp => fp !== null) as Array<{
    file: File;
    fingerprint: FileFingerprint;
  }>;
  
  console.log(`✅ Generated ${validFingerprints.length} fingerprints`);
  
  // Compare all pairs
  const groups: Array<{ files: File[]; similarity: number; reason: string }> = [];
  const processed = new Set<File>();
  
  for (let i = 0; i < validFingerprints.length; i++) {
    const fp1 = validFingerprints[i];
    if (processed.has(fp1.file)) continue;
    
    const similarFiles: File[] = [fp1.file];
    let maxSimilarity = 0;
    let reasonText = '';
    
    for (let j = i + 1; j < validFingerprints.length; j++) {
      const fp2 = validFingerprints[j];
      if (processed.has(fp2.file)) continue;
      
      const result = compareVisualSimilarity(fp1.fingerprint, fp2.fingerprint);
      
      if (result.isDuplicate) {
        similarFiles.push(fp2.file);
        processed.add(fp2.file);
        
        if (result.similarity > maxSimilarity) {
          maxSimilarity = result.similarity;
          reasonText = result.details.reasonText;
        }
      }
    }
    
    if (similarFiles.length > 1) {
      groups.push({
        files: similarFiles,
        similarity: maxSimilarity,
        reason: reasonText,
      });
      processed.add(fp1.file);
    }
  }
  
  console.log(`🔍 Found ${groups.length} visual duplicate groups`);
  
  return groups;
}
