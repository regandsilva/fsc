# Resizable Columns Feature Guide

## Overview
The FSC Document Hub now features **drag-to-resize columns** directly in the table, with automatic text wrapping and an auto-fit option for optimal column widths.

---

## 🎯 Key Features

### ✅ Drag-to-Resize
- Resize columns by dragging the **right edge** of column headers
- Visual resize handle appears on hover (blue highlight)
- Minimum width: **80px**
- Smooth, real-time resizing

### ✅ Text Wrapping
- Text automatically wraps within column width
- No horizontal scrolling needed for long text
- Uses CSS `break-words` for proper word breaking

### ✅ Auto-Fit Option
- Click **"Auto"** button to enable auto-fit for any column
- Column automatically sizes to fit content
- Toggle back to manual sizing by dragging

### ✅ Persistent Settings
- Column widths saved automatically
- Auto-fit preferences remembered
- Restored on app restart

---

## 📖 How to Use

### Resizing Columns

1. **Locate the Resize Handle**
   - Move your cursor to the **right edge** of any column header
   - You'll see a thin gray line that turns **blue** on hover
   - Cursor changes to **↔** (col-resize)

2. **Drag to Resize**
   - Click and hold the resize handle
   - Drag **left** to make column narrower
   - Drag **right** to make column wider
   - Release to apply the new width

3. **Minimum Width**
   - Columns cannot be resized below **80px**
   - This ensures text remains readable

### Using Auto-Fit

1. **Open Column Settings**
   - Click **"Customize Columns"** button above the table

2. **Enable Auto-Fit**
   - Find the column you want to auto-fit
   - Click the **"Auto"** button next to the column name
   - Column will adjust to "Auto" width

3. **Disable Auto-Fit**
   - Simply drag the column edge in the table
   - This automatically switches back to fixed width

### Text Wrapping

- **Automatic**: Text wraps automatically in all cells
- **No Action Needed**: Works by default for all columns
- **Benefits**: 
  - Long text is fully visible
  - No need for horizontal scrolling
  - Better readability on smaller screens

---

## 🎨 Visual Indicators

### Resize Handle States
```
Normal:     ┃ (thin gray line)
Hover:      ┃ (blue line, thicker)
Dragging:   ┃ (blue, active cursor)
```

### Column Width Display
In the Customize Columns modal:
- **Fixed width**: `150px`
- **Auto-fit**: `Auto`

---

## 💡 Tips & Best Practices

### Optimal Column Sizing

**For Short IDs/Codes** (Batch Number, PO REF)
- Use narrower widths: 100-150px
- Or enable auto-fit for minimal space

**For Long Text** (Product Name, Descriptions)
- Use wider widths: 200-300px
- Text wraps automatically for readability

**For Status Indicators** (FSC Status, Completion)
- Medium width: 120-180px
- Allows space for progress bars

### When to Use Auto-Fit

✅ **Good for:**
- Columns with consistent, short content
- Reference numbers (IDs, codes)
- Status fields
- Short names

❌ **Avoid for:**
- Columns with highly variable content length
- Description fields
- When you want consistent table layout

### Workflow Recommendations

1. **Start with Defaults**
   - Use the default widths first
   - Identify columns that need adjustment

2. **Resize Major Columns**
   - Adjust the most important columns first
   - Use drag-to-resize for precise control

3. **Apply Auto-Fit Selectively**
   - Use auto-fit for simple, short-content columns
   - Keeps table compact

4. **Test with Real Data**
   - Load your actual data
   - Adjust widths based on content

---

## 🔧 Technical Details

### CSS Implementation
```css
/* Text wrapping */
.break-words {
  word-break: break-word;
  overflow-wrap: break-word;
}

/* Fixed width columns */
width: 150px;
min-width: 150px;
max-width: 150px;

/* Auto-fit columns */
width: auto;
min-width: auto;
max-width: none;
```

### Resize Behavior
- Uses React state for real-time updates
- Mouse events: `mousedown` → `mousemove` → `mouseup`
- Width calculated: `newWidth = startWidth + (currentX - startX)`
- Minimum enforced: `Math.max(80, calculatedWidth)`

### Storage
```typescript
{
  columns: [
    {
      id: "Batch number",
      width: 150,        // Fixed width in pixels
      autoFit: false,    // Auto-fit disabled
      // ...
    },
    {
      id: "FSC Status",
      width: 120,        // Last manual width
      autoFit: true,     // Auto-fit enabled
      // ...
    }
  ]
}
```

---

## 📱 Responsive Behavior

### Desktop (≥768px)
- Full table with resizable columns
- Drag handles visible on all columns
- Text wrapping enabled

### Mobile (<768px)
- Card-based layout (no table)
- Column widths don't apply
- Text always wraps in cards

---

## 🐛 Troubleshooting

### Resize Handle Not Visible
- **Check**: Hover over the right edge of column header
- **Try**: Move cursor slowly along the edge
- **Ensure**: You're in desktop view (not mobile)

### Column Won't Resize Smaller
- **Reason**: 80px minimum width enforced
- **Solution**: This is by design for readability
- **Alternative**: Hide the column if not needed

### Auto-Fit Not Working
- **Check**: "Auto" button clicked in settings
- **Verify**: Column shows "Auto" instead of "150px"
- **Try**: Refresh the page

### Text Still Overflowing
- **Check**: Column has sufficient width
- **Verify**: `break-words` class applied
- **Try**: Increase column width or enable auto-fit

### Width Not Persisting
- **Check**: Browser localStorage enabled
- **Try**: Clear preferences and reset
- **Console**: Look for save errors (F12)

---

## ⌨️ Keyboard Shortcuts
Currently not implemented. Manual mouse drag only.

**Future Enhancement Ideas:**
- Arrow keys to adjust selected column
- Shift+Click for precise width input
- Double-click to auto-fit individual column

---

## 🔄 Comparison: Old vs New

### Before (Slider-Based)
- ❌ Adjustments in modal only
- ❌ No real-time preview
- ❌ Text overflow with ellipsis
- ❌ Fixed, no auto-fit

### After (Drag-to-Resize)
- ✅ Resize directly in table
- ✅ Real-time visual feedback
- ✅ Text wraps automatically
- ✅ Auto-fit option available

---

## 📊 Example Workflows

### Workflow 1: Quick Adjustment
1. Notice "Product Name" column is too wide
2. Hover over right edge of column header
3. Drag left to ~200px
4. Release - width saved automatically

### Workflow 2: Compact Layout
1. Open "Customize Columns"
2. Click "Auto" for all ID columns
3. Close modal
4. Table now more compact with auto-sized columns

### Workflow 3: Maximum Readability
1. Widen important columns by dragging
2. Enable text wrapping (already on by default)
3. Hide unused columns
4. Result: Clean, readable table

---

## 🚀 Performance Notes

- **Resize Speed**: Real-time, smooth
- **Memory**: Minimal overhead
- **CPU**: Negligible during resize
- **Storage**: Each column ~50 bytes
- **Network**: No network calls

---

## 📚 Related Features

- **Column Visibility**: Show/hide columns in settings
- **Column Reordering**: Drag column headers to reorder
- **Smart Filters**: Filter data by completion status
- **Persistent Settings**: All preferences auto-saved

---

## 🎓 Best Practices Summary

1. ✅ **Use drag-to-resize** for most columns
2. ✅ **Enable auto-fit** for short, consistent content
3. ✅ **Let text wrap** instead of forcing narrow columns
4. ✅ **Test with real data** before finalizing widths
5. ✅ **Reset to defaults** if layout becomes confusing

---

## 🔮 Future Enhancements

Planned features:
- [ ] Double-click header edge to auto-fit that column
- [ ] Column width presets (compact, balanced, wide)
- [ ] Keyboard shortcuts for column adjustment
- [ ] Touch-based resize for tablets
- [ ] Visual measurement guides while resizing

---

**Last Updated**: October 29, 2025  
**Version**: 3.0.0  
**Feature**: Drag-to-Resize Columns
