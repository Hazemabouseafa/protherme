/**
 * Neon Serverless Postgres DB Helper for ProTherme CMS
 * Supports Vercel Serverless Functions and Local Node.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BASE_DIR = path.resolve(__dirname, '..');
const CONTENT_FILE = path.join(BASE_DIR, 'content.json');
const DEFAULT_CONTENT_FILE = path.join(BASE_DIR, 'content.default.json');
const LEADS_FILE = path.join(BASE_DIR, 'leads.json');
const CAREERS_FILE = path.join(BASE_DIR, 'careers.json');

let neonClient = null;

function getDbUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

function getSql() {
  const dbUrl = getDbUrl();
  if (!dbUrl) return null;
  if (!neonClient) {
    const { neon } = require('@neondatabase/serverless');
    neonClient = neon(dbUrl);
  }
  return neonClient;
}

let tableInitPromise = null;

async function ensureTables() {
  const sql = getSql();
  if (!sql) return;

  if (!tableInitPromise) {
    tableInitPromise = (async () => {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS cms_content (
            id VARCHAR(50) PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS cms_uploads (
            id VARCHAR(255) PRIMARY KEY,
            filename TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS cms_leads (
            id VARCHAR(50) PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            service TEXT,
            message TEXT,
            status VARCHAR(20) DEFAULT 'new',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS cms_careers (
            id VARCHAR(50) PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            role TEXT NOT NULL,
            experience TEXT,
            portfolio TEXT,
            notes TEXT,
            status VARCHAR(20) DEFAULT 'new',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `;
      } catch (err) {
        console.error('Error ensuring Neon tables:', err);
      }
    })();
  }
  await tableInitPromise;
}

// Local Fallback Helpers
function readLocalDefaultContent() {
  try {
    if (fs.existsSync(CONTENT_FILE)) {
      return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
    }
    if (fs.existsSync(DEFAULT_CONTENT_FILE)) {
      return JSON.parse(fs.readFileSync(DEFAULT_CONTENT_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading local content fallback:', e);
  }
  return {};
}

function writeLocalContent(contentObj) {
  try {
    fs.writeFileSync(CONTENT_FILE, JSON.stringify(contentObj, null, 2), 'utf8');
  } catch (e) {
    // On Vercel, filesystem is read-only, safely ignore
  }
}

function readLocalLeads() {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading leads.json:', e);
  }
  return [];
}

function writeLocalLeads(list) {
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {}
}

function readLocalCareers() {
  try {
    if (fs.existsSync(CAREERS_FILE)) {
      return JSON.parse(fs.readFileSync(CAREERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading careers.json:', e);
  }
  return [];
}

function writeLocalCareers(list) {
  try {
    fs.writeFileSync(CAREERS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {}
}

// CMS Content Functions
async function getContent() {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      const rows = await sql`SELECT data FROM cms_content WHERE id = 'main' LIMIT 1`;
      if (rows && rows.length > 0 && rows[0].data) {
        return rows[0].data;
      }
      // Seed default data into Neon on first run
      const defaultData = readLocalDefaultContent();
      if (Object.keys(defaultData).length > 0) {
        await sql`
          INSERT INTO cms_content (id, data, updated_at)
          VALUES ('main', ${JSON.stringify(defaultData)}, NOW())
          ON CONFLICT (id) DO NOTHING;
        `;
      }
      return defaultData;
    } catch (err) {
      console.error('Neon DB query failed, falling back to local file:', err);
    }
  }
  return readLocalDefaultContent();
}

async function saveContent(newData) {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`
        INSERT INTO cms_content (id, data, updated_at)
        VALUES ('main', ${JSON.stringify(newData)}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW();
      `;
    } catch (err) {
      console.error('Neon DB save failed:', err);
      throw err;
    }
  }
  writeLocalContent(newData);
  return newData;
}

async function resetContent() {
  let defaultData = {};
  if (fs.existsSync(DEFAULT_CONTENT_FILE)) {
    defaultData = JSON.parse(fs.readFileSync(DEFAULT_CONTENT_FILE, 'utf8'));
  } else {
    defaultData = readLocalDefaultContent();
  }

  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`
        INSERT INTO cms_content (id, data, updated_at)
        VALUES ('main', ${JSON.stringify(defaultData)}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW();
      `;
    } catch (err) {
      console.error('Neon DB reset failed:', err);
    }
  }
  writeLocalContent(defaultData);
  return defaultData;
}

// Upload Functions
async function saveUpload(filename, base64Data) {
  const ext = path.extname(filename).toLowerCase() || '.jpg';
  const cleanName = 'upload-' + Date.now() + ext;
  
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`
        INSERT INTO cms_uploads (id, filename, data, created_at)
        VALUES (${cleanName}, ${filename}, ${base64Data}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW();
      `;
      return {
        url: `/api/image?id=${cleanName}`,
        filename: cleanName
      };
    } catch (err) {
      console.error('Neon upload save failed:', err);
    }
  }

  // Local filesystem fallback
  const isVideo = ext === '.mp4' || ext === '.webm';
  const uploadDir = isVideo ? path.join(BASE_DIR, 'assets', 'videos') : path.join(BASE_DIR, 'assets', 'images');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  let rawBase64 = base64Data;
  const matches = base64Data.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    rawBase64 = matches[2];
  }
  const buffer = Buffer.from(rawBase64, 'base64');
  fs.writeFileSync(path.join(uploadDir, cleanName), buffer);

  return {
    url: (isVideo ? 'assets/videos/' : 'assets/images/') + cleanName,
    filename: cleanName
  };
}

async function getUpload(id) {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      const rows = await sql`SELECT filename, data FROM cms_uploads WHERE id = ${id} LIMIT 1`;
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch (err) {}
  }
  return null;
}

// Leads Functions
async function getLeads() {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      const rows = await sql`SELECT * FROM cms_leads ORDER BY created_at DESC LIMIT 200`;
      return rows;
    } catch (err) {
      console.error('Neon getLeads failed, falling back:', err);
    }
  }
  return readLocalLeads();
}

async function addLead(lead) {
  const item = {
    id: lead.id || 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    service: lead.service || '',
    message: lead.message || '',
    status: lead.status || 'new',
    created_at: new Date().toISOString()
  };
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`
        INSERT INTO cms_leads (id, name, phone, email, service, message, status, created_at)
        VALUES (${item.id}, ${item.name}, ${item.phone}, ${item.email}, ${item.service}, ${item.message}, ${item.status}, NOW())
      `;
    } catch (err) {
      console.error('Neon addLead failed:', err);
    }
  }
  const localList = readLocalLeads();
  localList.unshift(item);
  writeLocalLeads(localList);
  return item;
}

async function updateLeadStatus(id, status) {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`UPDATE cms_leads SET status = ${status} WHERE id = ${id}`;
    } catch (err) {
      console.error('Neon updateLeadStatus failed:', err);
    }
  }
  const localList = readLocalLeads();
  const found = localList.find(x => x.id === id);
  if (found) found.status = status;
  writeLocalLeads(localList);
  return { success: true };
}

async function deleteLead(id) {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`DELETE FROM cms_leads WHERE id = ${id}`;
    } catch (err) {
      console.error('Neon deleteLead failed:', err);
    }
  }
  let localList = readLocalLeads();
  localList = localList.filter(x => x.id !== id);
  writeLocalLeads(localList);
  return { success: true };
}

// Careers Functions
async function getCareers() {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      const rows = await sql`SELECT * FROM cms_careers ORDER BY created_at DESC LIMIT 200`;
      return rows;
    } catch (err) {
      console.error('Neon getCareers failed, falling back:', err);
    }
  }
  return readLocalCareers();
}

async function addCareer(career) {
  const item = {
    id: career.id || 'career_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: career.name || '',
    phone: career.phone || '',
    email: career.email || '',
    role: career.role || '',
    experience: career.experience || '',
    portfolio: career.portfolio || '',
    notes: career.notes || '',
    status: career.status || 'new',
    created_at: new Date().toISOString()
  };
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`
        INSERT INTO cms_careers (id, name, phone, email, role, experience, portfolio, notes, status, created_at)
        VALUES (${item.id}, ${item.name}, ${item.phone}, ${item.email}, ${item.role}, ${item.experience}, ${item.portfolio}, ${item.notes}, ${item.status}, NOW())
      `;
    } catch (err) {
      console.error('Neon addCareer failed:', err);
    }
  }
  const localList = readLocalCareers();
  localList.unshift(item);
  writeLocalCareers(localList);
  return item;
}

async function updateCareerStatus(id, status) {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`UPDATE cms_careers SET status = ${status} WHERE id = ${id}`;
    } catch (err) {
      console.error('Neon updateCareerStatus failed:', err);
    }
  }
  const localList = readLocalCareers();
  const found = localList.find(x => x.id === id);
  if (found) found.status = status;
  writeLocalCareers(localList);
  return { success: true };
}

async function deleteCareer(id) {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`DELETE FROM cms_careers WHERE id = ${id}`;
    } catch (err) {
      console.error('Neon deleteCareer failed:', err);
    }
  }
  let localList = readLocalCareers();
  localList = localList.filter(x => x.id !== id);
  writeLocalCareers(localList);
  return { success: true };
}

module.exports = {
  getDbUrl,
  getContent,
  saveContent,
  resetContent,
  saveUpload,
  getUpload,
  ensureTables,
  getLeads,
  addLead,
  updateLeadStatus,
  deleteLead,
  getCareers,
  addCareer,
  updateCareerStatus,
  deleteCareer
};
