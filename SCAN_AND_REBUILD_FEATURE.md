# 🔍 Scan & Rebuild Upload History Feature

## Overview

The **Scan & Rebuild Upload History** feature allows you to reconstruct your `.upload-history.json` file by scanning all folders and subfolders in your local storage directory. This is useful for disaster recovery if the log file gets corrupted or deleted.

## When to Use

- ✅ Upload history file (`.upload-history.json`) was accidentally deleted
- ✅ Upload history file became corrupted
- ✅ Files were uploaded outside the app (manually copied)
- ✅ Periodic audit to ensure data integrity
- ✅ After moving/reorganizing files manually
- ✅ Upload status indicators showing incorrect information

## How It Works

### 1. **Automatic Folder Scanning**
   - Recursively scans your local storage base folder
   - Identifies batch number folders (e.g., `6024`, `6025`)
   - Finds document type subfolders (Purchase Order, Sales Order, etc.)
   - Catalogs all files in each location

### 2. **Validation Against Airtable**
   - Compares found batch numbers against your Airtable records
   - Flags "orphaned files" in folders that don't match any batch
   - Ensures only valid batches are logged

### 3. **Smart Merge**
   - Preserves original upload timestamps from existing log
   - Uses file's last modified date for newly discovered files
   - Adds new entries for files not in the old log
   - Creates automatic backup before rebuilding

### 4. **Safety Features**
   - Always creates a timestamped backup (`.upload-history.backup-TIMESTAMP.json`)
   - Non-destructive - original files are never touched
   - Shows detailed results with warnings

## How to Use

### Step 1: Configure Local Storage
1. Open Settings (gear icon)
2. Select **"Local PC Folder"** as storage mode
3. Click **"Browse"** and select your local storage folder
4. Click **"Fetch Airtable Data"** to load batch records

### Step 2: Run the Scan
1. In Settings, scroll to **"Upload History Maintenance"** section
2. Click **"Scan & Rebuild Upload History"**
3. Watch the progress indicator as it scans folders
4. Review the results summary

### Step 3: Review Results
The scan will show:
- ✅ **Files Found**: Total number of files discovered
- ➕ **New Entries Added**: Files not in the previous log
- 📋 **Existing Entries Preserved**: Files already logged
- ⚠️ **Orphaned Files**: Files in unknown batch folders
- 💾 **Backup Created**: Location of the backup file

## Result Examples

### ✅ Successful Scan
```
✅ Scan Completed Successfully

✅ 245 files found
➕ 12 new entries added to log
📋  233 existing entries preserved
💾 Backup created: .upload-history.backup-1704067200000.json
```

### ⚠️ With Orphaned Files
```
⚠️ 3 Orphaned Files Found

These files are in folders that don't match any batch numbers from Airtable:
• 9999/Purchase Order/test.pdf
• UNKNOWN/Sales Order/old_file.xlsx
• temp/Customer Invoice/backup.pdf
```

## Technical Details

### File Structure Expected
```
LocalStorageFolder/
├── .upload-history.json              ← Main log file
├── .upload-history.backup-*.json     ← Automatic backups
├── 6024/                             ← Batch folder
│   ├── Purchase Order/
│   │   └── 6024 - Purchase Order - PO123.pdf
│   └── Sales Order/
│       └── 6024 - Sales Order - SO456.pdf
└── 6025/
    └── Supplier Invoice/
        └── 6025 - Supplier Invoice - INV789.pdf
```

### What Gets Logged
Each file entry contains:
- `batchNumber`: The batch folder name
- `docType`: Document type (Purchase Order, Sales Order, etc.)
- `fileName`: Name of the file
- `uploadedAt`: Original timestamp or file's last modified date
- `filePath`: Relative path from base folder

### Browser Compatibility
- ✅ **Chrome/Edge** (Chromium): Full support via File System Access API
- ✅ **Firefox**: Not supported (no File System Access API)
- ✅ **Safari**: Not supported
- ⚠️ **Electron Mode**: Coming soon (requires IPC implementation)

## Limitations

1. **Web Mode Only**: Currently only works in web browsers with File System Access API
2. **Requires Folder Permission**: Browser must grant read/write permission
3. **Electron Support**: Coming in future update
4. **OneDrive Mode**: Not supported (only for local folders)

## Troubleshooting

### "No folder selected" Error
**Solution**: Click "Browse" in Settings and select your local storage folder first.

### "Permission denied" Error
**Solution**: The browser needs permission to access the folder. The app will prompt for permission - click "Allow".

### Orphaned Files Detected
**Cause**: Files exist in folders that don't match any Airtable batch numbers.

**Solutions**:
- Verify the batch numbers in Airtable
- Move files to correct batch folders
- Delete orphaned folders if they're invalid

### Scan Shows 0 Files Found
**Causes**:
- Wrong folder selected
- Folder structure doesn't match expected format
- No files have been uploaded yet

**Solution**: Check folder structure matches: `{BatchNumber}/{DocType}/{files}`

## Benefits

✅ **Disaster Recovery**: Restore lost upload history  
✅ **Data Integrity**: Verify log accuracy  
✅ **Audit Trail**: See what files exist vs what's logged  
✅ **Migration Helper**: Sync log after manual file operations  
✅ **Peace of Mind**: Automatic backups protect your data  

## Future Enhancements

- 🔄 Electron IPC implementation for desktop app
- 📊 Export scan results to CSV
- 🗑️ Option to clean up orphaned files
- ⚡ Incremental scanning (only new files)
- 📧 Email scan reports

---

**Need Help?** If the scan feature isn't working as expected, check:
1. You're using Chrome or Edge browser
2. Local storage mode is selected
3. Folder has been selected and permission granted
4. Airtable data has been fetched
