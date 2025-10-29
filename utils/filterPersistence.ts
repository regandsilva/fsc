// Utility for persisting filter state across app sessions
import { DateFilter } from '../types';
import { electronStore } from './electronStore';

export interface FilterState {
  smartFilter: 'all' | 'missing-po' | 'missing-so' | 'missing-supplier-inv' | 'missing-customer-inv' | 'complete' | 'incomplete';
  textFilter: string;
  dateFilter: DateFilter;
  createdDateFilter: DateFilter;
}

const FILTER_STORAGE_KEY = 'fsc-filter-state';

export const filterPersistence = {
  async saveFilters(filterState: FilterState): Promise<void> {
    try {
      await electronStore.setSetting(FILTER_STORAGE_KEY, filterState);
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  },

  async loadFilters(): Promise<FilterState | null> {
    try {
      const saved = await electronStore.getSetting(FILTER_STORAGE_KEY);
      return saved as FilterState | null;
    } catch (error) {
      console.error('Error loading filters:', error);
      return null;
    }
  },

  async clearFilters(): Promise<void> {
    try {
      await electronStore.setSetting(FILTER_STORAGE_KEY, null);
    } catch (error) {
      console.error('Error clearing filters:', error);
    }
  },

  getDefaultFilters(): FilterState {
    return {
      smartFilter: 'all',
      textFilter: '',
      dateFilter: { operator: 'exact', date1: '', date2: '' },
      createdDateFilter: { operator: 'exact', date1: '', date2: '' },
    };
  },
};
