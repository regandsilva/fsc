# Quick Reference: Batch Completion & Smart Filters

## 📊 Completion Status Colors

| Color | Percentage | Meaning |
|-------|-----------|---------|
| 🔴 Red | 0-49% | Critical - Most documents missing |
| 🟡 Yellow | 50-99% | Caution - Some documents missing |
| 🟢 Green | 100% | Complete - All documents uploaded |

## 🎯 Smart Filter Buttons

| Button | Shows Batches... |
|--------|-----------------|
| **All Batches** | Everything (no filter) |
| **✓ Complete Batches** | With all 4 documents (100%) |
| **⚠ Incomplete Batches** | Missing at least 1 document |
| **Missing PO** | Without Purchase Order |
| **Missing SO** | Without Sales Order |
| **Missing Supplier Invoice** | Without Supplier Invoice |
| **Missing Customer Invoice** | Without Customer Invoice |

## ⚡ Common Workflows

### 1️⃣ Find All Incomplete Work
```
Click: ⚠ Incomplete Batches
→ Shows all batches with missing docs
→ Sort by date to prioritize
→ Work through the list
```

### 2️⃣ Upload Missing POs
```
Click: Missing PO
→ See only batches without PO
→ Upload POs one by one
→ Watch list shrink in real-time
```

### 3️⃣ Verify Month-End Completion
```
Set date filter: This month
Click: ✓ Complete Batches
→ Review completed batches
Click: ⚠ Incomplete Batches
→ Fix remaining issues
```

### 4️⃣ Prioritize by Progress
```
Sort by: Completion (if sortable)
→ Red bars first (0-49%)
→ Yellow bars next (50-99%)
→ Skip green bars (100%)
```

## 📈 Reading the Progress Bar

```
3/4                    75%
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░
Missing: Customer Inv
```

- **3/4** = 3 out of 4 documents uploaded
- **75%** = Completion percentage
- **Missing: ...** = What still needs uploading

## 💡 Pro Tips

✅ **Real-time updates**: Progress bars update instantly as you upload
✅ **Combine filters**: Use smart filters + search + date filters together
✅ **Mobile-friendly**: Works on both desktop and mobile views
✅ **Clear filters**: Click "Clear All Filters" to reset everything
✅ **Local storage**: Currently works with local folder storage mode only

## 🔍 Filter Combinations

### Find old incomplete batches:
- Date filter: Before 30 days ago
- Smart filter: Incomplete Batches

### Find recent missing invoices:
- Date filter: Last 7 days
- Smart filter: Missing Supplier Invoice OR Missing Customer Invoice

### Search + Smart Filter:
- Search: "PO123"
- Smart filter: Incomplete Batches
- Result: Batches matching PO123 that aren't done

## 🆘 Troubleshooting

**Progress bars all showing 0%?**
→ Make sure you're in "Local PC Folder" mode
→ Make sure folder is selected and files have been uploaded

**Smart filters not working?**
→ Check that local storage mode is enabled
→ Try clicking "Fetch Airtable Data" to refresh

**Completion percentage seems wrong?**
→ Each batch requires exactly 4 documents (PO, SO, Supplier Inv, Customer Inv)
→ Check if files were uploaded with the app or manually

---

**Need help?** Refer to `COMPLETION_TRACKER_FEATURE.md` for full documentation.
