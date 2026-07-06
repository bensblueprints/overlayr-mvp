const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { WebSocketServer } = require('ws');

const { openDb, newToken, getSettings, setSettings } = require('./db');
const { THEMES, FONTS } = require('./themes');
const { renderOverlayPage } = require('./overlay-render');
const runtime = require('./runtime');
const { WsHub } = require('./ws-hub');

const OVERLAY_TYPES = ['countdown', 'goal', 'ticker', 'starting_soon', 'alertbox'];

function createApp(opts = {}) {
  const dataDir = opts.dataDir || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const adminPassword = opts.adminPassword || process.env.ADMIN_PASSWORD || 'admin';
  const autologinToken = opts.autologinToken || process.env.AUTOLOGIN_TOKEN || null;

  const db = openDb(dataDir);
  const app = express();
  const hub = new WsHub();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // ---- sessions (persisted so a server restart doesn't force re-login) ----
  function newSession(res) {
    const sid = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (token) VALUES (?)').run(sid);
    res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    return sid;
  }
  function hasSession(sid) {
    return !!sid && !!db.prepare('SELECT 1 FROM sessions WHERE token = ?').get(sid);
  }
  function requireAuth(req, res, next) {
    if (hasSession(req.cookies.sid)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  }

  // ---- uploads (assets: images/audio for alerts, starting-soon bg, etc.) ----
  const uploadsDir = path.join(dataDir, 'uploads');
  const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '').toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    }
  });
  const upload = multer({
    storage,
    limits: { fileSize: 16 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      cb(null, /^(image\/(png|jpe?g|webp|gif|svg\+xml|avif)|audio\/(mpeg|mp3|wav|ogg|webm))$/.test(file.mimetype));
    }
  });
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

  function baseUrl(req) {
    const configured = getSettings(db).base_url;
    if (configured) return configured.replace(/\/+$/, '');
    return `${req.protocol}://${req.get('host')}`;
  }

  // ================= AUTH =================

  app.post('/api/login', (req, res) => {
    const pw = String(req.body?.password || '');
    const a = Buffer.from(pw);
    const b = Buffer.from(adminPassword);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });
    newSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.cookies.sid || '');
    res.clearCookie('sid');
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    res.json({ authed: hasSession(req.cookies.sid) });
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  if (autologinToken) {
    app.get('/auth/auto', (req, res) => {
      if (req.query.token !== autologinToken) return res.status(403).send('Forbidden');
      newSession(res);
      res.redirect('/admin');
    });
  }

  // ================= OVERLAY HELPERS =================

  function serializeOverlay(row) {
    const config = JSON.parse(row.config_json || '{}');
    const theme = JSON.parse(row.theme_json || '{}');
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      token: row.token,
      config,
      theme,
      obs_url: `${row._base || ''}/o/${row.token}`,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  function getOverlayOr404(req, res) {
    const row = db.prepare('SELECT * FROM overlays WHERE id = ?').get(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return null;
    }
    return row;
  }

  function currentSnapshot(overlayRow) {
    const config = JSON.parse(overlayRow.config_json || '{}');
    const state = runtime.ensureState(db, overlayRow);
    if (overlayRow.type === 'countdown' || overlayRow.type === 'starting_soon') {
      return runtime.timerSnapshot(config, state);
    }
    if (overlayRow.type === 'goal') {
      return { current: state.current };
    }
    return state;
  }

  function broadcastConfig(overlayRow, base) {
    hub.broadcast(overlayRow.id, {
      type: 'config',
      overlay: { ...serializeOverlay(overlayRow), obs_url: `${base}/o/${overlayRow.token}` },
      runtime: currentSnapshot(overlayRow)
    });
  }

  function broadcastRuntime(overlayRow) {
    hub.broadcast(overlayRow.id, { type: 'runtime', runtime: currentSnapshot(overlayRow) });
  }

  // ================= OVERLAYS CRUD (admin) =================

  app.get('/api/overlays', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM overlays ORDER BY created_at DESC').all();
    const base = baseUrl(req);
    res.json(rows.map((r) => serializeOverlay({ ...r, _base: base })));
  });

  app.get('/api/overlays/:id', requireAuth, (req, res) => {
    const row = getOverlayOr404(req, res);
    if (!row) return;
    res.json(serializeOverlay({ ...row, _base: baseUrl(req) }));
  });

  app.post('/api/overlays', requireAuth, (req, res) => {
    const type = OVERLAY_TYPES.includes(req.body?.type) ? req.body.type : null;
    if (!type) return res.status(400).json({ error: `type must be one of ${OVERLAY_TYPES.join(', ')}` });
    const name = String(req.body?.name || `${type} overlay`);
    const config = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};
    const theme = req.body?.theme && typeof req.body.theme === 'object' ? req.body.theme : { theme: 'neon' };
    const token = newToken();
    const info = db
      .prepare('INSERT INTO overlays (type, name, token, config_json, theme_json) VALUES (?, ?, ?, ?, ?)')
      .run(type, name, token, JSON.stringify(config), JSON.stringify(theme));
    const row = db.prepare('SELECT * FROM overlays WHERE id = ?').get(info.lastInsertRowid);
    runtime.ensureState(db, row);
    res.status(201).json(serializeOverlay({ ...row, _base: baseUrl(req) }));
  });

  app.put('/api/overlays/:id', requireAuth, (req, res) => {
    const row = getOverlayOr404(req, res);
    if (!row) return;
    const name = req.body?.name !== undefined ? String(req.body.name) : row.name;
    const config = req.body?.config !== undefined ? { ...JSON.parse(row.config_json), ...req.body.config } : JSON.parse(row.config_json);
    const theme = req.body?.theme !== undefined ? { ...JSON.parse(row.theme_json), ...req.body.theme } : JSON.parse(row.theme_json);
    db.prepare('UPDATE overlays SET name=?, config_json=?, theme_json=?, updated_at=datetime(\'now\') WHERE id=?').run(
      name,
      JSON.stringify(config),
      JSON.stringify(theme),
      row.id
    );
    const updated = db.prepare('SELECT * FROM overlays WHERE id = ?').get(row.id);
    broadcastConfig(updated, baseUrl(req));
    res.json(serializeOverlay({ ...updated, _base: baseUrl(req) }));
  });

  app.delete('/api/overlays/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM overlays WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM runtime_state WHERE overlay_id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/overlays/:id/duplicate', requireAuth, (req, res) => {
    const row = getOverlayOr404(req, res);
    if (!row) return;
    const token = newToken();
    const info = db
      .prepare('INSERT INTO overlays (type, name, token, config_json, theme_json) VALUES (?, ?, ?, ?, ?)')
      .run(row.type, `${row.name} (copy)`, token, row.config_json, row.theme_json);
    const copy = db.prepare('SELECT * FROM overlays WHERE id = ?').get(info.lastInsertRowid);
    runtime.ensureState(db, copy);
    res.status(201).json(serializeOverlay({ ...copy, _base: baseUrl(req) }));
  });

  app.post('/api/overlays/:id/regenerate-token', requireAuth, (req, res) => {
    const row = getOverlayOr404(req, res);
    if (!row) return;
    const token = newToken();
    db.prepare('UPDATE overlays SET token=?, updated_at=datetime(\'now\') WHERE id=?').run(token, row.id);
    const updated = db.prepare('SELECT * FROM overlays WHERE id = ?').get(row.id);
    res.json(serializeOverlay({ ...updated, _base: baseUrl(req) }));
  });

  // ---- live control ----
  app.post('/api/overlays/:id/control', requireAuth, (req, res) => {
    const row = getOverlayOr404(req, res);
    if (!row) return;
    const action = req.body?.action;
    const config = JSON.parse(row.config_json);
    let state = runtime.ensureState(db, row);

    if ((row.type === 'countdown' || row.type === 'starting_soon') && ['start', 'pause', 'reset'].includes(action)) {
      state = runtime.applyTimerControl(config, state, action);
      runtime.saveState(db, row.id, state);
    } else if (row.type === 'goal' && action === 'set_goal') {
      state = { ...state, current: Number(req.body?.value) || 0 };
      runtime.saveState(db, row.id, state);
    } else if (row.type === 'goal' && action === 'increment') {
      state = { ...state, current: (Number(state.current) || 0) + (Number(req.body?.by) || 1) };
      runtime.saveState(db, row.id, state);
    } else if (row.type === 'alertbox' && action === 'fire_alert') {
      const payload = {
        name: String(req.body?.name || ''),
        message: String(req.body?.message || ''),
        image: req.body?.image || '',
        sound: req.body?.sound || ''
      };
      db.prepare('INSERT INTO alert_events (overlay_id, source, payload_json) VALUES (?, ?, ?)').run(
        row.id,
        'dashboard',
        JSON.stringify(payload)
      );
      runtime.saveState(db, row.id, { ...state, last_alert: payload });
      hub.broadcast(row.id, { type: 'alert', payload });
      return res.json({ ok: true });
    } else {
      return res.status(400).json({ error: `Unsupported action "${action}" for overlay type "${row.type}"` });
    }

    broadcastRuntime(db.prepare('SELECT * FROM overlays WHERE id = ?').get(row.id));
    res.json({ ok: true, runtime: currentSnapshot(row) });
  });

  // ---- assets ----
  app.post('/api/assets', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file received (image or audio, max 16MB)' });
    const info = db
      .prepare('INSERT INTO assets (filename, mime, path, size) VALUES (?, ?, ?, ?)')
      .run(req.file.filename, req.file.mimetype, req.file.filename, req.file.size);
    res.status(201).json({
      id: info.lastInsertRowid,
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      mime: req.file.mimetype,
      size: req.file.size
    });
  });

  app.get('/api/assets', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all().map((a) => ({ ...a, url: `/uploads/${a.filename}` })));
  });

  app.delete('/api/assets/:id', requireAuth, (req, res) => {
    const a = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (a) {
      try {
        fs.unlinkSync(path.join(uploadsDir, a.filename));
      } catch {
        /* already gone */
      }
      db.prepare('DELETE FROM assets WHERE id = ?').run(a.id);
    }
    res.json({ ok: true });
  });

  // ---- settings ----
  app.get('/api/settings', requireAuth, (req, res) => res.json(getSettings(db)));
  app.put('/api/settings', requireAuth, (req, res) => res.json(setSettings(db, req.body || {})));

  app.get('/api/meta', requireAuth, (req, res) => {
    res.json({
      types: OVERLAY_TYPES,
      themes: Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, v.label])),
      fonts: Object.keys(FONTS)
    });
  });

  // ================= PUBLIC OVERLAY PAGE + STATE =================

  app.get('/o/:token', (req, res) => {
    const row = db.prepare('SELECT * FROM overlays WHERE token = ?').get(req.params.token);
    if (!row) return res.status(404).type('text').send('Overlay not found (token may have been regenerated)');
    const initial = currentSnapshot(row);
    res.set('Cache-Control', 'no-store');
    res.type('html').send(renderOverlayPage({ overlay: row, initial, wsPath: `/ws?token=${row.token}` }));
  });

  app.get('/api/public/overlay/:token/state', (req, res) => {
    const row = db.prepare('SELECT * FROM overlays WHERE token = ?').get(req.params.token);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      overlay: {
        id: row.id,
        type: row.type,
        name: row.name,
        token: row.token,
        config: JSON.parse(row.config_json),
        theme: JSON.parse(row.theme_json)
      },
      runtime: currentSnapshot(row)
    });
  });

  // ================= WEBHOOK =================
  // Unauthenticated-by-token, so rate-limit + cap payload size in case a leaked
  // URL gets hammered — 10 requests/min/token, sliding window.
  const hookHits = new Map(); // token -> timestamps[]
  function rateLimited(token) {
    const now = Date.now();
    const arr = (hookHits.get(token) || []).filter((t) => now - t < 60000);
    arr.push(now);
    hookHits.set(token, arr);
    return arr.length > 10;
  }

  app.post('/hook/:token', express.json({ limit: '8kb' }), (req, res) => {
    const row = db.prepare('SELECT * FROM overlays WHERE token = ?').get(req.params.token);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (rateLimited(row.token)) return res.status(429).json({ error: 'Rate limit exceeded (10/min)' });

    const body = req.body || {};
    if (row.type === 'alertbox') {
      const payload = {
        name: String(body.name || '').slice(0, 200),
        message: String(body.message || '').slice(0, 500),
        image: '',
        sound: ''
      };
      db.prepare('INSERT INTO alert_events (overlay_id, source, payload_json) VALUES (?, ?, ?)').run(
        row.id,
        'webhook',
        JSON.stringify(payload)
      );
      const state = runtime.ensureState(db, row);
      runtime.saveState(db, row.id, { ...state, last_alert: payload });
      hub.broadcast(row.id, { type: 'alert', payload });
      return res.json({ ok: true });
    }
    if (row.type === 'goal') {
      const amount = Number(body.amount) || 0;
      const state = runtime.ensureState(db, row);
      const next = { ...state, current: (Number(state.current) || 0) + amount };
      runtime.saveState(db, row.id, next);
      broadcastRuntime(row);
      return res.json({ ok: true, current: next.current });
    }
    return res.status(400).json({ error: `Webhook not supported for overlay type "${row.type}"` });
  });

  // ================= ADMIN SPA =================
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use('/admin', express.static(distDir));
    app.get('/admin/*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
    app.get('/', (req, res) => res.redirect('/admin'));
  } else {
    app.get(['/', '/admin', '/admin/*'], (req, res) =>
      res.status(503).type('html').send('<h1>Admin UI not built</h1><p>Run <code>npm run build</code> first.</p>')
    );
  }

  app.locals.db = db;
  app.locals.hub = hub;

  // ---- HTTP server + WebSocket upgrade for /ws?token=... ----
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    const token = url.searchParams.get('token');
    const row = token && db.prepare('SELECT * FROM overlays WHERE token = ?').get(token);
    if (!row) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      hub.add(row.id, ws);
      hub.send(ws, {
        type: 'init',
        overlay: serializeOverlay({ ...row, _base: '' }),
        runtime: currentSnapshot(row)
      });
    });
  });

  app.locals.wss = wss;
  app.locals.close = () => {
    hub.stop();
    wss.close();
  };

  return { app, server, db, hub };
}

module.exports = { createApp };
