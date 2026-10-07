const { resetContent } = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    try {
      const defaultData = await resetContent();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true, message: 'Content reset to factory defaults', content: defaultData });
    } catch (err) {
      console.error('API POST /api/reset error:', err);
      return res.status(500).json({ error: 'Failed to reset content' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
