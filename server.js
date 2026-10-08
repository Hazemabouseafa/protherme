const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

const PORT = process.env.PORT || 8080;
const BASE_DIR = __dirname;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4'
};

const server = http.createServer(async (req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Normalize subpaths: strip leading /protherme
  let subPath = urlPath;
  if (subPath.startsWith('/protherme')) {
    subPath = subPath.substring('/protherme'.length);
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API: GET /api/content ---
  if ((subPath === '/api/content' || urlPath === '/api/content') && req.method === 'GET') {
    try {
      const data = await db.getContent();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch content' }));
    }
    return;
  }

  // --- API: POST /api/content ---
  if ((subPath === '/api/content' || urlPath === '/api/content') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        await db.saveContent(parsed);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ success: true, message: 'Content saved successfully' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // --- API: POST /api/reset ---
  if ((subPath === '/api/reset' || urlPath === '/api/reset') && req.method === 'POST') {
    try {
      const defaultContent = await db.resetContent();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: true, message: 'Reset to factory defaults', content: defaultContent }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to reset content' }));
    }
    return;
  }

  // --- API: POST /api/upload (Direct Image Upload) ---
  if ((subPath === '/api/upload' || urlPath === '/api/upload') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.data || !parsed.filename) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing data or filename' }));
          return;
        }

        const result = await db.saveUpload(parsed.filename, parsed.data);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ success: true, url: result.url, filename: result.filename }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid upload payload' }));
      }
    });
    return;
  }

  // --- API: GET /api/image (Serve DB-stored image) ---
  if ((subPath === '/api/image' || urlPath === '/api/image') && req.method === 'GET') {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const id = urlObj.searchParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing image id');
      return;
    }
    const record = await db.getUpload(id);
    if (record && record.data) {
      let rawBase64 = record.data;
      let contentType = 'image/jpeg';
      const matches = record.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        contentType = matches[1];
        rawBase64 = matches[2];
      }
      const buffer = Buffer.from(rawBase64, 'base64');
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000'
      });
      res.end(buffer);
      return;
    }
  }

  // --- Admin Route ---
  if (subPath === '/admin' || subPath === '/admin/' || urlPath === '/admin' || urlPath === '/admin/') {
    const adminPath = path.join(BASE_DIR, 'admin.html');
    fs.readFile(adminPath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error loading Admin panel');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(BASE_DIR, subPath === '/' || subPath === '' ? 'index.html' : subPath);

  // If path doesn't have an extension, try adding .html
  if (!path.extname(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA-like routing
        fs.readFile(path.join(BASE_DIR, 'index.html'), (spaErr, spaContent) => {
          if (spaErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(spaContent);
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log('=======================================================');
  console.log(`ProTherme Server Active on port ${PORT}!`);
  console.log(`- Database:        ${db.getDbUrl() ? 'Neon Serverless Postgres' : 'Local File Fallback (content.json)'}`);
  console.log(`- Landing Page:     http://localhost:${PORT}/`);
  console.log(`- Subpath Landing:  http://localhost:${PORT}/protherme/`);
  console.log(`- Admin Dashboard:  http://localhost:${PORT}/admin`);
  console.log(`- Subpath Admin:    http://localhost:${PORT}/protherme/admin`);
  console.log('=======================================================');
});
