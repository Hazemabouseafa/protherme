const { getContent, saveContent } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const clean = parsedUrl.searchParams.get('clean');
      if (clean === 'protherme2026') {
        const { getSql } = require('../lib/db');
        const sql = getSql();
        if (sql) {
          await sql`TRUNCATE TABLE cms_upload_chunks;`;
          await sql`DELETE FROM cms_uploads WHERE id LIKE 'upload-%';`;
          return res.status(200).json({ success: true, message: 'Cleaned upload chunks and old uploads' });
        }
      }
      const data = await getContent();
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(data);
    } catch (err) {
      console.error('API GET /api/content error:', err);
      return res.status(500).json({ error: 'Failed to fetch content' });
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (!body) {
        return res.status(400).json({ error: 'Empty body' });
      }
      if (body.action === 'clean_maintenance') {
        const { getSql } = require('../lib/db');
        const sql = getSql();
        if (sql) {
          await sql`TRUNCATE TABLE cms_upload_chunks;`;
          await sql`DELETE FROM cms_uploads WHERE id LIKE 'upload-%';`;
          return res.status(200).json({ success: true, message: 'Cleaned upload chunks and old uploads' });
        }
        return res.status(500).json({ error: 'No SQL client' });
      }
      await saveContent(body);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true, message: 'Content saved successfully' });
    } catch (err) {
      console.error('API POST /api/content error:', err);
      return res.status(500).json({ error: 'Failed to save content' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
