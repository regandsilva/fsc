# FSC Document Hub - CORS Bypass Extension

## What This Extension Does

This Chrome/Edge extension enables URL uploads from Cin7 in the FSC Document Hub by bypassing CORS (Cross-Origin Resource Sharing) restrictions.

**Without this extension:** Cin7 URLs fail with CORS error
**With this extension:** Cin7 URLs load successfully

## Security Note

This extension **ONLY** modifies headers for:
- `go.cin7.com` (Cin7 server)
- `regandsilva.github.io` (FSC Document Hub)

It does NOT affect any other websites or compromise your browser security.

---

## Installation Instructions

### Step 1: Locate the Extension Folder

The extension files are in:
```
fsc-document-hub/cors-bypass-extension/
```

### Step 2: Open Chrome/Edge Extensions Page

**Chrome:**
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)

**Edge:**
1. Open Edge
2. Go to `edge://extensions/`
3. Enable "Developer mode" (toggle in bottom-left)

### Step 3: Load the Extension

1. Click "Load unpacked"
2. Navigate to the `cors-bypass-extension` folder
3. Click "Select Folder"

### Step 4: Verify Installation

You should see:
- **Extension name:** FSC Document Hub - CORS Bypass
- **Status:** Enabled
- **Icon:** (placeholder icons - you can add custom ones)

---

## Testing

1. Open FSC Document Hub: https://regandsilva.github.io/fsc-document-hub/
2. Click "From URL" toggle at the top
3. Click on any upload cell
4. Paste a Cin7 URL, for example:
   ```
   https://go.cin7.com/Cloud/Docs/PDF/?T=Purchase%20Order&idWebSite=26606&UN=ap&ID=4091&SID=163195373
   ```
5. Press Enter or click the load button
6. The PDF should download successfully ✅

---

## How It Works

The extension uses Chrome's `declarativeNetRequest` API to:
1. Intercept responses from `go.cin7.com`
2. Add CORS headers: `Access-Control-Allow-Origin: *`
3. Allow the FSC Document Hub to access the PDFs

**No data is sent to external servers** - the extension only modifies HTTP headers in your local browser.

---

## Troubleshooting

### Extension Not Working?

1. **Check if enabled:**
   - Go to `chrome://extensions/`
   - Ensure the extension is ON (blue toggle)

2. **Reload the extension:**
   - Click the refresh icon on the extension card
   - Reload the FSC Document Hub page

3. **Check browser console:**
   - Press F12 in the FSC Document Hub
   - Look for: `"CORS rule applied"` messages
   - Look for any error messages

### Still Getting CORS Errors?

1. **Hard refresh the page:** Ctrl + Shift + R
2. **Check the URL:** Make sure it starts with `https://go.cin7.com/`
3. **Reinstall extension:** Remove and re-add using "Load unpacked"

---

## Adding Custom Icons (Optional)

The extension currently uses placeholder icons. To add custom icons:

1. Create 3 PNG images:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)

2. Save them in the `cors-bypass-extension` folder

3. Reload the extension

**Suggested icon:** A simple logo or the letters "FSC" with a shield or unlock symbol.

---

## Distribution Options

### Option 1: Manual Installation (Current)
- Users install from local folder
- Best for internal team use
- No Chrome Web Store approval needed

### Option 2: Chrome Web Store
- Package as `.crx` file
- Submit to Chrome Web Store
- Users install with one click
- Requires developer account ($5 fee) and review process

### Option 3: Enterprise Policy
- Deploy via Group Policy for organizations
- Automatically installs for all users
- Requires IT admin access

---

## Uninstalling

To remove the extension:

1. Go to `chrome://extensions/`
2. Find "FSC Document Hub - CORS Bypass"
3. Click "Remove"

---

## Technical Details

**Permissions Used:**
- `declarativeNetRequest` - Modify HTTP headers
- `declarativeNetRequestWithHostAccess` - Access specific hosts
- `host_permissions` - Access to go.cin7.com and regandsilva.github.io

**Manifest Version:** 3 (latest Chrome extension standard)

**Browser Compatibility:**
- ✅ Chrome 88+
- ✅ Edge 88+
- ✅ Brave
- ✅ Opera
- ❌ Firefox (uses different extension API)

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Open browser console (F12) for error messages
3. Verify the extension is enabled
4. Try reloading both the extension and the FSC Document Hub

---

## License

This extension is part of the FSC Document Hub project and is intended for internal use only.
