const { getUpload } = require('../lib/db');
const path = require('path');
const fs = require('fs');

module.exports = async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send('Missing image id');
  }

  try {
    // 1. Try Neon Database first
    const record = await getUpload(id);
    if (record && record.data) {
      let rawBase64 = record.data;
      let contentType = 'image/jpeg';
      const matches = record.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        contentType = matches[1];
        rawBase64 = matches[2];
      }
      const buffer = Buffer.from(rawBase64, 'base64');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.status(200).send(buffer);
    }

    // 2. Try Local File fallback
    const localPath = path.join(__dirname, '..', 'assets', 'images', id);
    if (fs.existsSync(localPath)) {
      const ext = path.extname(id).toLowerCase();
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
      };
      res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
      return res.status(200).send(fs.readFileSync(localPath));
    }

    return res.status(404).send('Image not found');
  } catch (err) {
    console.error('API /api/image error:', err);
    return res.status(500).send('Error loading image');
  }
};
