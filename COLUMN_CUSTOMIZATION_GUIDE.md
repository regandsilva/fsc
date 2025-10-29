# Column Customization Guide

## Overview
The FSC Document Hub now features comprehensive column customization that allows you to control the visibility and width of all table columns, organized into two groups: **Airtable Data Columns** and **App Document Columns**.

---

## Features

### ✅ Column Visibility
Show or hide any column in both desktop and mobile views

### ✅ Column Width Adjustment
Adjust column widths from 80px to 400px using:
- Slider control for quick adjustments
- Number input for precise values

### ✅ Grouped Organization
Columns are organized into two clear sections:
- **Airtable Columns** (blue badge) - Data from your Airtable base
- **App Columns** (green badge) - Document upload and completion tracking

### ✅ Persistent Settings
All preferences are automatically saved and restored across sessions

---

## Column Groups

### 📊 Airtable Data Columns
These columns display data directly from your Airtable FSC table:

| Column | Default Width | Description |
|--------|--------------|-------------|
| Batch Number | 150px | FSC Batch identifier |
| PO REF | 150px | Purchase Order reference |
| SO | 150px | Sales Order number |
| FSC Approval Date | 150px | Date of FSC approval |
| Created Date | 150px | Record creation date |
| FSC Status | 120px | Current FSC status |
| FSC Case Number | 150px | FSC case identifier |
| Product Name | 200px | Product description |

### 📁 App Document Columns
These columns are managed by the application for file uploads:

| Column | Default Width | Description |
|--------|--------------|-------------|
| PO | 100px | Purchase Order file uploads |
| SO | 100px | Sales Order file uploads |
| Supplier Invoice | 150px | Supplier invoice uploads |
| Customer Invoice | 150px | Customer invoice uploads |
| Completion | 200px | Batch completion progress bar |

---

## How to Use

### Opening Column Settings
1. Look for the **"Customize Columns"** button above the data table
2. Click the button to open the column customization modal

### Hiding/Showing Columns
1. In the modal, find the column you want to toggle
2. Click the checkbox next to the column name
3. Unchecked = Hidden, Checked = Visible

### Adjusting Column Width
1. Ensure the column is visible (checkbox checked)
2. Use the slider to adjust width in 10px increments
3. OR type a specific width value in the number input box
4. Width range: 80px (minimum) to 400px (maximum)

### Resetting to Defaults
1. Click **"Reset to Default"** button at the bottom of the modal
2. All columns will be reset to visible with default widths
3. This action is immediate and saved automatically

### Closing the Modal
- Click **"Done"** button to close
- Click the **X** button in the top-right
- Your changes are saved automatically

---

## Visual Organization

### Airtable Section (Blue Badge)
```
🔵 Airtable | Data Columns
├─ ☑ Batch Number        [==========] 150px
├─ ☑ PO REF              [==========] 150px
├─ ☑ SO                  [==========] 150px
└─ ...
```

### App Section (Green Badge)
```
🟢 App | Document Columns
├─ ☑ PO                  [======]    100px
├─ ☑ SO                  [======]    100px
├─ ☑ Supplier Invoice    [==========] 150px
└─ ...
```

---

## Responsive Behavior

### Desktop View (≥768px)
- Full table with all visible columns
- Column widths applied as configured
- Horizontal scroll if needed for wide tables

### Mobile View (<768px)
- Card-based layout
- Only visible Airtable columns shown
- Document columns shown in "Attachments" section
- Column width settings do not apply (responsive layout)

---

## Technical Details

### Storage
- Preferences stored in `localStorage` (web) or Electron store (desktop)
- Storage key: `fsc-column-preferences`
- Auto-saves on any change

### Data Structure
```typescript
{
  columns: [
    {
      id: "Batch number",
      label: "Batch Number",
      visible: true,
      width: 150,
      group: "airtable"
    },
    // ... more columns
  ]
}
```

### Performance
- Column visibility checked on each render
- Width styles applied inline for immediate effect
- Minimal re-renders using React state management

---

## Tips & Best Practices

### 🎯 Optimal Widths
- **IDs/References**: 100-150px (Batch Number, PO REF, SO)
- **Dates**: 120-150px (FSC Approval Date, Created Date)
- **Descriptions**: 200-300px (Product Name)
- **Status indicators**: 100-120px (FSC Status)
- **Progress bars**: 200-250px (Completion)

### 💡 Common Configurations

**Minimal View** (Focus on batch management)
- Show: Batch Number, FSC Approval Date, Completion
- Hide: All other columns

**Upload Focus** (Document management)
- Show: Batch Number, PO, SO, Supplier Invoice, Customer Invoice
- Hide: FSC Status, FSC Case Number, Product Name

**Complete View** (All information)
- Show: All columns
- Adjust widths to fit your screen

### ⚡ Workflow Tips
1. Hide columns you rarely use to reduce clutter
2. Widen important columns for better readability
3. Use the completion column to track progress visually
4. Reset to defaults if your layout becomes confusing

---

## Troubleshooting

### Columns Not Appearing
- Check if column is checked (visible) in settings
- Verify you're in desktop view (table mode)
- Clear preferences and reset: `localStorage.removeItem('fsc-column-preferences')`

### Width Changes Not Saving
- Check browser localStorage is enabled
- Look for console errors (F12 > Console tab)
- Try resetting to defaults and re-adjusting

### Modal Not Opening
- Check for JavaScript errors in console
- Verify the Customize Columns button is visible
- Refresh the page and try again

### Table Layout Issues
- If table is too wide, reduce column widths
- If columns are cramped, increase widths or hide some columns
- Use horizontal scroll for very wide tables

---

## Keyboard Shortcuts
Currently not implemented. Future enhancement planned.

---

## Browser Compatibility
- ✅ Chrome/Edge (Full support)
- ✅ Firefox (Full support)
- ✅ Safari (Full support)
- ✅ Mobile browsers (Visibility only, widths don't apply)

---

## Developer Notes

### Files Modified
- `utils/columnPreferences.ts` - Core preference management
- `components/DataTable.tsx` - UI and rendering logic

### Key Functions
```typescript
columnPreferences.getColumn(prefs, columnId) // Get column config
columnPreferences.toggleVisibility(prefs, columnId) // Toggle show/hide
columnPreferences.updateWidth(prefs, columnId, width) // Set width
columnPreferences.getAirtableColumns(prefs) // Get Airtable columns
columnPreferences.getAppColumns(prefs) // Get App columns
```

### Adding New Columns
To add a new column to the system:
1. Update `DEFAULT_COLUMNS` in `utils/columnPreferences.ts`
2. Add TypeScript type to `AirtableColumnId` or `AppColumnId`
3. Update table rendering in `DataTable.tsx`
4. Test visibility toggle and width adjustment

---

## Future Enhancements
- [ ] Column reordering (drag & drop)
- [ ] Column presets (save multiple configurations)
- [ ] Export column settings
- [ ] Import column settings
- [ ] Keyboard shortcuts
- [ ] Column search/filter in modal
- [ ] Per-user preferences (with backend)

---

## Testing Checklist

### Basic Functionality
- [ ] Open column settings modal
- [ ] Toggle Airtable column visibility
- [ ] Toggle App column visibility
- [ ] Adjust column width with slider
- [ ] Adjust column width with number input
- [ ] Reset to defaults

### Persistence
- [ ] Close modal - settings retained
- [ ] Refresh page - settings restored
- [ ] Close and reopen app - settings restored

### Edge Cases
- [ ] Hide all columns (at least one should remain)
- [ ] Set width to minimum (80px)
- [ ] Set width to maximum (400px)
- [ ] Switch between desktop and mobile views

### Visual
- [ ] Column widths match settings
- [ ] Hidden columns not displayed
- [ ] Table scrolls horizontally if too wide
- [ ] Mobile cards respect visibility

---

**Last Updated**: October 29, 2025  
**Version**: 2.0.0
