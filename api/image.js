const { getUpload, getUploadChunk, assembleUpload } = require('../lib/db');
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

  const MAX_RANGE_SLICE = 2 * 1024 * 1024; // 2 MB slice to safely stay under Vercel 4.5MB payload cap

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Handle suffix range (e.g. bytes=-500)
    if (isNaN(start)) {
      start = fileSize - end;
      end = fileSize - 1;
    }
    if (start < 0) start = 0;
    if (end >= fileSize) end = fileSize - 1;

    if (start > end || start >= fileSize) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`
      });
      return res.end();
    }

    // Cap slice to MAX_RANGE_SLICE for serverless streaming stability
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
    // If no range specified and file > 2MB, send initial 2MB slice with 206 Partial Content
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

module.exports = async function handler(req, res) {
  let { id } = req.query || {};
  if (!id && req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      id = parsed.searchParams.get('id');
    } catch (e) {}
  }
  if (!id) {
    return res.status(400).send('Missing media id');
  }

  id = path.basename(id);

  try {
    // 1. Try getUpload (checks Neon DB, /tmp buffer, and local assets)
    const record = await getUpload(id);

    // 1.a If stored as chunked stream in Neon
    if (record && record.data && record.data.startsWith('chunked:')) {
      const ext = path.extname(id).toLowerCase();
      const contentType = mimeTypes[ext] || 'video/mp4';
      const parts = record.data.split(':');
      const totalChunks = parseInt(parts[1], 10) || 1;
      const CHUNK_SIZE = 2 * 1024 * 1024;
      let totalSize = parseInt(parts[2], 10) || 0;

      // Primary strategy: Reassemble full continuous file into local container /tmp
      const assembledFile = await assembleUpload(id, totalChunks, totalSize);
      if (assembledFile && fs.existsSync(assembledFile)) {
        return streamFileWithRange(req, res, assembledFile, contentType);
      }

      // Secondary fallback: Direct chunk slicing from Neon DB if assembly in progress
      if (!totalSize) {
        totalSize = totalChunks * CHUNK_SIZE;
      }

      const range = req.headers.range;
      let start = 0;
      let end = totalSize - 1;

      if (range) {
        const rangeParts = range.replace(/bytes=/, '').split('-');
        start = parseInt(rangeParts[0], 10) || 0;
        if (rangeParts[1]) {
          end = parseInt(rangeParts[1], 10);
        }
        if (end >= totalSize) end = totalSize - 1;
      }

      const chunkIdx = Math.floor(start / CHUNK_SIZE);
      const startOffset = start % CHUNK_SIZE;

      const chunkData = await getUploadChunk(id, chunkIdx);
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
      const isVid = ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg';
      if (isVid) {
        return streamFileWithRange(req, res, tmpPath, contentType);
      }
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
        const isVid = ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg';
        if (isVid) {
          return streamFileWithRange(req, res, localPath, contentType);
        }
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
