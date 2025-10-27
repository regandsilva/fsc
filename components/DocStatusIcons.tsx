import React from 'react';
import { DocType, ManagedFile } from '../types';
import { FileText } from 'lucide-react';

interface DocStatusIconsProps {
  files: Record<DocType, ManagedFile[]>;
}

const docTypeConfig = [
  { type: DocType.PO, label: "Purchase Order" },
  { type: DocType.SO, label: "Sales Order" },
  { type: DocType.SupplierInvoice, label: "Supplier Invoice" },
  { type: DocType.CustomerInvoice, label: "Customer Invoice" },
];

export const DocStatusIcons: React.FC<DocStatusIconsProps> = ({ files }) => {
  return (
    <div className="flex items-center space-x-2">
      {docTypeConfig.map(({ type, label }) => {
        const hasFiles = files && files[type] && files[type].length > 0;
        return (
          <div key={type} className="relative group">
            <FileText
              className={`h-6 w-6 transition-colors ${hasFiles ? 'text-green-500' : 'text-gray-300'}`}
            />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {label} ({hasFiles ? files[type].length : 0})
            </span>
          </div>
        );
      })}
    </div>
  );
};
