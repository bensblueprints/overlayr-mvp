const { themeCssVars, cssVarString } = require('./themes');

// Renders the public, unauthenticated /o/:token page that OBS loads as a
// Browser Source. Token IS the auth (there's no login for these pages).
// Body background must stay transparent — OBS composites this over the scene.
function renderOverlayPage({ overlay, initial, wsPath }) {
  const vars = cssVarString(themeCssVars(JSON.parse(overlay.theme_json || '{}')));
  const config = JSON.parse(overlay.config_json || '{}');
  const bootstrap = {
    overlay: {
      id: overlay.id,
      type: overlay.type,
      name: overlay.name,
      token: overlay.token,
      config,
      theme: JSON.parse(overlay.theme_json || '{}')
    },
    runtime: initial,
    wsPath
  };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Overlayr — ${escapeHtml(overlay.name || overlay.type)}</title>
<style>
  html, body { margin: 0; padding: 0; background: transparent !important; overflow: hidden; }
  #ov-root { ${vars} font-family: var(--ov-font); color: var(--ov-fg); }
  * { box-sizing: border-box; }
  .ov-hidden { display: none !important; }

  /* ---- countdown ---- */
  .ov-countdown { display: inline-flex; align-items: baseline; gap: .35em; padding: .5em 1em;
    background: var(--ov-panel); border: 2px solid var(--ov-border); border-radius: var(--ov-radius);
    box-shadow: var(--ov-shadow); font-size: calc(48px * var(--ov-scale)); font-weight: 700; }
  .ov-countdown .ov-unit { color: var(--ov-accent); }
  .ov-countdown .ov-end-message { font-size: calc(32px * var(--ov-scale)); color: var(--ov-accent-2); }

  /* ---- goal bar ---- */
  .ov-goal { width: 100%; padding: .6em .9em; background: var(--ov-panel); border: 2px solid var(--ov-border);
    border-radius: var(--ov-radius); box-shadow: var(--ov-shadow); font-size: calc(20px * var(--ov-scale)); }
  .ov-goal-label { display: flex; justify-content: space-between; margin-bottom: .4em; font-weight: 700; }
  .ov-goal-track { position: relative; height: calc(22px * var(--ov-scale)); background: rgba(127,127,127,.25);
    border-radius: 999px; overflow: hidden; }
  .ov-goal-fill { position: absolute; inset: 0 auto 0 0; width: 0%; background: linear-gradient(90deg, var(--ov-accent), var(--ov-accent-2));
    transition: width .6s ease; border-radius: 999px; }
  .ov-goal.ov-milestone .ov-goal-fill { animation: ov-flash .5s ease 3; }
  @keyframes ov-flash { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.8); } }

  /* ---- ticker ---- */
  .ov-ticker { padding: .5em 1.1em; background: var(--ov-panel); border: 2px solid var(--ov-border);
    border-radius: var(--ov-radius); box-shadow: var(--ov-shadow); font-size: calc(26px * var(--ov-scale));
    font-weight: 600; white-space: nowrap; overflow: hidden; position: relative; min-width: 200px; }
  .ov-ticker-msg { transition: opacity .4s ease, transform .4s ease; }
  .ov-ticker-msg.ov-fade-out { opacity: 0; }
  .ov-ticker.ov-marquee .ov-ticker-msg { display: inline-block; animation: ov-marquee linear infinite; }
  @keyframes ov-marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }

  /* ---- starting soon ---- */
  .ov-starting-soon { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; gap: .5em; background-size: cover; background-position: center; }
  .ov-starting-soon .ov-headline { font-size: calc(64px * var(--ov-scale)); font-weight: 800; color: var(--ov-accent); text-shadow: var(--ov-shadow); }
  .ov-starting-soon .ov-subtext { font-size: calc(28px * var(--ov-scale)); color: var(--ov-fg); }

  /* ---- alert box ---- */
  .ov-alert { display: flex; align-items: center; gap: .7em; padding: .6em 1em; background: var(--ov-panel);
    border: 2px solid var(--ov-border); border-radius: var(--ov-radius); box-shadow: var(--ov-shadow);
    font-size: calc(24px * var(--ov-scale)); opacity: 0; transform: translateY(20px); transition: opacity .3s ease, transform .3s ease; }
  .ov-alert.ov-show { opacity: 1; transform: translateY(0); }
  .ov-alert img { width: calc(56px * var(--ov-scale)); height: calc(56px * var(--ov-scale)); border-radius: 50%; object-fit: cover; }
  .ov-alert .ov-alert-name { color: var(--ov-accent); font-weight: 800; }
</style>
</head>
<body>
<div id="ov-root"></div>
<script>window.__OVERLAYR_BOOTSTRAP__ = ${JSON.stringify(bootstrap)};</script>
<script>${clientScript()}</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Inline client runtime: connects over WS with exponential-backoff reconnect,
// falls back to 10s polling if WS never connects, and renders each overlay type.
// Kept dependency-free / ES2017-safe for OBS's older embedded Chromium.
function clientScript() {
  return `
(function () {
  var boot = window.__OVERLAYR_BOOTSTRAP__;
  var overlay = boot.overlay;
  var root = document.getElementById('ov-root');
  var state = { overlay: overlay, runtime: boot.runtime };
  var ws = null;
  var wsOk = false;
  var backoff = 1000;
  var pollTimer = null;
  var alertQueue = [];
  var alertShowing = false;

  function connect() {
    try {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(proto + '//' + location.host + boot.wsPath);
    } catch (e) { scheduleReconnect(); return; }
    ws.onopen = function () { wsOk = true; backoff = 1000; stopPolling(); };
    ws.onmessage = function (ev) {
      try { handleMessage(JSON.parse(ev.data)); } catch (e) {}
    };
    ws.onclose = function () { wsOk = false; scheduleReconnect(); startPolling(); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }

  function scheduleReconnect() {
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 30000);
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      fetch('/api/public/overlay/' + overlay.token + '/state')
        .then(function (r) { return r.json(); })
        .then(function (data) { handleMessage({ type: 'init', overlay: data.overlay, runtime: data.runtime }); })
        .catch(function () {});
    }, 10000);
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  function handleMessage(msg) {
    if (msg.type === 'init' || msg.type === 'config') {
      if (msg.overlay) state.overlay = msg.overlay;
      if (msg.runtime) state.runtime = msg.runtime;
      render();
    } else if (msg.type === 'runtime') {
      state.runtime = msg.runtime;
      render();
    } else if (msg.type === 'alert') {
      alertQueue.push(msg.payload);
      drainAlerts();
    }
  }

  function drainAlerts() {
    if (alertShowing || alertQueue.length === 0) return;
    var payload = alertQueue.shift();
    alertShowing = true;
    var minMs = (state.overlay.config && state.overlay.config.min_display_ms) || 4000;
    var box = document.createElement('div');
    box.className = 'ov-alert';
    var img = payload.image ? '<img src="' + payload.image + '">' : '';
    box.innerHTML = img + '<div><span class="ov-alert-name">' + escapeHtml(payload.name || '') + '</span> ' + escapeHtml(payload.message || '') + '</div>';
    root.innerHTML = '';
    root.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('ov-show'); });
    if (payload.sound) { try { new Audio(payload.sound).play().catch(function () {}); } catch (e) {} }
    setTimeout(function () {
      box.classList.remove('ov-show');
      setTimeout(function () {
        root.innerHTML = '';
        alertShowing = false;
        drainAlerts();
      }, 300);
    }, minMs);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtTime(ms, format) {
    var total = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    if (format === 'minutes') return String(Math.floor(total / 60));
    if (h > 0) return pad(h) + ':' + pad(m) + ':' + pad(s);
    return pad(m) + ':' + pad(s);
  }

  var localTimer = null;
  function render() {
    var type = state.overlay.type;
    var config = state.overlay.config || {};
    var rt = state.runtime || {};
    if (localTimer) { clearInterval(localTimer); localTimer = null; }

    if (type === 'countdown' || (type === 'starting_soon' && config.show_countdown)) {
      renderCountdown(config, rt, type === 'starting_soon');
    } else if (type === 'goal') {
      renderGoal(config, rt);
    } else if (type === 'ticker') {
      renderTicker(config);
    } else if (type === 'starting_soon') {
      renderStartingSoon(config, rt);
    } else if (type === 'alertbox') {
      root.innerHTML = '';
    }
  }

  function renderCountdown(config, rt, embedded) {
    var wrap = embedded ? null : root;
    var el = document.createElement('div');
    el.className = 'ov-countdown';
    function tick() {
      var remaining = rt.remaining_ms || 0;
      if (rt.status === 'running') {
        var elapsed = Date.now() - (rt.server_now || Date.now());
        remaining = Math.max(0, remaining - elapsed);
      }
      if (remaining <= 0 && config.end_message) {
        el.innerHTML = '<span class="ov-end-message">' + escapeHtml(config.end_message) + '</span>';
      } else {
        el.innerHTML = '<span class="ov-unit">' + fmtTime(remaining, config.format) + '</span>';
      }
    }
    tick();
    if (rt.status === 'running') localTimer = setInterval(tick, 250);
    if (!embedded) { root.innerHTML = ''; root.appendChild(el); }
    else root.__countdownEl = el;
  }

  function renderGoal(config, rt) {
    var current = (rt.current != null ? rt.current : config.current) || 0;
    var target = Number(config.target) || 1;
    var pct = Math.max(0, Math.min(100, (current / target) * 100));
    var hit = current >= target;
    root.innerHTML =
      '<div class="ov-goal' + (hit ? ' ov-milestone' : '') + '">' +
      '<div class="ov-goal-label"><span>' + escapeHtml(config.label || 'Goal') + '</span><span>' + current + ' / ' + target + '</span></div>' +
      '<div class="ov-goal-track"><div class="ov-goal-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
  }

  var tickerIdx = 0;
  function renderTicker(config) {
    var messages = (config.messages && config.messages.length) ? config.messages : ['Add a message in the editor'];
    var el = document.createElement('div');
    el.className = 'ov-ticker' + (config.marquee ? ' ov-marquee' : '');
    var span = document.createElement('span');
    span.className = 'ov-ticker-msg';
    span.textContent = messages[tickerIdx % messages.length];
    if (config.marquee) span.style.animationDuration = Math.max(4, messages[tickerIdx % messages.length].length / 6) + 's';
    el.appendChild(span);
    root.innerHTML = '';
    root.appendChild(el);
    var intervalMs = Math.max(2, Number(config.interval_s) || 6) * 1000;
    localTimer = setInterval(function () {
      span.classList.add('ov-fade-out');
      setTimeout(function () {
        tickerIdx++;
        span.textContent = messages[tickerIdx % messages.length];
        span.classList.remove('ov-fade-out');
      }, config.transition === 'slide' ? 0 : 400);
    }, intervalMs);
  }

  function renderStartingSoon(config, rt) {
    var el = document.createElement('div');
    el.className = 'ov-starting-soon';
    if (config.bg_image) el.style.backgroundImage = 'url(' + config.bg_image + ')';
    el.innerHTML =
      '<div class="ov-headline">' + escapeHtml(config.headline || 'Starting Soon') + '</div>' +
      (config.subtext ? '<div class="ov-subtext">' + escapeHtml(config.subtext) + '</div>' : '') +
      '<div class="ov-countdown-slot"></div>';
    root.innerHTML = '';
    root.appendChild(el);
    if (config.show_countdown) {
      var slot = el.querySelector('.ov-countdown-slot');
      var save = root;
      root = slot;
      renderCountdown(config, rt, true);
      if (root.__countdownEl) slot.appendChild(root.__countdownEl);
      root = save;
      if (localTimer) { /* keep running from renderCountdown */ }
    }
    if (config.bg_audio) {
      var audio = document.getElementById('ov-bg-audio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'ov-bg-audio';
        audio.loop = true;
        audio.src = config.bg_audio;
        document.body.appendChild(audio);
        audio.play().catch(function () {});
      }
    }
  }

  connect();
  render();
})();
`;
}

module.exports = { renderOverlayPage };
