const db = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Fetch all career applications
  if (req.method === 'GET') {
    try {
      const data = await db.getCareers();
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(data);
    } catch (err) {
      console.error('API GET /api/careers error:', err);
      return res.status(500).json({ error: 'Failed to fetch career applications' });
    }
  }

  // POST: Add new career application
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (!body || !body.name || !body.phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
      }
      const created = await db.addCareer(body);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true, career: created });
    } catch (err) {
      console.error('API POST /api/careers error:', err);
      return res.status(500).json({ error: 'Failed to submit career application' });
    }
  }

  // PATCH: Update career application status
  if (req.method === 'PATCH') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (!body || !body.id || !body.status) {
        return res.status(400).json({ error: 'ID and status are required' });
      }
      await db.updateCareerStatus(body.id, body.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('API PATCH /api/careers error:', err);
      return res.status(500).json({ error: 'Failed to update application status' });
    }
  }

  // DELETE: Delete career application
  if (req.method === 'DELETE') {
    try {
      let id = req.query && req.query.id;
      if (!id && req.body) {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        id = body && body.id;
      }
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      await db.deleteCareer(id);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('API DELETE /api/careers error:', err);
      return res.status(500).json({ error: 'Failed to delete application' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
