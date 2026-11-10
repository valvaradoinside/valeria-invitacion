// Invitación Valeria XV — servidor estático + API de confirmaciones (RSVP).
// - Sirve la carpeta public/ (la invitación).
// - POST /api/rsvp         -> guarda una confirmación en Postgres (si hay DB).
// - GET  /api/rsvp?key=...  -> lista en JSON (requiere ADMIN_KEY).
// - GET  /panel?key=...     -> panel privado con la lista (requiere ADMIN_KEY).
// Railway inyecta PORT y, si agregas una base Postgres, DATABASE_URL.
// Sin DATABASE_URL el sitio funciona igual y el RSVP cae a WhatsApp.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
};

// ---------- Base de datos (opcional) ----------
let pool = null;
if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL ? { rejectUnauthorized: false } : false,
    });
    pool.query(`CREATE TABLE IF NOT EXISTS rsvps (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`).then(() => console.log('DB lista (tabla rsvps)'))
      .catch(e => console.error('Error creando tabla:', e.message));
  } catch (e) {
    console.error('pg no disponible:', e.message);
  }
}

// ---------- utilidades ----------
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// anti-spam básico por IP (memoria; se reinicia con el proceso)
const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 8; // máx 8 envíos por minuto por IP
}

async function handleRSVP(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';
  if (throttled(ip)) return sendJSON(res, 429, { ok: false, error: 'rate_limited' });
  let body = '';
  req.on('data', c => { body += c; if (body.length > 4000) req.destroy(); });
  req.on('end', async () => {
    let d = {};
    try { d = JSON.parse(body || '{}'); } catch (e) { return sendJSON(res, 400, { ok: false }); }
    const name = String(d.name || '').trim().slice(0, 120);
    const status = d.status === 'no' ? 'no' : 'si';
    const note = String(d.note || '').trim().slice(0, 500);
    if (name.length < 2) return sendJSON(res, 400, { ok: false, error: 'name' });
    if (!pool) return sendJSON(res, 200, { ok: true, stored: false }); // sin DB -> solo WhatsApp
    try {
      await pool.query('INSERT INTO rsvps (name, status, note) VALUES ($1,$2,$3)', [name, status, note]);
      return sendJSON(res, 200, { ok: true, stored: true });
    } catch (e) {
      console.error('insert error:', e.message);
      return sendJSON(res, 200, { ok: true, stored: false });
    }
  });
}

async function handleList(res) {
  if (!pool) return sendJSON(res, 200, { ok: true, rows: [], note: 'Sin base de datos conectada.' });
  try {
    const r = await pool.query('SELECT name, status, note, created_at FROM rsvps ORDER BY created_at DESC');
    return sendJSON(res, 200, { ok: true, rows: r.rows });
  } catch (e) {
    return sendJSON(res, 500, { ok: false, error: e.message });
  }
}

async function handlePanel(res) {
  let rows = [], yes = 0, no = 0, dbNote = '';
  if (pool) {
    try {
      const r = await pool.query('SELECT name, status, note, created_at FROM rsvps ORDER BY created_at DESC');
      rows = r.rows; yes = rows.filter(x => x.status === 'si').length; no = rows.length - yes;
    } catch (e) { dbNote = 'Error leyendo la base: ' + esc(e.message); }
  } else {
    dbNote = 'Aún no hay base de datos conectada (agrega Postgres en Railway).';
  }
  const list = rows.map(r => `<tr><td>${esc(r.name)}</td><td class="${r.status === 'si' ? 'y' : 'n'}">${r.status === 'si' ? 'Sí' : 'No'}</td><td>${esc(r.note || '')}</td><td>${esc(new Date(r.created_at).toLocaleString('es-VE'))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel · Confirmaciones Valeria XV</title>
<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#faeee7;color:#6f1f3d;margin:0;padding:24px}
h1{font-size:1.2rem}.stats{display:flex;gap:20px;margin:12px 0 18px}.stats b{font-size:1.6rem;display:block;color:#c8336b}
.stats span{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;opacity:.7}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #f3dbe4;font-size:.9rem}
th{background:#c8336b;color:#fff;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em}
.y{color:#2e8b57;font-weight:600}.n{color:#b0306a;font-weight:600}.note{opacity:.7;font-size:.85rem}</style></head>
<body><h1>🌺 Confirmaciones · Valeria XV</h1>
${dbNote ? `<p class="note">${dbNote}</p>` : ''}
<div class="stats"><div><b>${yes}</b><span>Asistirán</span></div><div><b>${no}</b><span>No podrán</span></div><div><b>${rows.length}</b><span>Total</span></div></div>
<table><thead><tr><th>Nombre</th><th>Asiste</th><th>Mensaje</th><th>Fecha</th></tr></thead><tbody>${list || '<tr><td colspan="4" class="note">Aún no hay confirmaciones.</td></tr>'}</tbody></table>
</body></html>`;
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// ---------- servidor ----------
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = decodeURIComponent(u.pathname);

  if (p === '/api/rsvp' && req.method === 'POST') return handleRSVP(req, res);

  if (p === '/api/rsvp' && req.method === 'GET') {
    if (!ADMIN_KEY || u.searchParams.get('key') !== ADMIN_KEY) return sendJSON(res, 401, { ok: false, error: 'unauthorized' });
    return handleList(res);
  }
  if (p === '/panel') {
    if (!ADMIN_KEY || u.searchParams.get('key') !== ADMIN_KEY) {
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<p style="font-family:sans-serif">Acceso restringido. Usa <code>/panel?key=TU_ADMIN_KEY</code>.</p>');
    }
    return handlePanel(res);
  }

  // estáticos
  let sp = p === '/' || p === '' ? '/index.html' : p;
  const fp = path.join(ROOT, path.normalize(sp));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(fp, (err, data) => {
    if (err) {
      return fs.readFile(path.join(ROOT, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end(d2);
      });
    }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'public, max-age=120' : 'public, max-age=86400',
    });
    res.end(data);
  });
});

server.listen(PORT, () => console.log('Invitación Valeria XV en puerto ' + PORT + (pool ? ' (con DB)' : ' (sin DB)')));
