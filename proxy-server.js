/**
 * Simple CORS Proxy Server
 * This securely fetches PDFs from external URLs without exposing them to third-party services
 * 
 * Usage:
 * 1. Install: npm install express cors
 * 2. Run: node proxy-server.js
 * 3. Server runs on http://localhost:3001
 */

import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import compression from 'compression';

const app = express();
const PORT = 3001;

// Enable compression for faster transfers
app.use(compression());

// Enable CORS for your frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Add your production domain here
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Proxy endpoint
app.get('/fetch-pdf', async (req, res) => {
  const targetUrl = req.query.url;
  
  // Validate URL parameter
  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Parse and validate URL
    const parsedUrl = new URL(targetUrl);
    
    // Optional: Whitelist allowed domains for extra security
    const allowedDomains = [
      'go.cin7.com',
      // Add more trusted domains here
    ];
    
    // Comment out this check if you want to allow any domain
    // if (!allowedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
    //   return res.status(403).json({ error: 'Domain not allowed' });
    // }

    console.log(`📥 Fetching PDF from: ${parsedUrl.hostname}${parsedUrl.pathname}`);
    const startTime = Date.now();

    // Choose http or https based on protocol
    const client = parsedUrl.protocol === 'https:' ? https : http;

    // Make request to target URL with timeout
    const request = client.get(targetUrl, {
      headers: {
        'User-Agent': 'FSC-Document-Hub-Proxy/1.0',
        'Accept': 'application/pdf,*/*',
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: 30000 // 30 second timeout
    }, (proxyRes) => {
      const { statusCode, headers } = proxyRes;

      // Check if request was successful
      if (statusCode !== 200) {
        console.error(`❌ Failed to fetch PDF: HTTP ${statusCode}`);
        return res.status(statusCode).json({ 
          error: `Failed to fetch PDF: HTTP ${statusCode}` 
        });
      }

      // Forward content type
      const contentType = headers['content-type'] || 'application/pdf';
      res.setHeader('Content-Type', contentType);

      // Forward content disposition if present
      if (headers['content-disposition']) {
        res.setHeader('Content-Disposition', headers['content-disposition']);
      }

      // Forward content length if present
      if (headers['content-length']) {
        res.setHeader('Content-Length', headers['content-length']);
      }

      // Stream the response
      let bytesReceived = 0;
      let firstByteTime = null;
      
      proxyRes.on('data', (chunk) => {
        if (!firstByteTime) {
          firstByteTime = Date.now();
          const ttfb = firstByteTime - startTime;
          console.log(`⚡ Time to first byte: ${ttfb}ms`);
        }
        bytesReceived += chunk.length;
      });

      proxyRes.on('end', () => {
        const totalTime = Date.now() - startTime;
        const speed = (bytesReceived / 1024 / (totalTime / 1000)).toFixed(2);
        console.log(`✅ Successfully proxied PDF: ${(bytesReceived / 1024).toFixed(2)} KB in ${totalTime}ms (${speed} KB/s)`);
      });

      // Pipe the PDF data to response
      proxyRes.pipe(res);
      
    }).on('timeout', () => {
      console.error(`⏱️ Request timeout after 30 seconds`);
      request.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Request timeout - server took too long to respond' });
      }
    }).on('error', (err) => {
      console.error(`❌ Error fetching PDF:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: `Failed to fetch PDF: ${err.message}` });
      }
    });

  } catch (error) {
    console.error(`❌ Invalid URL or request error:`, error.message);
    res.status(400).json({ error: `Invalid URL: ${error.message}` });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 CORS Proxy Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Proxy endpoint: http://localhost:${PORT}/fetch-pdf?url=YOUR_URL\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});
