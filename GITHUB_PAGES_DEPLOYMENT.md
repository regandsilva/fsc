# GitHub Pages Production Deployment Guide

## ✅ CORS Issue Fixed!

The app now works on **GitHub Pages** (https://regandsilva.github.io) without requiring a backend server.

## How It Works Now

### Smart Fallback System:

1. **First Try**: Direct fetch from URL (no proxy)
   - If Cin7 allows CORS → Works instantly! ⚡
   - If CORS blocked → Goes to step 2

2. **Fallback**: Public CORS proxy
   - Uses `allorigins.win` as backup
   - Only used when direct fetch fails
   - Slower but works for restricted URLs

### Benefits:

✅ **Works on GitHub Pages** - No backend required  
✅ **Fast when possible** - Direct fetch is instant  
✅ **Falls back gracefully** - Uses proxy only when needed  
✅ **No localhost errors** - Works in production  
✅ **User's machine** - All processing happens locally  

## Deployment Steps

### 1. Build for Production

```bash
npm run build
```

### 2. Deploy to GitHub Pages

Your `dist/` folder is ready to deploy.

**Option A: Using GitHub Actions (Automatic)**

Already configured in your repo! Just push to main:

```bash
git add .
git commit -m "Fixed CORS for production"
git push origin main
```

**Option B: Manual Deploy**

```bash
# Deploy dist folder to gh-pages branch
npm install -g gh-pages
gh-pages -d dist
```

### 3. Access Your App

Visit: https://regandsilva.github.io/fsc-document-hub/

## Testing on GitHub Pages

1. Go to your live site
2. Click "From URL" toggle
3. Click any "Upload" button
4. Paste Cin7 URL
5. Should work! 🎉

## How Local Storage Works

The app saves files to the **user's computer** using:
- Chrome/Edge: File System Access API (folder picker)
- Firefox/Safari: Downloads to browser's download folder

**Each user** picks their own local folder on their machine.

## No Backend Server Needed! 🚀

- ❌ No Node.js server to maintain
- ❌ No hosting costs
- ❌ No port 3001 issues
- ✅ Pure frontend app
- ✅ Works offline (after first load)
- ✅ Fast and simple

## For Different Environments

### Development (localhost)
```bash
npm run dev
# Works at http://localhost:3000
```

### Production (GitHub Pages)
```bash
npm run build
# Deploy dist/ folder
# Works at https://regandsilva.github.io
```

### Custom Domain (Optional)
If you want to use your own domain:
1. Add CNAME file to `public/` folder
2. Configure in GitHub Settings → Pages
3. App will work at `yourdomain.com`

## Troubleshooting

### "Failed to load PDF"
- Check if URL is accessible
- Try opening URL directly in browser
- Some PDFs may have authentication requirements

### "Local storage not configured"
- User needs to select a folder first
- Click Settings → Select local folder
- Must be done on each user's machine

### Slow loading
- First try (direct fetch) is fast
- Fallback (proxy) is slower but necessary for CORS-blocked URLs
- This is a Cin7 server limitation, not your app

## Security Notes

⚠️ **About allorigins.win:**
- Third-party public service
- Your URLs pass through their servers
- Only used as fallback when direct fetch fails
- For extra security, Cin7 could enable CORS on their end

✅ **Data stays local:**
- PDFs are saved to user's local machine
- No data stored on any server
- Each user controls their own files

---

**Status**: Production Ready ✅  
**Last Updated**: October 31, 2025  
**Works on**: GitHub Pages, any static host
