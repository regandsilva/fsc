// Utility for persisting column preferences (visibility and width for all columns)
import { electronStore } from './electronStore';
import { FscRecord } from '../types';

export type AirtableColumnId = 
  | 'Batch number'
  | 'PO REF'
  | 'SO'
  | 'FSC Approval Date'
  | 'Created'
  | 'FSC Status'
  | 'FSC Case Number'
  | 'PRODUCT NAME (MAX 35 CHARACTERS)';

export type AppColumnId = 'PO' | 'SO' | 'SupplierInvoice' | 'CustomerInvoice' | 'Completion';

export type ColumnId = AirtableColumnId | AppColumnId;

export interface ColumnPreference {
  id: ColumnId;
  label: string;
  visible: boolean;
  width: number; // Width in pixels
  group: 'airtable' | 'app';
  autoFit?: boolean; // Whether to auto-fit this column
}

export interface ColumnPreferences {
  columns: ColumnPreference[];
}

const COLUMN_STORAGE_KEY = 'fsc-column-preferences';

// Default column configuration
const DEFAULT_COLUMNS: ColumnPreference[] = [
  // Airtable columns
  { id: 'Batch number', label: 'Batch Number', visible: true, width: 150, group: 'airtable' },
  { id: 'PO REF', label: 'PO REF', visible: true, width: 150, group: 'airtable' },
  { id: 'SO', label: 'SO', visible: true, width: 150, group: 'airtable' },
  { id: 'FSC Approval Date', label: 'FSC Approval Date', visible: true, width: 150, group: 'airtable' },
  { id: 'Created', label: 'Created Date', visible: true, width: 150, group: 'airtable' },
  { id: 'FSC Status', label: 'FSC Status', visible: true, width: 120, group: 'airtable' },
  { id: 'FSC Case Number', label: 'FSC Case Number', visible: true, width: 150, group: 'airtable' },
  { id: 'PRODUCT NAME (MAX 35 CHARACTERS)', label: 'Product Name', visible: true, width: 200, group: 'airtable' },
  // App columns
  { id: 'PO', label: 'PO', visible: true, width: 100, group: 'app' },
  { id: 'SO', label: 'SO', visible: true, width: 100, group: 'app' },
  { id: 'SupplierInvoice', label: 'Supplier Invoice', visible: true, width: 150, group: 'app' },
  { id: 'CustomerInvoice', label: 'Customer Invoice', visible: true, width: 150, group: 'app' },
  { id: 'Completion', label: 'Completion', visible: true, width: 200, group: 'app' },
];

export const columnPreferences = {
  async savePreferences(preferences: ColumnPreferences): Promise<void> {
    try {
      await electronStore.setSetting(COLUMN_STORAGE_KEY, preferences);
    } catch (error) {
      console.error('Error saving column preferences:', error);
    }
  },

  async loadPreferences(): Promise<ColumnPreferences> {
    try {
      const saved = await electronStore.getSetting(COLUMN_STORAGE_KEY);
      if (saved && saved.columns) {
        return columnPreferences.mergeWithDefaults(saved as ColumnPreferences);
      }
    } catch (error) {
      console.error('Error loading column preferences:', error);
    }
    return { columns: DEFAULT_COLUMNS };
  },

  async resetToDefaults(): Promise<ColumnPreferences> {
    const defaults = { columns: DEFAULT_COLUMNS };
    await columnPreferences.savePreferences(defaults);
    return defaults;
  },

  mergeWithDefaults(saved: ColumnPreferences): ColumnPreferences {
    // Create a map of saved preferences
    const savedMap = new Map(saved.columns.map(col => [col.id, col]));
    
    // Merge: use saved preferences if available, otherwise use defaults
    const merged = DEFAULT_COLUMNS.map(defaultCol => {
      const savedCol = savedMap.get(defaultCol.id);
      return savedCol ? { ...defaultCol, ...savedCol } : defaultCol;
    });

    return { columns: merged };
  },

  getDefaultPreferences(): ColumnPreferences {
    return { columns: [...DEFAULT_COLUMNS] };
  },

  // Helper to toggle column visibility
  toggleVisibility(preferences: ColumnPreferences, columnId: ColumnId): ColumnPreferences {
    const columns = preferences.columns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    return { columns };
  },

  // Helper to update column width
  updateWidth(preferences: ColumnPreferences, columnId: ColumnId, width: number): ColumnPreferences {
    const columns = preferences.columns.map(col =>
      col.id === columnId ? { ...col, width, autoFit: false } : col
    );
    return { columns };
  },

  // Helper to enable auto-fit for a column
  setAutoFit(preferences: ColumnPreferences, columnId: ColumnId, autoFit: boolean): ColumnPreferences {
    const columns = preferences.columns.map(col =>
      col.id === columnId ? { ...col, autoFit } : col
    );
    return { columns };
  },

  // Get columns by group
  getAirtableColumns(preferences: ColumnPreferences): ColumnPreference[] {
    return preferences.columns.filter(col => col.group === 'airtable');
  },

  getAppColumns(preferences: ColumnPreferences): ColumnPreference[] {
    return preferences.columns.filter(col => col.group === 'app');
  },

  // Get visible columns
  getVisibleColumns(preferences: ColumnPreferences): ColumnPreference[] {
    return preferences.columns.filter(col => col.visible);
  },

  // Get column by id
  getColumn(preferences: ColumnPreferences, columnId: ColumnId): ColumnPreference | undefined {
    return preferences.columns.find(col => col.id === columnId);
  },
};
