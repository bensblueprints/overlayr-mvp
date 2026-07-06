// Smoke test — boots the real server as a child process (spawn, not app.listen)
// on port 5437 against a throwaway SQLite db, per the build plan's smoke test spec.
// Exercises: auth, overlay CRUD, the public /o/:token page, WS-pushed config
// updates, webhook-fired alerts, goal control + runtime_state persistence, and
// token regeneration. Only the spawned child PID is ever killed.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const Database = require('better-sqlite3');

const PORT = 5437;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'overlayr-test-'));

let passed = 0;
function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (async function poll() {
      try {
        const r = await fetch(`${BASE}/api/health`);
        if (r.ok) return resolve();
      } catch {
        /* not up yet */
      }
      if (Date.now() - start > timeoutMs) return reject(new Error('server did not become healthy in time'));
      setTimeout(poll, 200);
    })();
  });
}

function wsConnect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?token=${token}`);
    const timer = setTimeout(() => reject(new Error('ws connect timeout')), 5000);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

function waitForMessage(ws, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for expected WS message')), timeoutMs);
    function onMsg(raw) {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(msg);
      }
    }
    ws.on('message', onMsg);
  });
}

(async () => {
  console.log('Smoke test: Overlayr\n');
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, ADMIN_PASSWORD: 'test-pass-123' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let childErr = '';
  child.stderr.on('data', (d) => (childErr += d.toString()));

  let cookie = '';
  const jf = (url, opts = {}) =>
    fetch(BASE + url, { ...opts, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) } });

  try {
    await waitForHealth();
    ok('server boots and /api/health responds');

    // --- 1. auth ---
    let r = await jf('/api/overlays');
    assert.strictEqual(r.status, 401, 'unauthenticated request should 401');
    ok('admin API rejects unauthenticated requests (401)');

    r = await jf('/api/login', { method: 'POST', body: JSON.stringify({ password: 'test-pass-123' }) });
    assert.strictEqual(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
    ok('login sets session cookie (200)');

    // --- 2. create countdown overlay, fetch public page, bad token 404s ---
    r = await jf('/api/overlays', {
      method: 'POST',
      body: JSON.stringify({ type: 'countdown', name: 'Main Countdown', config: { mode: 'duration', duration_ms: 600000, format: 'hms', end_message: "We're live!" } })
    });
    assert.strictEqual(r.status, 201);
    const countdown = await r.json();
    assert.ok(countdown.token && countdown.token.length >= 20, 'token generated');
    ok('created countdown overlay -> 201 with token');

    r = await fetch(`${BASE}/o/${countdown.token}`);
    const html = await r.text();
    assert.strictEqual(r.status, 200);
    assert.ok(html.includes('id="ov-root"'), 'overlay mount div present');
    ok('GET /o/:token -> 200 HTML containing overlay mount div');

    r = await fetch(`${BASE}/o/not-a-real-token-xyz`);
    assert.strictEqual(r.status, 404);
    ok('bad token -> 404');

    // --- 3. WS client receives initial state with server-computed remaining ms ---
    const ws1 = await wsConnect(countdown.token);
    const initMsg = await waitForMessage(ws1, (m) => m.type === 'init');
    assert.strictEqual(initMsg.overlay.id, countdown.id);
    assert.strictEqual(typeof initMsg.runtime.remaining_ms, 'number');
    assert.strictEqual(initMsg.runtime.remaining_ms, 600000, 'idle duration-mode countdown previews full duration');
    ok('WS client receives init message with server-computed remaining_ms');

    // --- 4. PUT config change while WS connected -> WS receives config update within 2s ---
    const configPush = waitForMessage(ws1, (m) => m.type === 'config' && m.overlay.name === 'Renamed Countdown', 2000);
    r = await jf(`/api/overlays/${countdown.id}`, { method: 'PUT', body: JSON.stringify({ name: 'Renamed Countdown' }) });
    assert.strictEqual(r.status, 200);
    const pushed = await configPush;
    assert.strictEqual(pushed.overlay.name, 'Renamed Countdown');
    ok('PUT /api/overlays/:id -> connected WS client receives config push within 2s');

    // --- 5. alertbox: webhook fires alert, WS receives it, alert_events row exists ---
    r = await jf('/api/overlays', {
      method: 'POST',
      body: JSON.stringify({ type: 'alertbox', name: 'Alerts', config: { min_display_ms: 4000, presets: [] } })
    });
    const alertbox = await r.json();
    const ws2 = await wsConnect(alertbox.token);
    await waitForMessage(ws2, (m) => m.type === 'init');

    const alertPush = waitForMessage(ws2, (m) => m.type === 'alert', 3000);
    r = await fetch(`${BASE}/hook/${alertbox.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ben', message: 'hi' })
    });
    assert.strictEqual(r.status, 200);
    const alertMsg = await alertPush;
    assert.strictEqual(alertMsg.payload.name, 'Ben');
    assert.strictEqual(alertMsg.payload.message, 'hi');
    ok('POST /hook/:token fires alert -> WS receives alert event with payload');

    const db = new Database(path.join(dataDir, 'app.db'), { readonly: true });
    const eventRow = db.prepare('SELECT * FROM alert_events WHERE overlay_id = ?').get(alertbox.id);
    assert.ok(eventRow, 'alert_events row exists');
    assert.strictEqual(JSON.parse(eventRow.payload_json).name, 'Ben');
    ok('alert_events row persisted for the webhook-fired alert');

    // --- 6. goal overlay: control increment -> WS receives new value; persisted in runtime_state ---
    r = await jf('/api/overlays', {
      method: 'POST',
      body: JSON.stringify({ type: 'goal', name: 'Sub Goal', config: { label: 'Subs', current: 0, target: 100 } })
    });
    const goal = await r.json();
    const ws3 = await wsConnect(goal.token);
    await waitForMessage(ws3, (m) => m.type === 'init');

    const runtimePush = waitForMessage(ws3, (m) => m.type === 'runtime' && m.runtime.current === 5, 2000);
    r = await jf(`/api/overlays/${goal.id}/control`, { method: 'POST', body: JSON.stringify({ action: 'increment', by: 5 }) });
    assert.strictEqual(r.status, 200);
    await runtimePush;
    ok('control increment -> WS client receives new goal value');

    const stateRow = db.prepare('SELECT * FROM runtime_state WHERE overlay_id = ?').get(goal.id);
    assert.ok(stateRow, 'runtime_state row exists');
    assert.strictEqual(JSON.parse(stateRow.state_json).current, 5, 'incremented value persisted to runtime_state (restart-safe)');
    ok('runtime_state row persists the incremented goal value');

    // --- 7. regenerate token: old 404s, new 200s ---
    const oldToken = countdown.token;
    r = await jf(`/api/overlays/${countdown.id}/regenerate-token`, { method: 'POST' });
    assert.strictEqual(r.status, 200);
    const regenerated = await r.json();
    assert.notStrictEqual(regenerated.token, oldToken);

    r = await fetch(`${BASE}/o/${oldToken}`);
    assert.strictEqual(r.status, 404, 'old token 404s after regeneration');
    r = await fetch(`${BASE}/o/${regenerated.token}`);
    assert.strictEqual(r.status, 200, 'new token 200s');
    ok('regenerate-token: old token 404s, new token 200s');

    db.close();
    ws1.close();
    ws2.close();
    ws3.close();

    console.log(`\nAll ${passed} smoke checks passed.`);
    process.exitCode = 0;
  } catch (e) {
    console.error('\nSMOKE TEST FAILED:', e.message);
    console.error(e.stack);
    if (childErr) console.error('\n--- server stderr ---\n' + childErr);
    process.exitCode = 1;
  } finally {
    // Only kill the child PID we spawned above — never a broad node/electron kill.
    if (child.pid) {
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    for (const ext of ['', '-wal', '-shm']) {
      try {
        fs.rmSync(path.join(dataDir, 'app.db' + ext), { force: true });
      } catch {
        /* ignore */
      }
    }
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
})();
