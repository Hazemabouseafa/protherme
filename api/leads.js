const db = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Fetch all leads
  if (req.method === 'GET') {
    try {
      const data = await db.getLeads();
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json(data);
    } catch (err) {
      console.error('API GET /api/leads error:', err);
      return res.status(500).json({ error: 'Failed to fetch leads' });
    }
  }

  // POST: Add new lead
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (!body || !body.name) {
        return res.status(400).json({ error: 'Name is required' });
      }
      const created = await db.addLead(body);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true, lead: created });
    } catch (err) {
      console.error('API POST /api/leads error:', err);
      return res.status(500).json({ error: 'Failed to create lead' });
    }
  }

  // PATCH: Update lead status
  if (req.method === 'PATCH') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      if (!body || !body.id || !body.status) {
        return res.status(400).json({ error: 'ID and status are required' });
      }
      await db.updateLeadStatus(body.id, body.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('API PATCH /api/leads error:', err);
      return res.status(500).json({ error: 'Failed to update lead' });
    }
  }

  // DELETE: Delete lead
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
      await db.deleteLead(id);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('API DELETE /api/leads error:', err);
      return res.status(500).json({ error: 'Failed to delete lead' });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
};
