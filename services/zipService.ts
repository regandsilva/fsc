
import { FscRecord, ManagedFile, DocType } from '../types';

// This relies on the JSZip library being loaded from the CDN in index.html
declare const JSZip: any;

export const createZip = async (
    files: Record<DocType, ManagedFile[]>,
    record: FscRecord
): Promise<void> => {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is not loaded.');
    }

    const zip = new JSZip();
    const batchNumber = record['Batch number'];
    const rootFolderName = `Batch_${batchNumber}`;
    const rootFolder = zip.folder(rootFolderName);

    if (!rootFolder) {
        throw new Error('Could not create root folder in zip.');
    }

    const folderMap: Record<DocType, string> = {
        [DocType.PO]: '1_PurchaseOrders',
        [DocType.SO]: '2_SalesOrders',
        [DocType.SupplierInvoice]: '3_SupplierInvoices',
        [DocType.CustomerInvoice]: '4_CustomerInvoices',
    };

    let fileAdded = false;

    for (const docType in files) {
        const managedFiles = files[docType as DocType];
        if (managedFiles && managedFiles.length > 0) {
            const folderName = folderMap[docType as DocType];
            const docFolder = rootFolder.folder(folderName);
            if(docFolder) {
                managedFiles.forEach(managedFile => {
                    docFolder.file(managedFile.suggestedName, managedFile.file);
                    fileAdded = true;
                });
            }
        }
    }

    if (!fileAdded) {
        alert("No files have been added to create a package.");
        return;
    }

    const content = await zip.generateAsync({ type: 'blob' });

    // Create a link and trigger the download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${rootFolderName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
