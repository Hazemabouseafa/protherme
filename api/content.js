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
      const data = await getContent();
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
