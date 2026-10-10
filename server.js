const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('./lib/db');

const PORT = process.env.PORT || 8080;
const BASE_DIR = __dirname;
const TMP_UPLOAD_DIR = path.join(os.tmpdir(), 'protherme_uploads');

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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg',
  '.m4v': 'video/mp4'
};

function streamFileWithRange(req, res, filePath, contentType) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  const MAX_RANGE_SLICE = 2 * 1024 * 1024; // 2 MB slice

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start)) {
      start = fileSize - end;
      end = fileSize - 1;
    }
    if (start < 0) start = 0;
    if (end >= fileSize) end = fileSize - 1;

    if (start > end || start >= fileSize) {
      res.writeHead(416, { 'Content-Range': `bytes */${fileSize}` });
      return res.end();
    }

    if ((end - start + 1) > MAX_RANGE_SLICE) {
      end = start + MAX_RANGE_SLICE - 1;
    }

    const chunkSize = (end - start) + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': chunkSize
    });
    return stream.pipe(res);
  } else {
    if (fileSize > MAX_RANGE_SLICE) {
      const end = MAX_RANGE_SLICE - 1;
      const stream = fs.createReadStream(filePath, { start: 0, end });
      res.writeHead(206, {
        'Content-Range': `bytes 0-${end}/${fileSize}`,
        'Content-Length': MAX_RANGE_SLICE
      });
      return stream.pipe(res);
    }

    res.writeHead(200, {
      'Content-Length': fileSize
    });
    return fs.createReadStream(filePath).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Normalize subpaths: strip leading /protherme or /admin/assets
  let subPath = urlPath;
  if (subPath.startsWith('/protherme')) {
    subPath = subPath.substring('/protherme'.length);
  }
  if (subPath.startsWith('/admin/assets/')) {
    subPath = subPath.substring('/admin'.length);
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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

  // --- API: POST /api/upload (Direct Image & Video Upload) ---
  if ((subPath === '/api/upload' || urlPath === '/api/upload') && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', async () => {
      try {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(rawBody);
        if (!parsed.data || !parsed.filename) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing data or filename' }));
          return;
        }

        let result;
        if (parsed.isChunk) {
          result = await db.saveUploadChunk(parsed);
        } else {
          result = await db.saveUpload(parsed.filename, parsed.data);
        }

        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('Upload API processing error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Upload processing failed' }));
      }
    });
    return;
  }

  // --- API: GET /api/image (Serve DB, /tmp, or asset stored media) ---
  if ((subPath === '/api/image' || urlPath === '/api/image') && req.method === 'GET') {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const id = urlObj.searchParams.get('id');
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing media id');
      return;
    }

    try {
      const record = await db.getUpload(id);

      // 1.a Chunked video stream from DB
      if (record && record.data && record.data.startsWith('chunked:')) {
        const ext = path.extname(id).toLowerCase();
        const contentType = mimeTypes[ext] || 'video/mp4';
        const parts = record.data.split(':');
        const totalChunks = parseInt(parts[1], 10) || 1;
        const CHUNK_SIZE = 2 * 1024 * 1024;
        let totalSize = parseInt(parts[2], 10) || 0;

        const assembledFile = await db.assembleUpload(id, totalChunks, totalSize);
        if (assembledFile && fs.existsSync(assembledFile)) {
          return streamFileWithRange(req, res, assembledFile, contentType);
        }

        if (!totalSize) totalSize = totalChunks * CHUNK_SIZE;

        const range = req.headers.range;
        let start = 0;
        let end = totalSize - 1;

        if (range) {
          const rangeParts = range.replace(/bytes=/, '').split('-');
          start = parseInt(rangeParts[0], 10) || 0;
          if (rangeParts[1]) end = parseInt(rangeParts[1], 10);
          if (end >= totalSize) end = totalSize - 1;
        }

        const chunkIdx = Math.floor(start / CHUNK_SIZE);
        const startOffset = start % CHUNK_SIZE;

        const chunkData = await db.getUploadChunk(id, chunkIdx);
        if (chunkData) {
          let rawBase64 = chunkData;
          const commaIdx = chunkData.indexOf('base64,');
          if (commaIdx !== -1) rawBase64 = chunkData.substring(commaIdx + 7);
          const buf = Buffer.from(rawBase64, 'base64');

          const maxChunkBytes = buf.length - startOffset;
          const requestedBytes = (end - start) + 1;
          const bytesToSend = Math.min(maxChunkBytes, requestedBytes);
          const slice = buf.subarray(startOffset, startOffset + bytesToSend);

          const actualStart = (chunkIdx * CHUNK_SIZE) + startOffset;
          const actualEnd = actualStart + slice.length - 1;

          res.writeHead(206, {
            'Content-Range': `bytes ${actualStart}-${actualEnd}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': slice.length,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          res.end(slice);
          return;
        }
      }

      if (record && record.data && !record.data.startsWith('chunked:')) {
        let rawBase64 = record.data;
        const ext = path.extname(id).toLowerCase();
        let contentType = mimeTypes[ext] || 'image/jpeg';
        const commaIdx = record.data.indexOf('base64,');
        if (commaIdx !== -1) {
          const header = record.data.substring(0, commaIdx);
          const m = header.match(/^data:([^;]+)/);
          if (m && !mimeTypes[ext]) contentType = m[1];
          rawBase64 = record.data.substring(commaIdx + 7);
        }
        const buffer = Buffer.from(rawBase64, 'base64');

        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
          const chunkSize = (end - start) + 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          res.end(buffer.subarray(start, end + 1));
          return;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': buffer.length,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        res.end(buffer);
        return;
      }

      // Check /tmp file buffer
      const tmpPath = path.join(TMP_UPLOAD_DIR, id);
      if (fs.existsSync(tmpPath)) {
        const ext = path.extname(id).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const isVid = ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg';
        if (isVid) {
          return streamFileWithRange(req, res, tmpPath, contentType);
        }
        const buf = fs.readFileSync(tmpPath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': buf.length,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        res.end(buf);
        return;
      }

      // Check local assets fallback
      for (const folder of ['images', 'videos']) {
        const localPath = path.join(BASE_DIR, 'assets', folder, id);
        if (fs.existsSync(localPath)) {
          const ext = path.extname(id).toLowerCase();
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          const isVid = ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg';
          if (isVid) {
            return streamFileWithRange(req, res, localPath, contentType);
          }
          const buf = fs.readFileSync(localPath);
          res.writeHead(200, {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Content-Length': buf.length,
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          res.end(buf);
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Media not found');
      return;
    } catch (err) {
      console.error('API /api/image error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading media');
      return;
    }
  }

  // --- API: /api/video (Video Stream) ---
  if (subPath === '/api/video' || urlPath === '/api/video') {
    require('./api/video')(req, res);
    return;
  }

  // --- API: /api/leads ---
  if (subPath === '/api/leads' || urlPath === '/api/leads') {
    if (req.method === 'GET') {
      try {
        const leads = await db.getLeads();
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(leads));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch leads' }));
      }
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Name is required' }));
            return;
          }
          const created = await db.addLead(parsed);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true, lead: created }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }
    if (req.method === 'PATCH') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          await db.updateLeadStatus(parsed.id, parsed.status);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          let id = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('id');
          if (!id && body) {
            const parsed = JSON.parse(body);
            id = parsed.id;
          }
          await db.deleteLead(id);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }
  }

  // --- API: /api/careers ---
  if (subPath === '/api/careers' || urlPath === '/api/careers') {
    if (req.method === 'GET') {
      try {
        const careers = await db.getCareers();
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(careers));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch careers' }));
      }
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.name || !parsed.phone) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Name and phone are required' }));
            return;
          }
          const created = await db.addCareer(parsed);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true, career: created }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }
    if (req.method === 'PATCH') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          await db.updateCareerStatus(parsed.id, parsed.status);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          let id = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('id');
          if (!id && body) {
            const parsed = JSON.parse(body);
            id = parsed.id;
          }
          await db.deleteCareer(id);
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
      });
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

  // Handle direct upload asset paths that might only exist in DB or /tmp
  const uploadMatch = subPath.match(/^\/assets\/(?:images|videos)\/(upload-[^/]+)$/);
  if (uploadMatch && req.method === 'GET') {
    const uploadId = uploadMatch[1];
    const directFilePath = path.join(BASE_DIR, subPath);
    if (!fs.existsSync(directFilePath)) {
      req.query = req.query || {};
      req.query.id = uploadId;
      const imageApi = require('./api/image');
      return imageApi(req, res);
    }
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

  // Video Streaming with HTTP Range (206) Support
  if ((ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg' || ext === '.m4v') && fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      });
      stream.pipe(res);
      return;
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

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
