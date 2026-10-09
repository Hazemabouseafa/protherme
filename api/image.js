const { getUpload, getUploadChunk } = require('../lib/db');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TMP_UPLOAD_DIR = path.join(os.tmpdir(), 'protherme_uploads');

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg'
};

module.exports = async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send('Missing media id');
  }

  try {
    // 1. Try getUpload (checks Neon DB, /tmp buffer, and local assets)
    const record = await getUpload(id);

    // 1.a If stored as chunked stream in Neon
    if (record && record.data && record.data.startsWith('chunked:')) {
      const ext = path.extname(id).toLowerCase();
      const contentType = mimeTypes[ext] || 'video/mp4';
      const range = req.headers.range;
      const CHUNK_SIZE = 2 * 1024 * 1024;
      let chunkIdx = 0;
      let startOffset = 0;

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        chunkIdx = Math.floor(start / CHUNK_SIZE);
        startOffset = start % CHUNK_SIZE;
      }

      const chunkData = await getUploadChunk(id, chunkIdx);
      if (chunkData) {
        let rawBase64 = chunkData;
        const commaIdx = chunkData.indexOf('base64,');
        if (commaIdx !== -1) rawBase64 = chunkData.substring(commaIdx + 7);
        const buf = Buffer.from(rawBase64, 'base64');
        const slice = buf.subarray(startOffset);

        res.writeHead(206, {
          'Content-Range': `bytes ${startOffset}-${startOffset + slice.length - 1}/${buf.length}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': slice.length,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable'
        });
        return res.end(slice);
      }
    }
    if (record && record.data) {
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

      // Video HTTP Range (206 Partial Content) Streaming Support
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
        return res.end(buffer.subarray(start, end + 1));
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(buffer);
    }

    // 2. Try /tmp file buffer
    const tmpPath = path.join(TMP_UPLOAD_DIR, id);
    if (fs.existsSync(tmpPath)) {
      const ext = path.extname(id).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(fs.readFileSync(tmpPath));
    }

    // 3. Try Local Assets fallback
    for (const folder of ['images', 'videos']) {
      const localPath = path.join(process.cwd(), 'assets', folder, id);
      if (fs.existsSync(localPath)) {
        const ext = path.extname(id).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.status(200).send(fs.readFileSync(localPath));
      }
    }

    return res.status(404).send('Media not found');
  } catch (err) {
    console.error('API /api/image error:', err);
    return res.status(500).send('Error loading media');
  }
};
