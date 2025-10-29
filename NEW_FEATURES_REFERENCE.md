# New Features Quick Reference

## 1. Persistent Filters (Remember Last Filter)

### What It Does
- Automatically saves your filter settings when you change them
- Restores filters when you reopen the app
- Works with both local storage (web) and Electron desktop

### Saved Filters
- Smart filter selection (all/complete/incomplete/missing documents)
- Search text
- FSC Approval Date filter (operator and dates)
- Created Date filter (operator and dates)

### How It Works
- Filters are saved to `localStorage` (web) or Electron store (desktop)
- Loaded automatically on app startup
- Updates saved whenever you change any filter

### Files Created/Modified
- **Created**: `utils/filterPersistence.ts` - Filter persistence utility
- **Modified**: `App.tsx` - Added filter loading/saving with useEffect hooks
- Storage key: `fsc-filter-state`

---

## 2. Manual Refresh Button

### What It Does
- Adds a refresh button in the header next to the settings button
- Manually refresh data from Airtable without reopening settings
- Shows spinning animation while refreshing

### How to Use
1. Click the circular arrow icon in the top-right header
2. Button is disabled and spins while loading
3. Data refreshes from Airtable

### Features
- Visual feedback with spinning animation
- Disabled state prevents multiple clicks
- Uses existing `handleFetchData` function
- Tooltip shows "Refresh data" on hover

### Files Modified
- **`components/Header.tsx`**: Added refresh button with props
  - New props: `onRefresh` (callback), `isRefreshing` (loading state)
- **`App.tsx`**: Passes `handleFetchData` and `isLoading` to Header

---

## 3. Column Customization

### What It Does
- Show/hide document columns (PO, SO, Supplier Invoice, Customer Invoice, Completion)
- Saves your column preferences automatically
- Applies to desktop table view

### How to Use
1. Click **"Customize Columns"** button above the data table
2. Check/uncheck columns to show/hide them
3. Click **"Done"** to close the modal
4. Click **"Reset to Default"** to restore all columns

### Customizable Columns
- ✅ PO
- ✅ SO  
- ✅ Supplier Invoice
- ✅ Customer Invoice
- ✅ Completion

### Features
- Preferences saved automatically
- Persists across app restarts
- Clean modal interface
- Reset to defaults option
- Real-time table update

### Files Created/Modified
- **Created**: `utils/columnPreferences.ts` - Column preferences utility
- **Modified**: `components/DataTable.tsx`
  - Added Settings icon import
  - Column settings modal component
  - Conditional column rendering in table header and body
  - Load/save preferences with useEffect
- Storage key: `fsc-column-preferences`

---

## Technical Details

### Storage Mechanism
All features use the `electronStore` utility which:
- Uses `localStorage` in web browser mode
- Uses Electron store in desktop app mode
- Provides consistent async API for both

### Storage Keys
- `fsc-filter-state` - Filter preferences
- `fsc-column-preferences` - Column visibility preferences
- `fsc-settings` - App settings (existing)

### State Management
- Filter state in `App.tsx` with useEffect hooks
- Column state in `DataTable.tsx` with useEffect hooks
- Prevents saving on initial load with `filtersLoaded` and `columnPrefsLoaded` flags

---

## User Experience Improvements

### Before
- ❌ Had to re-apply filters every session
- ❌ Had to open settings panel to refresh data
- ❌ No way to hide unused columns
- ❌ Cluttered table with all columns always visible

### After
- ✅ Filters remembered automatically
- ✅ One-click data refresh from header
- ✅ Customize visible columns
- ✅ Cleaner, personalized table view
- ✅ Preferences saved across sessions

---

## Browser Compatibility
- ✅ Chrome/Edge (full support)
- ✅ Firefox (full support)
- ✅ Safari (full support)
- ✅ Electron Desktop App (full support)

---

## Future Enhancements (Not Implemented)
- Auto-refresh on interval
- Column width adjustment
- Column reordering (basic structure exists in modal)
- Export column preferences
- Multiple saved filter presets
- Keyboard shortcuts for filters

---

## Testing Checklist

### Filter Persistence
- [ ] Set filters and close/reopen app - filters should be restored
- [ ] Change filters - should auto-save immediately
- [ ] Test all filter types (smart, search, dates)

### Manual Refresh
- [ ] Click refresh button - should reload data
- [ ] Button should spin during loading
- [ ] Button should be disabled while loading
- [ ] Should work even with settings panel closed

### Column Customization
- [ ] Open column settings modal
- [ ] Hide/show columns - table should update immediately
- [ ] Close and reopen app - columns should stay hidden/visible
- [ ] Reset to default - all columns should reappear
- [ ] Mobile view should not be affected

---

## Troubleshooting

### Filters Not Saving
- Check browser localStorage is enabled
- Check console for errors
- Clear localStorage and test again: `localStorage.removeItem('fsc-filter-state')`

### Columns Not Persisting
- Clear column preferences: `localStorage.removeItem('fsc-column-preferences')`
- Check console for save/load errors
- Verify modal changes are applied before closing

### Refresh Button Not Working
- Check Airtable settings are configured
- Verify handleFetchData is passed as prop
- Check network connection

---

## Code Examples

### Clearing Saved Filters (Console)
```javascript
localStorage.removeItem('fsc-filter-state');
location.reload();
```

### Resetting Column Preferences (Console)
```javascript
localStorage.removeItem('fsc-column-preferences');
location.reload();
```

### Viewing Current Preferences (Console)
```javascript
// View filters
console.log(JSON.parse(localStorage.getItem('fsc-filter-state')));

// View columns
console.log(JSON.parse(localStorage.getItem('fsc-column-preferences')));
```

---

**Last Updated**: October 29, 2025
**Version**: 1.0.0
