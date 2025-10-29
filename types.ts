export interface FscRecord {
  id: string; // Added from Airtable record
  'Batch number': string;
  'PO REF': string;
  'SO': string;
  'FSC Approval Date': string;
  'FSC Status': string;
  'FSC Case Number': string;
  'PRODUCT NAME (MAX 35 CHARACTERS)': string;
  'Created': string; // Airtable creation timestamp
}

export interface AppSettings {
  apiKey: string;
  baseId: string;
  tableName: string;
  /**
   * Local folder path for saving documents
   */
  localStoragePath: string;
}

export interface ManagedFile {
  id: number;
  file: File;
  suggestedName: string;
  completed: boolean;
}

export enum DocType {
  PO = 'Purchase Order',
  SO = 'Sales Order',
  SupplierInvoice = 'Supplier Invoice',
  CustomerInvoice = 'Customer Invoice',
}

export interface SortConfig {
  key: keyof FscRecord | null;
  direction: 'ascending' | 'descending';
}

export type DateFilterOperator = 'exact' | 'before' | 'after' | 'between';

export interface DateFilter {
  operator: DateFilterOperator;
  date1: string;
  date2: string;
}

