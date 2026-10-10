const { saveUpload, saveUploadChunk, getSql } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const { inspect } = req.query || {};
    if (inspect) {
      try {
        const sql = getSql();
        if (!sql) return res.json({ error: 'No SQL client' });
        const rows = await sql`SELECT id, filename, substring(data from 1 for 100) as prefix, length(data) as dlen FROM cms_uploads WHERE id = ${inspect}`;
        const chunks = await sql`SELECT chunk_index, length(data) as clen FROM cms_upload_chunks WHERE upload_id = ${inspect} ORDER BY chunk_index`;
        return res.json({ rows, chunks });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }
    return res.status(200).json({ status: 'ok' });
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

      let result;
      if (body.isChunk) {
        result = await saveUploadChunk(body);
      } else {
        result = await saveUpload(body.filename, body.data);
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(result);
    } catch (err) {
      console.error('API POST /api/upload error:', err);
      return res.status(500).json({ error: 'Failed to process uploaded image' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
