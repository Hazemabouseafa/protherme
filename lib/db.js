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
      } catch (err) {
        console.error('Error ensuring Neon tables:', err);
      }
    })();
  }
  await tableInitPromise;
}

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
      // Return public URL or data URI
      return {
        url: `/api/image?id=${cleanName}`,
        filename: cleanName
      };
    } catch (err) {
      console.error('Neon upload save failed:', err);
    }
  }

  // Local filesystem fallback
  const uploadDir = path.join(BASE_DIR, 'assets', 'images');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  let rawBase64 = base64Data;
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    rawBase64 = matches[2];
  }
  const buffer = Buffer.from(rawBase64, 'base64');
  fs.writeFileSync(path.join(uploadDir, cleanName), buffer);

  return {
    url: 'assets/images/' + cleanName,
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

module.exports = {
  getDbUrl,
  getContent,
  saveContent,
  resetContent,
  saveUpload,
  getUpload,
  ensureTables
};
