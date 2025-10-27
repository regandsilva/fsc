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
  msalClientId: string;
  /**
   * Azure AD authority to use for MSAL authentication.
   * Examples:
   *  - common (multi-tenant + personal)
   *  - organizations (work/school only)
   *  - consumers (personal accounts only)
   *  - <tenant-id or domain>
   */
  azureAuthority?: string;
  oneDriveBasePath: string;
  /**
   * Storage mode: 'onedrive' or 'local'
   */
  storageMode: 'onedrive' | 'local';
  /**
   * Local folder path for saving documents when storageMode is 'local'
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

export interface OneDriveUser {
    name?: string | null;
    email: string;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: OneDriveUser | null;
    error: string | null;
    loading: boolean;
}