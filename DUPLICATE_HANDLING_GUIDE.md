# Bulk Upload with Duplicate Detection & Versioning

## Overview
The bulk upload feature now automatically detects duplicate files and gives you intelligent options to handle them. Files are **actually uploaded** to your storage (Local PC or OneDrive), not just added to a queue.

## What's New

### ✅ Actual File Upload
- Files are **immediately uploaded** to your configured storage location
- No more "queue" - files go directly to their folders
- Progress tracking and success/error notifications
- Data automatically refreshes after upload to show updated counts

### ✅ Duplicate Detection
- Automatically detects if a file with the same name already exists
- Shows a dedicated modal to resolve conflicts before upload
- Checks against your upload history (Local) or OneDrive files

### ✅ Three Resolution Options

#### 1. **Skip**
- Don't upload this file
- The existing file remains unchanged
- Useful when you've accidentally selected a file twice

#### 2. **Replace**
- Upload the new file and overwrite the existing one
- **Cannot be undone** - the old file will be permanently replaced
- Useful when you have an updated version of a document

#### 3. **Keep Both (Version)**
- Upload as a versioned file: `invoice.pdf` → `invoice_v2.pdf`
- Both versions are preserved in the same folder
- System automatically finds the next available version number (v2, v3, v4, etc.)
- Useful for tracking document revisions

## How to Use

### Step 1: Bulk Upload
1. Click the **"Bulk Upload"** button (blue button at top of table)
2. Select multiple files (with PO/SO/batch numbers in filenames)
3. Click **"Analyze Files"**

### Step 2: Review AI Analysis
- Check the batch and document type assignments
- Edit any incorrect assignments using the dropdowns
- Review warnings for unmatched files

### Step 3: Confirm Upload
- Click **"Confirm & Upload"**
- System checks for duplicate filenames

### Step 4: Resolve Duplicates (if any)
If duplicates are detected, you'll see a dedicated modal:

**For Each Duplicate File:**
- **File Information**: Name, batch, type, size
- **Action Buttons**:
  - **Skip**: Don't upload (gray button)
  - **Replace**: Overwrite existing (red button)
  - **Keep Both**: Create version (blue button)
- **Action Description**: Clear explanation of what will happen

**Bulk Actions:**
- **Skip All**: Skip all duplicate files
- **Replace All**: Replace all existing files
- **Version All**: Create versions for all duplicates

**Summary**: Shows counts of each action (e.g., "2 skip, 3 replace, 1 version")

### Step 5: Confirm Resolution
- Click **"Confirm & Continue"**
- Files are uploaded with your chosen actions
- Success message shows how many files were uploaded

### Step 6: Upload Complete
- Data automatically refreshes
- File counts update in the table
- Progress bars reflect new uploads

## Examples

### Example 1: Single Duplicate - Replace
```
You're uploading: PO-ABC123_new.pdf
Existing file: PO-ABC123.pdf

Action: Replace
Result: Old file deleted, new file uploaded as "PO-ABC123.pdf"
```

### Example 2: Single Duplicate - Version
```
You're uploading: invoice.pdf
Existing file: invoice.pdf

Action: Keep Both
Result: Both files exist
  - invoice.pdf (original)
  - invoice_v2.pdf (new upload)
```

### Example 3: Multiple Duplicates - Mixed Actions
```
Uploading 5 files, 3 are duplicates:

File 1 (duplicate): PO-123.pdf → Skip
File 2 (duplicate): SO-456.pdf → Replace
File 3 (duplicate): invoice.pdf → Keep Both (becomes invoice_v2.pdf)
File 4 (new): PO-789.pdf → Upload normally
File 5 (new): SO-101.pdf → Upload normally

Result:
- PO-123.pdf: Original kept, new file skipped
- SO-456.pdf: New file replaces original
- invoice.pdf: Original kept
- invoice_v2.pdf: New file uploaded
- PO-789.pdf: Uploaded
- SO-101.pdf: Uploaded
```

### Example 4: Multiple Versions
```
Existing files:
  - report.pdf
  - report_v2.pdf

You upload: report.pdf

Action: Keep Both
Result: Uploaded as "report_v3.pdf" (system found next available version)
```

## Best Practices

### When to Skip
- Accidentally selected the same file twice
- File already uploaded and hasn't changed
- Wrong file selected for this batch

### When to Replace
- You have an updated/corrected version of the document
- Original file had errors or missing information
- Client provided a revised version

### When to Keep Both (Version)
- Tracking revisions over time
- Multiple amendments to the same PO
- Want to maintain audit trail
- Unsure which version is correct (keep both for comparison)

## Version Numbering

The system automatically handles versioning:
- **Original**: `filename.pdf`
- **First duplicate**: `filename_v2.pdf`
- **Second duplicate**: `filename_v3.pdf`
- **Nth duplicate**: `filename_vN.pdf`

**Smart Version Detection:**
- If you already have `filename.pdf` and `filename_v2.pdf`
- Next upload will be `filename_v3.pdf` (not v2 again)
- Works up to v100 (prevents infinite loops)

## Technical Details

### Storage Locations

**Local Storage:**
```
C:\YourPath\FSC_Uploads\
  └── Batch_12345\
      ├── 1_PurchaseOrders\
      │   ├── PO-ABC123.pdf
      │   └── PO-ABC123_v2.pdf
      ├── 2_SalesOrders\
      ├── 3_SupplierInvoices\
      └── 4_CustomerInvoices\
```

**OneDrive:**
```
/FSC_Uploads/
  └── Batch_12345/
      ├── 1_PurchaseOrders/
      │   ├── PO-ABC123.pdf
      │   └── PO-ABC123_v2.pdf
      ├── 2_SalesOrders/
      ├── 3_SupplierInvoices/
      └── 4_CustomerInvoices/
```

### Duplicate Detection Methods

**Local Storage:**
- Checks `.upload-history.json` file
- Fast and accurate
- Works offline

**OneDrive:**
- Currently simplified (doesn't check remote files during bulk upload)
- OneDrive will prompt on conflict during individual uploads
- Future enhancement: full OneDrive file listing

### Upload Process Flow

```
1. User selects files → Bulk Upload Modal
2. AI analyzes filenames → Shows analysis results
3. User confirms → Triggers handleBulkUpload()
4. System detects duplicates → detectDuplicates()
5. If duplicates exist → Show Duplicate Resolution Modal
6. User resolves duplicates → handleDuplicateResolution()
7. Apply versioning if needed → applyVersioning()
8. Actual file upload → performBulkUpload()
9. Upload each file → localStorageService.uploadFile() or oneDriveService.uploadFile()
10. Show success/error messages
11. Refresh data → Update file counts in table
```

### Error Handling

**Individual File Errors:**
- Continues uploading other files
- Collects error messages
- Shows summary at end: "10 uploaded, 2 failed"

**Batch Errors:**
- Shows which batch had issues
- Allows retry without re-selecting files

**Permission Errors:**
- Clear error messages
- Guidance on fixing permissions

## Keyboard Shortcuts (Future)

- `Ctrl+A` in file selector: Select all files
- `Esc`: Cancel/close modal
- `Enter`: Confirm action
- `1-3`: Quick action selection (Skip/Replace/Version)

## FAQ

**Q: What happens if I close the app during upload?**
A: Upload will stop. Files already uploaded will remain. Re-upload remaining files.

**Q: Can I undo a replace action?**
A: No, replace is permanent. Always check carefully before confirming.

**Q: How do I know which version is the latest?**
A: Higher version numbers are newer. `_v3` is newer than `_v2`.

**Q: Can I rename versions later?**
A: Yes, use the file management features in the expanded row.

**Q: Do versions count separately towards batch completion?**
A: No, only one file per document type is required. Versions are extras.

**Q: Can I delete old versions?**
A: Yes, manually in the file system. Future feature: version management UI.

**Q: What if I select 100 files and 50 are duplicates?**
A: You'll see one resolution screen for all 50. Use "Skip All" or "Version All" for quick resolution.

## Troubleshooting

**Problem: Duplicate modal doesn't appear**
- Check that storage service is configured and connected
- For local storage: ensure path is valid
- For OneDrive: ensure authenticated

**Problem: Versioning creates wrong numbers**
- System checks existing files before assigning version
- If files were added manually, history might be out of sync
- Use "Scan & Rebuild History" in settings

**Problem: Upload fails with permission error**
- Local: Check folder write permissions
- OneDrive: Re-authenticate and grant permissions

**Problem: Files uploaded but counts don't update**
- Click the refresh button in header
- Or wait a few seconds and reload page

## Future Enhancements

- Visual diff between duplicate versions
- Automatic file comparison (size, date, content hash)
- Bulk version management (delete all v2 files, promote v3 to main, etc.)
- Upload resume after interruption
- Parallel uploads for faster bulk operations
- Intelligent suggestions based on file metadata
- Version history viewer with side-by-side comparison

## Related Features

- **AI File Analysis**: See `ENHANCED_AI_MATCHING.md`
- **Bulk Upload Guide**: See `BULK_UPLOAD_GUIDE.md`
- **File Management**: Individual file operations in expanded rows
- **Upload History**: Track all uploads with `.upload-history.json`
