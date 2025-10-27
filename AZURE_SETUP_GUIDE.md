# Azure AD App Registration Setup for OneDrive Integration

## Step-by-Step Guide to Create Azure App Client ID

### **Step 1: Go to Azure Portal**
1. Open your browser and go to: https://portal.azure.com
2. Sign in with your Microsoft account (the one with OneDrive access)

---

### **Step 2: Navigate to Azure Active Directory**
1. In the search bar at the top, type **"Azure Active Directory"**
2. Click on **Azure Active Directory** from the results

---

### **Step 3: Create App Registration**
1. In the left sidebar, click **"App registrations"**
2. Click **"+ New registration"** at the top

---

### **Step 4: Register the Application**

Fill in the following:

**Name:**
```
FSC Document Hub
```

**Supported account types:** Select:
```
✅ Accounts in any organizational directory (Any Azure AD directory - Multitenant) 
   and personal Microsoft accounts (e.g. Skype, Xbox)
```

**Redirect URI:**
- Platform: Select **"Mobile and desktop applications"**
- URI: Enter exactly:
```
fsc-app://auth
```

⚠️ **IMPORTANT**: The redirect URI must be exactly `fsc-app://auth` for the Electron app to work!

Click **"Register"**

---

### **Step 5: Copy the Application (Client) ID**

After registration, you'll see the overview page:

1. Look for **"Application (client) ID"** on the overview page
2. It looks like: `12345678-1234-1234-1234-123456789abc`
3. Click the **copy icon** next to it
4. **Save this ID** - you'll paste it into the FSC Document Hub settings

---

### **Step 6: Configure API Permissions**

1. In the left sidebar, click **"API permissions"**
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Select **"Delegated permissions"**
5. Search for and check these permissions:
   - ✅ **User.Read** (should already be there)
   - ✅ **Files.ReadWrite.All**
6. Click **"Add permissions"**

**Optional but Recommended:**
- Click **"Grant admin consent for [your organization]"** if you see that button
- This pre-approves the permissions

---

### **Step 7: Verify Authentication Settings**

1. In the left sidebar, click **"Authentication"**
2. Verify under **"Mobile and desktop applications"**:
   - ✅ `fsc-app://auth` is listed
3. Scroll down to **"Advanced settings"**
4. Under **"Allow public client flows"**: Set to **"Yes"**
5. Click **"Save"** at the top

---

## Configuration Summary

Your Azure AD App should have:

| Setting | Value |
|---------|-------|
| **App Name** | FSC Document Hub (or your choice) |
| **Account Types** | Multitenant + Personal Microsoft accounts |
| **Redirect URI** | `fsc-app://auth` |
| **Platform Type** | Mobile and desktop applications |
| **Permissions** | `User.Read`, `Files.ReadWrite.All` |
| **Public Client** | Yes |

---

## Using the Client ID in FSC Document Hub

### **Step 8: Enter Client ID in App**

1. Open the FSC Document Hub Electron app
2. Click the **Settings** icon (gear icon at top right)
3. Scroll to **"OneDrive Integration"** section
4. In the **"Application (Client) ID"** field:
   - Paste the Client ID you copied from Azure
   - Example: `12345678-1234-1234-1234-123456789abc`
5. The app will **automatically save** this setting
6. Click **"Login to OneDrive"** button
7. A browser popup will open for authentication
8. Sign in with your Microsoft account
9. Approve the permissions
10. You'll be redirected back and logged in! ✅

---

## Troubleshooting

### **Issue: "Redirect URI mismatch" error**
**Solution:** 
- Go back to Azure Portal → Your App → Authentication
- Make sure redirect URI is exactly: `fsc-app://auth`
- No trailing slashes, no extra characters

### **Issue: "AADSTS50011: The reply URL specified in the request does not match"**
**Solution:**
- The redirect URI in Azure must match exactly: `fsc-app://auth`
- Make sure it's under "Mobile and desktop applications" platform

### **Issue: "Files.ReadWrite.All requires admin approval"**
**Solution:**
- Personal Microsoft accounts: No approval needed
- Work/School accounts: Ask your IT admin to grant consent

### **Issue: Login popup doesn't redirect back**
**Solution:**
- Close the app completely
- Delete settings file: `%APPDATA%\fsc-document-hub\fsc-settings.json`
- Restart the app and try again

### **Issue: "AADSTS7000218: The request body must contain the following parameter: 'client_assertion'"**
**Solution:**
- Go to Azure Portal → Your App → Authentication
- Scroll to "Advanced settings"
- Set "Allow public client flows" to **Yes**
- Click Save

---

## Testing Your Setup

### **Quick Test:**
1. Enter the Client ID in FSC Document Hub settings
2. Click "Login to OneDrive"
3. Browser popup should open
4. Sign in with your Microsoft account
5. Approve permissions
6. Should redirect back and show: "Logged in as: your@email.com"

### **Upload Test:**
1. After logging in, fetch some Airtable data
2. Expand a row
3. Add a document (PO, invoice, etc.)
4. Click upload
5. File should upload to your OneDrive in the specified path

---

## Security Notes

- ✅ **Client ID is not a secret** - It's safe to store in the app
- ✅ **Access tokens** are stored securely by MSAL in localStorage
- ✅ **Tokens expire** after a period and auto-refresh
- ✅ **You can revoke access** at any time in your Microsoft account settings

---

## What Permissions Do?

**User.Read:**
- Allows the app to see your name and email
- Used to display "Logged in as: your@email.com"

**Files.ReadWrite.All:**
- Allows the app to upload files to your OneDrive
- Allows the app to create folders
- Does NOT allow access to files created by other apps (unless you explicitly share)

---

## Complete Azure Portal URL Reference

- **Azure Portal**: https://portal.azure.com
- **App Registrations**: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
- **Microsoft Account Permissions**: https://account.microsoft.com/privacy/app-access

---

## Need Help?

If you encounter issues:
1. Double-check the redirect URI: `fsc-app://auth`
2. Verify "Allow public client flows" is set to "Yes"
3. Make sure both permissions are added
4. Try logging out and back in
5. Check the app console (Ctrl+Shift+I in dev mode) for error messages

---

## Your Client ID is Ready! 🎉

Once you have your Client ID:
1. Paste it into FSC Document Hub settings
2. Click "Login to OneDrive"
3. Start uploading files!

The settings will be saved automatically and persist between app restarts.
