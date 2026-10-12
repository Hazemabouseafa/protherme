const { getContent, saveContent } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');

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

      const isBypass = parsedUrl.searchParams.has('admin') || parsedUrl.searchParams.has('t') || req.headers['cache-control'] === 'no-cache';
      const data = await getContent(isBypass);

      if (isBypass) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      } else {
        // Edge CDN cache: 60s max-age with 5-minute background revalidation to save 95%+ DB bandwidth
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
      }
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
        try { body = JSON.parse(body); } catch (e) {}
      }
      if (!body) {
        return res.status(400).json({ error: 'Empty body' });
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
