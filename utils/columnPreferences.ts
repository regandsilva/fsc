// Utility for persisting column preferences (visibility for document columns)
import { electronStore } from './electronStore';

export type DocColumnId = 'PO' | 'SO' | 'SupplierInvoice' | 'CustomerInvoice' | 'Completion';

export interface DocColumnPreference {
  id: DocColumnId;
  label: string;
  visible: boolean;
}

export interface ColumnPreferences {
  docColumns: DocColumnPreference[];
}

const COLUMN_STORAGE_KEY = 'fsc-column-preferences';

// Default column configuration for document columns
const DEFAULT_DOC_COLUMNS: DocColumnPreference[] = [
  { id: 'PO', label: 'PO', visible: true },
  { id: 'SO', label: 'SO', visible: true },
  { id: 'SupplierInvoice', label: 'Supplier Invoice', visible: true },
  { id: 'CustomerInvoice', label: 'Customer Invoice', visible: true },
  { id: 'Completion', label: 'Completion', visible: true },
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
      if (saved && saved.docColumns) {
        return saved as ColumnPreferences;
      }
    } catch (error) {
      console.error('Error loading column preferences:', error);
    }
    return { docColumns: DEFAULT_DOC_COLUMNS };
  },

  async resetToDefaults(): Promise<ColumnPreferences> {
    const defaults = { docColumns: DEFAULT_DOC_COLUMNS };
    await columnPreferences.savePreferences(defaults);
    return defaults;
  },

  getDefaultPreferences(): ColumnPreferences {
    return { docColumns: [...DEFAULT_DOC_COLUMNS] };
  },

  // Helper to toggle column visibility
  toggleVisibility(preferences: ColumnPreferences, columnId: DocColumnId): ColumnPreferences {
    const docColumns = preferences.docColumns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    return { docColumns };
  },
};
