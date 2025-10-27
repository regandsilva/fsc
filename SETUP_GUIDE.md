# 🚀 Quick Start Guide - FSC Document Hub (Electron)

## Installation & Running

### Step 1: Install Dependencies
```powershell
npm install
```

### Step 2: Run the Desktop App
```powershell
npm run electron:dev
```

**OR** double-click `start.bat` (Windows)

The app will:
1. Start the Vite dev server on http://localhost:3000
2. Wait for the server to be ready
3. Launch the Electron desktop window

---

## ✅ What's Been Set Up

### 1. **Persistent Settings** ✅
- All your settings are **automatically saved** when you enter them
- Settings persist between app restarts
- Stored securely using `electron-store` in:
  - Windows: `%APPDATA%\fsc-document-hub\fsc-settings.json`

### 2. **OneDrive Integration** ✅
- Fixed for Electron with custom protocol: `fsc-app://auth`
- OAuth login works properly in desktop app
- Proper redirect handling

### 3. **Desktop App Features** ✅
- Native Windows application
- Runs completely offline (after initial setup)
- No browser needed
- System tray integration ready

---

## 📋 Configuration Guide

### First Time Setup

1. **Launch the app** using `npm run electron:dev` or `start.bat`

2. **Configure Airtable** (Settings Panel):
   - **API Key**: Get from https://airtable.com/account
   - **Base ID**: From your Airtable URL (e.g., `appXXXXXXXX`)
   - **Table Name**: Your FSC records table name (e.g., "FSC Report")
   - Click "Fetch Airtable Data"

3. **Configure OneDrive** (Optional - Settings Panel):
   - **Application (Client) ID**: 
     - Go to https://portal.azure.com
     - Create App Registration
     - Set Redirect URI to: `fsc-app://auth` ⚠️ **Important for Electron!**
     - Add permissions: `User.Read`, `Files.ReadWrite.All`
     - Copy the Client ID
   - **OneDrive Base Path**: e.g., `/FSC_Uploads`
   - Click "Login to OneDrive"

4. **Your settings will be saved automatically!** 🎉

---

## 🔧 Verifying OneDrive Integration

### Check Azure AD App Setup

1. Go to https://portal.azure.com
2. Navigate to: **Azure Active Directory** > **App registrations**
3. Select your app
4. Check **Authentication** section:
   - Platform: "Mobile and desktop applications"
   - Redirect URI: `fsc-app://auth` ✅
5. Check **API Permissions**:
   - Microsoft Graph > `User.Read` ✅
   - Microsoft Graph > `Files.ReadWrite.All` ✅
   - Grant admin consent if needed

### Testing OneDrive Login

1. Enter your Client ID in settings
2. Click "Login to OneDrive"
3. Browser window opens for authentication
4. After login, you'll be redirected back
5. Status should show "Logged in as: your@email.com"

### Troubleshooting OneDrive

**Issue: Login popup doesn't work**
- Solution: Add `fsc-app://auth` to Azure AD redirect URIs

**Issue: "Redirect URI mismatch"**
- Solution: Make sure redirect URI in Azure matches exactly: `fsc-app://auth`

**Issue: Login works but doesn't redirect back**
- Solution: Close app, clear settings, restart:
  ```powershell
  Remove-Item "$env:APPDATA\fsc-document-hub\fsc-settings.json"
  ```

---

## 📦 Building the Desktop App

### Create Windows Installer

```powershell
npm run electron:build:win
```

This creates:
- `release/FSC Document Hub Setup X.X.X.exe` - Installer
- `release/win-unpacked/` - Portable version

### Build for All Platforms

```powershell
npm run electron:build
```

---

## 🎯 Features Verification Checklist

- [x] Settings persistence (save/load automatically)
- [x] OneDrive authentication (custom protocol)
- [x] Electron app runs properly
- [x] Vite dev server integration
- [x] Build scripts configured
- [x] TypeScript compilation
- [x] IPC communication (main ↔ renderer)

---

## 📁 Project Structure

```
fsc-document-hub/
├── electron/
│   ├── main.ts           ← Main process (window management, IPC)
│   ├── preload.ts        ← Preload script (secure IPC bridge)
│   └── tsconfig.json     ← TS config for Electron
├── utils/
│   └── electronStore.ts  ← Settings persistence helper
├── services/
│   └── oneDriveService.ts ← Updated for Electron OAuth
├── dist-electron/        ← Compiled Electron code
├── release/             ← Built installers
└── start.bat            ← Quick start script
```

---

## 🐛 Common Issues

### 1. Dependencies Not Installed
**Symptom**: App won't start, missing modules
**Solution**:
```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

### 2. Electron Won't Start
**Symptom**: Command runs but no window appears
**Solution**: Check if port 3000 is already in use:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
npm run electron:dev
```

### 3. TypeScript Errors
**Symptom**: Red underlines in editor
**Solution**: These are expected before `npm install` completes. Errors will clear after installation.

### 4. Settings Not Saving
**Symptom**: Settings reset on restart
**Solution**: Check if settings file exists:
```powershell
explorer "$env:APPDATA\fsc-document-hub"
```

---

## 🎉 You're All Set!

Your FSC Document Hub is now:
- ✅ An Electron desktop app
- ✅ Saving settings automatically
- ✅ Ready for OneDrive integration
- ✅ Buildable as a Windows installer

**Next Steps:**
1. Run `npm run electron:dev` to start developing
2. Configure your Airtable and OneDrive settings
3. Start managing your FSC documents!

---

## 📞 Support

For issues:
1. Check this guide first
2. Review `ELECTRON_README.md` for detailed docs
3. Check console for errors (Ctrl+Shift+I in dev mode)
