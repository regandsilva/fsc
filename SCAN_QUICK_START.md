# Quick Start: Scan & Rebuild Upload History

## 🚀 Usage Steps

### 1. Open Settings
Click the ⚙️ gear icon in the top right corner.

### 2. Select Local Storage Mode
- Choose **"Local PC Folder"** under Storage Mode
- Click **"Browse"** and select your upload folder
- The folder should be where your batch folders are stored

### 3. Load Airtable Data
Click **"Fetch Airtable Data"** to load current batch records from Airtable.

### 4. Run the Scan
- Scroll to **"Upload History Maintenance"** section
- Click **"🔍 Scan & Rebuild Upload History"** button
- Wait for the scan to complete (shows progress)

### 5. Review Results
- ✅ See how many files were found
- ➕ Check new entries added
- ⚠️ Review any orphaned files warnings
- 💾 Backup is automatically created

---

## ⚡ Quick Test

Try scanning with these steps:

```bash
# Your folder structure should look like:
YourFolder/
├── 6024/
│   └── Purchase Order/
│       └── some-file.pdf
└── 6025/
    └── Sales Order/
        └── another-file.pdf
```

1. Select `YourFolder` as local storage path
2. Fetch Airtable data (must have batches 6024, 6025)
3. Click "Scan & Rebuild Upload History"
4. Should find 2 files!

---

## 💡 Tips

- **Run periodically** to keep log accurate
- **After manual file moves** to sync the log
- **Before backing up** to ensure log is current
- **When counts look wrong** on upload indicators

## ⚠️ Important Notes

- Browser must be **Chrome or Edge** (File System Access API required)
- You need **read/write permission** to the folder
- **Backup is created automatically** before rebuilding
- **Files are never deleted or moved** - read-only scan

## 🆘 Common Issues

**Button not showing?**
→ Make sure "Local PC Folder" mode is selected and folder path is set

**Permission errors?**
→ Click "Allow" when browser asks for folder access

**0 files found?**
→ Check folder structure: `{BatchNumber}/{DocType}/{files}`

**Orphaned files warning?**
→ Those batch numbers don't exist in your Airtable data
