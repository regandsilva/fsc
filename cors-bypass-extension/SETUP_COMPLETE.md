# 🎯 CORS Bypass Extension - COMPLETE ✅

## What You Got

A **Chrome/Edge browser extension** that enables URL uploads from Cin7 in your FSC Document Hub by bypassing CORS restrictions.

---

## 📁 Extension Files Created

```
cors-bypass-extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (handles CORS bypass)
├── rules.json            # CORS header modification rules
├── icon16.png            # Extension icon (small)
├── icon48.png            # Extension icon (medium)
├── icon128.png           # Extension icon (large)
├── INSTALL.md            # Quick installation guide
└── README.md             # Full documentation
```

---

## 🚀 Quick Install (2 Minutes)

### Step 1: Open Chrome Extensions
Type in address bar: `chrome://extensions/`

### Step 2: Enable Developer Mode
Toggle the switch in the **top-right corner**

### Step 3: Load Extension
1. Click **"Load unpacked"**
2. Navigate to: `fsc-document-hub/cors-bypass-extension`
3. Click **"Select Folder"**

### Step 4: Verify
You should see: **"FSC Document Hub - CORS Bypass"** with status **Enabled**

---

## ✅ Testing

1. Go to: https://regandsilva.github.io/fsc-document-hub/
2. Click **"From URL"** toggle at the top
3. Click any upload cell
4. Paste this Cin7 URL:
   ```
   https://go.cin7.com/Cloud/Docs/PDF/?T=Purchase%20Order&idWebSite=26606&UN=ap&ID=4091&SID=163195373
   ```
5. Press **Enter**
6. ✅ PDF should download successfully (no CORS error!)

---

## 🔒 Security

**What the extension does:**
- ✅ Adds CORS headers ONLY for `go.cin7.com`
- ✅ Works ONLY with your FSC Document Hub site
- ✅ All processing happens locally in your browser
- ✅ No data sent to external servers

**What the extension does NOT do:**
- ❌ Does NOT affect other websites
- ❌ Does NOT collect any data
- ❌ Does NOT modify other browser behavior

---

## 🎨 Customize Icons (Optional)

The extension currently has minimal placeholder icons. To add custom icons:

1. Create 3 PNG images (use any image editor):
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)  
   - `icon128.png` (128x128 pixels)

2. Replace the existing icon files in `cors-bypass-extension/`

3. Reload the extension in `chrome://extensions/`

**Suggested design:** FSC logo or letters with a shield/unlock symbol

---

## 🔧 Troubleshooting

### Still Getting CORS Errors?

1. **Check extension is enabled:**
   - Go to `chrome://extensions/`
   - Ensure toggle is blue/ON

2. **Hard refresh the FSC Document Hub:**
   - Press `Ctrl + Shift + R`

3. **Reload the extension:**
   - Click refresh icon on extension card
   - Refresh FSC Document Hub page

4. **Check browser console:**
   - Press `F12` on FSC Document Hub
   - Look for "CORS rule applied" messages

### Extension Won't Install?

- Make sure you're using Chrome, Edge, or Brave (not Firefox)
- Developer mode must be enabled
- Select the folder containing `manifest.json`

---

## 📦 Distribution Options

### Current: Manual Installation
- Users install from local folder
- Best for internal team use
- No approval process needed

### Alternative: Chrome Web Store
If you want easier distribution:
1. Zip the `cors-bypass-extension` folder
2. Create Chrome Web Store developer account ($5 one-time fee)
3. Submit for review (takes 1-3 days)
4. Users can install with one click

Let me know if you want help with Web Store submission!

---

## 🎉 Summary

✅ Extension created and ready to use
✅ Enables Cin7 URL uploads in FSC Document Hub  
✅ No public servers involved (all local)
✅ Works with your GitHub Pages deployment
✅ Easy to install and test

**Next Steps:**
1. Install the extension (2 minutes)
2. Test with a Cin7 URL
3. Share the `cors-bypass-extension` folder with your team

---

## 💡 How It Works

```
Before Extension:
Browser → Cin7 URL → ❌ CORS Error (blocked by browser)

After Extension:
Browser → Extension intercepts → Adds CORS headers → ✅ Success!
```

The extension uses Chrome's `declarativeNetRequest` API to modify HTTP response headers from Cin7, making them CORS-compatible.

---

## 📞 Support

If you need help:
1. Read `INSTALL.md` for quick start
2. Read `README.md` for full documentation  
3. Check browser console (F12) for errors
4. Ask me if you get stuck!

Enjoy seamless URL uploads! 🚀
