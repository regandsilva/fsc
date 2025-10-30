# Secure Backend Proxy Server

## Overview

This is a secure, self-hosted proxy server that handles PDF fetching from external URLs (like Cin7) without exposing your data to third-party services.

## Why Use This?

✅ **Security**: Your URLs and data never pass through third-party services  
✅ **Privacy**: All PDF fetching happens on your own server  
✅ **Control**: You own and control the code  
✅ **Reliability**: No dependency on external proxy services  
✅ **No Rate Limits**: Fetch as many PDFs as you need  

## Setup Instructions

### 1. Install Dependencies (Already Done)

```bash
npm install express cors
```

### 2. Start the Proxy Server

Open a **new terminal** and run:

```bash
npm run proxy
```

You should see:
```
🚀 CORS Proxy Server running on http://localhost:3001
📋 Health check: http://localhost:3001/health
🔗 Proxy endpoint: http://localhost:3001/fetch-pdf?url=YOUR_URL
```

### 3. Start Your Main App (In Another Terminal)

```bash
npm run dev
```

Now both servers are running:
- **Frontend**: http://localhost:3000/fsc-document-hub/
- **Proxy**: http://localhost:3001

## How It Works

1. User clicks "From URL" toggle
2. User clicks "Upload" button in table
3. User pastes PDF URL (e.g., Cin7 URL)
4. Frontend sends request to **your local proxy** (port 3001)
5. Proxy server fetches PDF from Cin7
6. Proxy streams PDF back to frontend
7. Frontend saves PDF to local storage

**Your data never leaves your control!**

## Configuration

### Allow Specific Domains (Optional)

Edit `proxy-server.js` and uncomment lines 32-35:

```javascript
const allowedDomains = [
  'go.cin7.com',
  'yourdomain.com',
  // Add more trusted domains
];

// Uncomment this check:
if (!allowedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
  return res.status(403).json({ error: 'Domain not allowed' });
}
```

### Change Port

Edit `proxy-server.js`:

```javascript
const PORT = 3001; // Change to your preferred port
```

Then update the proxy URL in:
- `components/DataTable.tsx` (line ~144)
- `components/FileManagementRow.tsx` (line ~106)

## Production Deployment

### Option 1: Same Server as Frontend

Deploy both frontend and proxy to the same server/domain.

### Option 2: Separate Proxy Server

1. Deploy `proxy-server.js` to a Node.js hosting service:
   - Heroku
   - Render
   - Railway
   - DigitalOcean

2. Update the proxy URL in your code to use the production URL:
   ```javascript
   const proxyUrl = `https://your-proxy.example.com/fetch-pdf?url=${encodeURIComponent(url)}`;
   ```

### Option 3: Add to Existing Backend

If you already have a backend API, add this endpoint to it.

## Testing

Test the proxy directly:

```bash
curl "http://localhost:3001/health"
```

Should return:
```json
{"status":"ok","message":"Proxy server is running"}
```

Test PDF fetching:
```bash
curl "http://localhost:3001/fetch-pdf?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
```

## Security Features

✅ URL validation  
✅ Domain whitelisting (optional)  
✅ Error handling  
✅ No data logging (privacy-first)  
✅ Proper CORS headers  
✅ Stream-based (memory efficient)  

## Troubleshooting

### "Cannot find module 'express'"
Run: `npm install express cors`

### "Port 3001 already in use"
Change `PORT` in `proxy-server.js` to a different number (e.g., 3002)

### "Failed to fetch PDF"
- Check if proxy server is running (`npm run proxy`)
- Check if the URL is accessible
- Check browser console for errors

### CORS errors
- Make sure proxy server is running on port 3001
- Check that CORS origin matches your frontend URL

## Running Both Servers

### Windows (PowerShell):
**Terminal 1:**
```powershell
npm run proxy
```

**Terminal 2:**
```powershell
npm run dev
```

### macOS/Linux:
**Terminal 1:**
```bash
npm run proxy
```

**Terminal 2:**
```bash
npm run dev
```

### Alternative: Single Command (Optional)

Install `concurrently`:
```bash
npm install --save-dev concurrently
```

Update `package.json`:
```json
"scripts": {
  "dev": "vite",
  "proxy": "node proxy-server.js",
  "start": "concurrently \"npm run proxy\" \"npm run dev\""
}
```

Then run: `npm start`

## Support

If you encounter issues, check:
1. Both servers are running
2. Ports 3000 and 3001 are available
3. No firewall blocking localhost connections
4. URL is accessible from your network

---

**Created**: October 30, 2025  
**Status**: Production Ready ✅
