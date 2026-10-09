/**
 * Neon Serverless Postgres DB Helper for ProTherme CMS
 * Supports Vercel Serverless Functions and Local Node.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

const BASE_DIR = path.resolve(__dirname, '..');
const CONTENT_FILE = path.join(BASE_DIR, 'content.json');
const DEFAULT_CONTENT_FILE = path.join(BASE_DIR, 'content.default.json');
const LEADS_FILE = path.join(BASE_DIR, 'leads.json');
const CAREERS_FILE = path.join(BASE_DIR, 'careers.json');
const TMP_UPLOAD_DIR = path.join(os.tmpdir(), 'protherme_uploads');

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogg': 'video/ogg'
};

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
          CREATE TABLE IF NOT EXISTS cms_upload_chunks (
            upload_id VARCHAR(255) NOT NULL,
            chunk_index INT NOT NULL,
            total_chunks INT NOT NULL,
            filename TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (upload_id, chunk_index)
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
  const ext = (path.extname(filename) || '.jpg').toLowerCase();
  const cleanName = 'upload-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7) + ext;
  const isVideo = ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg' || ext === '.m4v';

  // Safely extract base64 payload regardless of MIME format
  let rawBase64 = base64Data;
  const commaIdx = base64Data.indexOf('base64,');
  if (commaIdx !== -1) {
    rawBase64 = base64Data.substring(commaIdx + 7);
  }
  const buffer = Buffer.from(rawBase64, 'base64');

  let localSaved = false;
  // 1. Try writing to local project directory (assets/images or assets/videos)
  try {
    const uploadDir = isVideo ? path.join(BASE_DIR, 'assets', 'videos') : path.join(BASE_DIR, 'assets', 'images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, cleanName), buffer);
    localSaved = true;
  } catch (fsErr) {
    // EROFS: read-only filesystem (expected on Vercel / AWS Lambda where /var/task is read-only)
  }

  // 2. Always write to /tmp as local serverless fallback buffer
  try {
    if (!fs.existsSync(TMP_UPLOAD_DIR)) {
      fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(TMP_UPLOAD_DIR, cleanName), buffer);
  } catch (tmpErr) {
    // ignore tmp write errors
  }

  // 3. Persist to Neon DB if active (limit payload to 15MB to avoid Neon HTTP payload caps)
  const sql = getSql();
  let dbSaved = false;
  if (sql && buffer.length <= 15 * 1024 * 1024) {
    await ensureTables();
    try {
      await sql`
        INSERT INTO cms_uploads (id, filename, data, created_at)
        VALUES (${cleanName}, ${filename}, ${base64Data}, NOW())
        ON CONFLICT (id) DO UPDATE
        SET data = EXCLUDED.data, updated_at = NOW();
      `;
      dbSaved = true;
    } catch (err) {
      console.error('Neon upload save failed:', err);
    }
  }

  // On read-only serverless environments (or when saved to DB), serve via dynamic /api/image endpoint
  const returnUrl = (!localSaved || dbSaved)
    ? `/api/image?id=${cleanName}`
    : ((isVideo ? 'assets/videos/' : 'assets/images/') + cleanName);

  return {
    success: true,
    url: returnUrl,
    filename: cleanName
  };
}

async function saveUploadChunk({ uploadId, chunkIndex, totalChunks, filename, data, totalSize }) {
  const ext = (path.extname(filename) || '.mp4').toLowerCase();
  const cleanName = uploadId.includes('.') ? uploadId : `${uploadId}${ext}`;
  const isVideo = ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg' || ext === '.m4v';

  let rawBase64 = data;
  const commaIdx = data.indexOf('base64,');
  if (commaIdx !== -1) {
    rawBase64 = data.substring(commaIdx + 7);
  }
  const chunkBuffer = Buffer.from(rawBase64, 'base64');

  // 1. Write chunk to physical project folder (assets/videos or assets/images)
  try {
    const uploadDir = isVideo ? path.join(BASE_DIR, 'assets', 'videos') : path.join(BASE_DIR, 'assets', 'images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const targetFile = path.join(uploadDir, cleanName);
    const fd = fs.openSync(targetFile, chunkIndex === 0 ? 'w' : 'a');
    fs.writeSync(fd, chunkBuffer);
    fs.closeSync(fd);
  } catch (fsErr) {
    // Expected read-only filesystem on Vercel
  }

  // 2. Write chunk to /tmp buffer
  try {
    if (!fs.existsSync(TMP_UPLOAD_DIR)) {
      fs.mkdirSync(TMP_UPLOAD_DIR, { recursive: true });
    }
    const tmpFile = path.join(TMP_UPLOAD_DIR, cleanName);
    const fd = fs.openSync(tmpFile, chunkIndex === 0 ? 'w' : 'a');
    fs.writeSync(fd, chunkBuffer);
    fs.closeSync(fd);
  } catch (tmpErr) {}

  // 3. Save chunk to Neon DB if active
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      await sql`
        INSERT INTO cms_upload_chunks (upload_id, chunk_index, total_chunks, filename, data, created_at)
        VALUES (${cleanName}, ${chunkIndex}, ${totalChunks}, ${filename}, ${data}, NOW())
        ON CONFLICT (upload_id, chunk_index) DO UPDATE
        SET data = EXCLUDED.data;
      `;
    } catch (err) {
      console.error('Neon save upload chunk error:', err);
    }
  }

  const isComplete = chunkIndex === (totalChunks - 1);
  const returnUrl = (isVideo ? 'assets/videos/' : 'assets/images/') + cleanName;

  if (isComplete) {
    if (sql) {
      try {
        await sql`
          INSERT INTO cms_uploads (id, filename, data, created_at)
          VALUES (${cleanName}, ${filename}, ${'chunked:' + totalChunks + ':' + (totalSize || 0)}, NOW())
          ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();
        `;
      } catch (e) {}
    }

    return {
      success: true,
      completed: true,
      url: returnUrl,
      filename: cleanName
    };
  }

  return {
    success: true,
    completed: false,
    chunkIndex,
    totalChunks,
    filename: cleanName
  };
}

async function getUploadChunk(uploadId, chunkIndex) {
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      const rows = await sql`SELECT data FROM cms_upload_chunks WHERE upload_id = ${uploadId} AND chunk_index = ${chunkIndex} LIMIT 1`;
      if (rows && rows.length > 0) {
        return rows[0].data;
      }
    } catch(e) {}
  }
  return null;
}

async function getUpload(id) {
  // 1. Try Neon Database first
  const sql = getSql();
  if (sql) {
    await ensureTables();
    try {
      const rows = await sql`SELECT filename, data FROM cms_uploads WHERE id = ${id} LIMIT 1`;
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      console.error('Neon getUpload error:', err);
    }
  }

  // 2. Try /tmp directory buffer
  try {
    const tmpFile = path.join(TMP_UPLOAD_DIR, id);
    if (fs.existsSync(tmpFile)) {
      const ext = path.extname(id).toLowerCase();
      const isVid = ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg';
      const mime = mimeTypes[ext] || (isVid ? 'video/mp4' : 'image/jpeg');
      const fileData = fs.readFileSync(tmpFile);
      return {
        filename: id,
        data: `data:${mime};base64,` + fileData.toString('base64')
      };
    }
  } catch (e) {}

  // 3. Try assets/images and assets/videos fallback
  try {
    for (const sub of ['assets/images', 'assets/videos']) {
      const assetFile = path.join(BASE_DIR, sub, id);
      if (fs.existsSync(assetFile)) {
        const ext = path.extname(id).toLowerCase();
        const isVid = ext === '.mp4' || ext === '.webm' || ext === '.mov' || ext === '.ogg';
        const mime = mimeTypes[ext] || (isVid ? 'video/mp4' : 'image/jpeg');
        const fileData = fs.readFileSync(assetFile);
        return {
          filename: id,
          data: `data:${mime};base64,` + fileData.toString('base64')
        };
      }
    }
  } catch (e) {}

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
  saveUploadChunk,
  getUploadChunk,
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
