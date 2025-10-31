# Installation Visual Guide

## Step-by-Step with Screenshots Reference

### 1️⃣ Open Extensions Page

**In Chrome:**
- Type in address bar: `chrome://extensions/`
- Press Enter

**In Edge:**
- Type in address bar: `edge://extensions/`
- Press Enter

---

### 2️⃣ Enable Developer Mode

You'll see a page with a list of extensions. Look for:

**In Chrome:**
- Top-right corner: Toggle switch labeled "Developer mode"
- Click to turn it ON (blue)

**In Edge:**
- Bottom-left: Toggle switch labeled "Developer mode"
- Click to turn it ON (blue)

---

### 3️⃣ Load Unpacked Extension

After enabling Developer mode, you'll see new buttons appear:

1. Click the **"Load unpacked"** button (top-left area)

2. A file browser will open

3. Navigate to:
   ```
   C:\Users\regan\OneDrive - Wrapology International Ltd\Desktop\fsc-document-hub\cors-bypass-extension
   ```

4. **IMPORTANT:** Select the entire `cors-bypass-extension` folder (not individual files)

5. Click **"Select Folder"** or **"Open"**

---

### 4️⃣ Verify Installation

You should now see a new extension card:

```
┌─────────────────────────────────────────────┐
│ FSC Document Hub - CORS Bypass         ON   │
│ Version 1.0.0                                │
│ ID: [random chrome ID]                       │
│                                              │
│ Enables URL uploads from Cin7 by bypassing  │
│ CORS restrictions for FSC Document Hub      │
│                                              │
│ [Details] [Remove] [🔄 Reload]              │
└─────────────────────────────────────────────┘
```

✅ **Success indicators:**
- Extension appears in the list
- Toggle is ON (blue)
- No error messages

---

### 5️⃣ Test the Extension

1. **Open FSC Document Hub:**
   ```
   https://regandsilva.github.io/fsc-document-hub/
   ```

2. **Switch to URL mode:**
   - Click "From URL" button at the top

3. **Try uploading from Cin7:**
   - Click any upload cell (PO, SO, etc.)
   - Paste a Cin7 URL
   - Press Enter

4. **Expected result:**
   - ✅ PDF loads successfully
   - ✅ Green checkmark appears
   - ✅ File shows as uploaded

---

## Common Issues

### ❌ "Load unpacked" button not visible
**Fix:** Enable Developer mode first (see Step 2)

### ❌ "Manifest file is missing or unreadable"
**Fix:** Make sure you selected the `cors-bypass-extension` folder, not a file inside it

### ❌ Extension loads but CORS error persists
**Fix:** 
1. Hard refresh FSC Document Hub: `Ctrl + Shift + R`
2. Click reload icon on extension card
3. Check extension is ON (toggle should be blue)

### ❌ "This extension may have been corrupted"
**Fix:**
1. Remove the extension
2. Run `node generate-icons.cjs` again in the extension folder
3. Reinstall

---

## What You Should See

### Extension Page (chrome://extensions/)
```
Developer mode: ON

┌─ FSC Document Hub - CORS Bypass ──────────┐
│ [icon] Version 1.0.0              [ON]    │
│ Enables URL uploads from Cin7...          │
│ ID: abcd1234...                            │
└───────────────────────────────────────────┘
```

### FSC Document Hub Page
```
[Browse Files] [From URL] ← Click "From URL"

PO Upload: [Click to enter URL] ← Click here
           ↓
           [Enter PDF URL...] ← Paste Cin7 URL
           [✓ Load] [✕]
```

### Success State
```
PO Upload: ✓ filename.pdf (123 KB)
```

---

## Sharing with Team

To share this extension with your team:

1. **Zip the folder:**
   - Right-click `cors-bypass-extension` folder
   - Select "Send to" → "Compressed (zipped) folder"

2. **Send the zip file** to team members

3. **Provide these instructions:**
   - Extract the zip file
   - Follow steps 1-4 above
   - Test with FSC Document Hub

---

## Updating the Extension

If you make changes to the extension files:

1. Go to `chrome://extensions/`
2. Find "FSC Document Hub - CORS Bypass"
3. Click the **🔄 reload icon**
4. Refresh the FSC Document Hub page

---

## Uninstalling

To remove the extension:

1. Go to `chrome://extensions/`
2. Find "FSC Document Hub - CORS Bypass"
3. Click **"Remove"**
4. Confirm removal

---

## Browser Compatibility

✅ **Works with:**
- Google Chrome (version 88+)
- Microsoft Edge (version 88+)
- Brave Browser
- Opera

❌ **Does NOT work with:**
- Firefox (different extension API)
- Safari (no Manifest V3 support)
- Internet Explorer (deprecated)

---

## Need Help?

1. Read `INSTALL.md` for quick start
2. Read `README.md` for detailed docs
3. Check browser console (F12) for errors
4. Ask for assistance if stuck

Happy uploading! 🚀
