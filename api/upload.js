const { saveUpload } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (!body || !body.data || !body.filename) {
        return res.status(400).json({ error: 'Missing data or filename' });
      }

      const result = await saveUpload(body.filename, body.data);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true, url: result.url, filename: result.filename });
    } catch (err) {
      console.error('API POST /api/upload error:', err);
      return res.status(500).json({ error: 'Failed to process uploaded image' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
