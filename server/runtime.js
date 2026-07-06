// Server-authoritative runtime state for overlays.
// Timers are NEVER trusted to the client clock: we persist started_at/ends_at
// (or remaining_ms while paused) and always send server-computed values.
// This module owns reading/writing runtime_state and applying control actions.

function getRawState(db, overlayId) {
  const row = db.prepare('SELECT state_json FROM runtime_state WHERE overlay_id = ?').get(overlayId);
  return row ? JSON.parse(row.state_json) : null;
}

function saveState(db, overlayId, state) {
  db.prepare(
    `INSERT INTO runtime_state (overlay_id, state_json, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(overlay_id) DO UPDATE SET state_json = excluded.state_json, updated_at = datetime('now')`
  ).run(overlayId, JSON.stringify(state));
  return state;
}

function defaultTimerState() {
  return { status: 'idle', started_at: null, ends_at: null, remaining_ms_at_pause: null };
}

function defaultStateFor(type, config) {
  switch (type) {
    case 'countdown':
    case 'starting_soon':
      return defaultTimerState();
    case 'goal':
      return { current: Number(config?.current) || 0 };
    case 'alertbox':
      return { last_alert: null };
    case 'ticker':
    default:
      return {};
  }
}

function ensureState(db, overlay) {
  let state = getRawState(db, overlay.id);
  if (!state) {
    state = defaultStateFor(overlay.type, JSON.parse(overlay.config_json));
    saveState(db, overlay.id, state);
  }
  return state;
}

// Snapshot a timer state into what the client needs to render right now.
function timerSnapshot(config, state, now = Date.now()) {
  const mode = config.mode === 'target' ? 'target' : 'duration';
  let remainingMs;
  let status = state.status || 'idle';

  if (status === 'running') {
    const endsAt = state.ends_at ? new Date(state.ends_at).getTime() : now;
    remainingMs = endsAt - now;
    if (remainingMs <= 0) {
      remainingMs = 0;
      status = 'ended';
    }
  } else if (status === 'paused') {
    remainingMs = state.remaining_ms_at_pause ?? 0;
  } else {
    // idle: preview the configured duration/target without running
    if (mode === 'target' && config.target_at) {
      remainingMs = Math.max(0, new Date(config.target_at).getTime() - now);
    } else {
      remainingMs = Number(config.duration_ms) || 0;
    }
  }

  return {
    status,
    mode,
    remaining_ms: Math.max(0, Math.round(remainingMs)),
    ends_at: state.ends_at || null,
    server_now: now
  };
}

function applyTimerControl(config, state, action, params = {}, now = Date.now()) {
  const mode = config.mode === 'target' ? 'target' : 'duration';
  const next = { ...state };

  if (action === 'start') {
    if (mode === 'target') {
      next.status = 'running';
      next.started_at = new Date(now).toISOString();
      next.ends_at = config.target_at || new Date(now).toISOString();
      next.remaining_ms_at_pause = null;
    } else {
      const resumeMs = next.status === 'paused' && next.remaining_ms_at_pause != null
        ? next.remaining_ms_at_pause
        : Number(config.duration_ms) || 0;
      next.status = 'running';
      next.started_at = new Date(now).toISOString();
      next.ends_at = new Date(now + resumeMs).toISOString();
      next.remaining_ms_at_pause = null;
    }
  } else if (action === 'pause') {
    if (next.status === 'running') {
      const endsAt = next.ends_at ? new Date(next.ends_at).getTime() : now;
      next.remaining_ms_at_pause = Math.max(0, endsAt - now);
      next.status = 'paused';
    }
  } else if (action === 'reset') {
    return defaultTimerState();
  }
  return next;
}

module.exports = {
  getRawState,
  saveState,
  ensureState,
  defaultStateFor,
  defaultTimerState,
  timerSnapshot,
  applyTimerControl
};
