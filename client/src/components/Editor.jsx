import React, { useEffect, useRef, useState } from 'react';
import { Copy, RefreshCw, Play, Pause, RotateCcw, Plus, Trash2, PartyPopper } from 'lucide-react';
import { api } from '../api';
import { Card, Button, FileUpload, Toggle } from './ui.jsx';

const OBS_SIZE_HINTS = {
  countdown: '400 x 150',
  goal: '520 x 120',
  ticker: '640 x 100',
  starting_soon: '1920 x 1080',
  alertbox: '520 x 160'
};

const THEME_OPTIONS = ['neon', 'minimal', 'retro', 'brutalist', 'glass'];
const FONT_OPTIONS = ['system', 'mono', 'serif', 'impact', 'rounded'];

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label>{label}</label>
      {children}
    </div>
  );
}

function CountdownFields({ config, set }) {
  return (
    <>
      <Field label="Mode">
        <select value={config.mode} onChange={(e) => set({ mode: e.target.value })}>
          <option value="duration">Duration (counts down from N)</option>
          <option value="target">Target date/time</option>
        </select>
      </Field>
      {config.mode === 'target' ? (
        <Field label="Target date/time">
          <input
            type="datetime-local"
            value={config.target_at ? config.target_at.slice(0, 16) : ''}
            onChange={(e) => set({ target_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
          />
        </Field>
      ) : (
        <Field label="Duration (minutes)">
          <input
            type="number"
            min="0"
            value={Math.round((config.duration_ms || 0) / 60000)}
            onChange={(e) => set({ duration_ms: Math.max(0, Number(e.target.value) || 0) * 60000 })}
          />
        </Field>
      )}
      <Field label="Format">
        <select value={config.format} onChange={(e) => set({ format: e.target.value })}>
          <option value="hms">HH:MM:SS</option>
          <option value="minutes">Minutes only</option>
        </select>
      </Field>
      <Field label="End message">
        <input value={config.end_message || ''} onChange={(e) => set({ end_message: e.target.value })} placeholder="We're live!" />
      </Field>
      <Field label="End sound (optional)">
        <FileUpload accept="audio/*" value={config.end_sound} onChange={(url) => set({ end_sound: url })} label="Upload sound" />
      </Field>
    </>
  );
}

function GoalFields({ config, set }) {
  return (
    <>
      <Field label="Label">
        <input value={config.label || ''} onChange={(e) => set({ label: e.target.value })} placeholder="Sub Goal" />
      </Field>
      <Field label="Target value">
        <input type="number" value={config.target || 0} onChange={(e) => set({ target: Number(e.target.value) || 0 })} />
      </Field>
      <Field label="Current value">
        <div className="flex items-center gap-2">
          <input type="number" value={config.current || 0} onChange={(e) => set({ current: Number(e.target.value) || 0 })} />
        </div>
      </Field>
    </>
  );
}

function TickerFields({ config, set }) {
  const messages = config.messages || [];
  function updateMsg(i, v) {
    const next = [...messages];
    next[i] = v;
    set({ messages: next });
  }
  return (
    <>
      <Field label="Messages">
        <div className="space-y-2">
          {messages.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input value={m} onChange={(e) => updateMsg(i, e.target.value)} />
              <button onClick={() => set({ messages: messages.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-300 cursor-pointer px-2">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={() => set({ messages: [...messages, 'New message'] })} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 cursor-pointer">
            <Plus size={12} /> Add message
          </button>
        </div>
      </Field>
      <Field label="Interval (seconds)">
        <input type="number" min="2" value={config.interval_s || 6} onChange={(e) => set({ interval_s: Number(e.target.value) || 6 })} />
      </Field>
      <Field label="Transition">
        <select value={config.transition} onChange={(e) => set({ transition: e.target.value })}>
          <option value="fade">Fade</option>
          <option value="slide">Slide</option>
        </select>
      </Field>
      <Toggle checked={!!config.marquee} onChange={(v) => set({ marquee: v })} label="Scrolling marquee mode" />
    </>
  );
}

function StartingSoonFields({ config, set }) {
  return (
    <>
      <Field label="Headline">
        <input value={config.headline || ''} onChange={(e) => set({ headline: e.target.value })} />
      </Field>
      <Field label="Sub-text">
        <textarea rows={2} value={config.subtext || ''} onChange={(e) => set({ subtext: e.target.value })} />
      </Field>
      <Toggle checked={!!config.show_countdown} onChange={(v) => set({ show_countdown: v })} label="Show embedded countdown" />
      {config.show_countdown && (
        <div className="mt-3 pl-3 border-l-2 border-zinc-800">
          <CountdownFields config={config} set={set} />
        </div>
      )}
      <Field label="Background image (optional)">
        <FileUpload value={config.bg_image} onChange={(url) => set({ bg_image: url })} label="Upload background" />
      </Field>
      <Field label="Looping audio (optional)">
        <FileUpload accept="audio/*" value={config.bg_audio} onChange={(url) => set({ bg_audio: url })} label="Upload audio" />
      </Field>
    </>
  );
}

function AlertboxFields({ config, set }) {
  const presets = config.presets || [];
  function updatePreset(i, patch) {
    const next = [...presets];
    next[i] = { ...next[i], ...patch };
    set({ presets: next });
  }
  return (
    <>
      <Field label="Minimum display duration (ms)">
        <input type="number" min="1000" value={config.min_display_ms || 4000} onChange={(e) => set({ min_display_ms: Number(e.target.value) || 4000 })} />
      </Field>
      <Field label="Preset alerts (dashboard quick-fire buttons)">
        <div className="space-y-2">
          {presets.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input value={p.name} onChange={(e) => updatePreset(i, { name: e.target.value })} placeholder="Name" className="w-1/3" />
              <input value={p.message} onChange={(e) => updatePreset(i, { message: e.target.value })} placeholder="Message" />
              <button onClick={() => set({ presets: presets.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-300 cursor-pointer px-2">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => set({ presets: [...presets, { name: 'New Follower', message: 'just followed!' }] })}
            className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 cursor-pointer"
          >
            <Plus size={12} /> Add preset
          </button>
        </div>
      </Field>
      <Field label="Default alert image (optional)">
        <FileUpload value={config.default_image} onChange={(url) => set({ default_image: url })} label="Upload image" />
      </Field>
      <Field label="Default alert sound (optional)">
        <FileUpload accept="audio/*" value={config.default_sound} onChange={(url) => set({ default_sound: url })} label="Upload sound" />
      </Field>
    </>
  );
}

const FIELD_COMPONENTS = {
  countdown: CountdownFields,
  goal: GoalFields,
  ticker: TickerFields,
  starting_soon: StartingSoonFields,
  alertbox: AlertboxFields
};

export default function Editor({ overlayId, onSaved }) {
  const [overlay, setOverlay] = useState(null);
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    api.overlay(overlayId).then(setOverlay);
  }, [overlayId]);

  function scheduleSave(next) {
    setOverlay(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await api.updateOverlay(overlayId, { name: next.name, config: next.config, theme: next.theme });
      onSaved?.();
    }, 350);
  }

  function setConfig(patch) {
    scheduleSave({ ...overlay, config: { ...overlay.config, ...patch } });
  }
  function setTheme(patch) {
    scheduleSave({ ...overlay, theme: { ...overlay.theme, ...patch } });
  }
  function setName(name) {
    scheduleSave({ ...overlay, name });
  }

  async function regenerate() {
    if (!confirm('Regenerate token? The old OBS URL will stop working immediately.')) return;
    const updated = await api.regenerateToken(overlayId);
    setOverlay(updated);
    onSaved?.();
  }

  function copyUrl() {
    navigator.clipboard?.writeText(overlay.obs_url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function control(action, params) {
    await api.control(overlayId, action, params);
  }

  if (!overlay) return <p className="text-zinc-500 text-sm">Loading…</p>;

  const Fields = FIELD_COMPONENTS[overlay.type];
  const isFullscreen = overlay.type === 'starting_soon';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div>
        <Card title="Config" className="mb-4">
          <Field label="Name">
            <input value={overlay.name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Fields config={overlay.config} set={setConfig} />
        </Card>

        <Card title="Theme" className="mb-4">
          <Field label="Preset">
            <div className="grid grid-cols-5 gap-2">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme({ theme: t })}
                  className={`text-xs capitalize py-2 rounded-lg border cursor-pointer ${
                    overlay.theme.theme === t ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Font">
              <select value={overlay.theme.font || 'system'} onChange={(e) => setTheme({ font: e.target.value })}>
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Scale">
              <input type="number" step="0.1" min="0.3" max="3" value={overlay.theme.scale || 1} onChange={(e) => setTheme({ scale: Number(e.target.value) || 1 })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Accent color">
              <input type="color" value={overlay.theme.accent || '#ff2fd0'} onChange={(e) => setTheme({ accent: e.target.value })} className="h-9 p-1" />
            </Field>
            <Field label="Accent color 2">
              <input type="color" value={overlay.theme.accent2 || '#2fe6ff'} onChange={(e) => setTheme({ accent2: e.target.value })} className="h-9 p-1" />
            </Field>
          </div>
        </Card>

        {overlay.type === 'countdown' || overlay.type === 'starting_soon' ? (
          <Card title="Timer control" className="mb-4">
            <div className="flex gap-2">
              <Button onClick={() => control('start')} className="flex items-center gap-1.5"><Play size={14} /> Start</Button>
              <Button variant="ghost" onClick={() => control('pause')} className="flex items-center gap-1.5"><Pause size={14} /> Pause</Button>
              <Button variant="ghost" onClick={() => control('reset')} className="flex items-center gap-1.5"><RotateCcw size={14} /> Reset</Button>
            </div>
          </Card>
        ) : null}

        {overlay.type === 'goal' ? (
          <Card title="Bump goal" className="mb-4">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => control('increment', { by: 1 })}>+1</Button>
              <Button variant="ghost" onClick={() => control('increment', { by: 5 })}>+5</Button>
              <Button variant="ghost" onClick={() => control('increment', { by: 10 })}>+10</Button>
            </div>
          </Card>
        ) : null}

        {overlay.type === 'alertbox' ? (
          <Card title="Fire alert" className="mb-4">
            <div className="flex flex-wrap gap-2">
              {(overlay.config.presets || []).map((p, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  className="flex items-center gap-1.5"
                  onClick={() => control('fire_alert', { name: p.name, message: p.message, image: overlay.config.default_image, sound: overlay.config.default_sound })}
                >
                  <PartyPopper size={13} /> {p.name}
                </Button>
              ))}
            </div>
          </Card>
        ) : null}

        <Card title="OBS Browser Source">
          <p className="text-xs text-zinc-500 mb-2">Recommended size: <span className="text-zinc-300 font-mono">{OBS_SIZE_HINTS[overlay.type]}</span></p>
          <div className="flex gap-2 mb-2">
            <input readOnly value={overlay.obs_url} className="font-mono text-xs" />
            <Button variant="ghost" onClick={copyUrl}><Copy size={14} /></Button>
          </div>
          <p className="text-xs text-zinc-500 mb-3">{copied ? 'Copied!' : 'Paste this URL into an OBS Browser Source.'}</p>
          <Button variant="danger" onClick={regenerate} className="flex items-center gap-1.5 text-xs">
            <RefreshCw size={13} /> Regenerate token (invalidates old URL)
          </Button>
        </Card>
      </div>

      <div>
        <Card title="Live preview">
          <div className="checkerboard rounded-lg overflow-hidden flex items-center justify-center" style={{ height: isFullscreen ? 320 : 220 }}>
            <iframe
              ref={previewRef}
              key={overlay.token}
              title="preview"
              src={`/o/${overlay.token}`}
              style={{ width: isFullscreen ? '100%' : 480, height: isFullscreen ? '100%' : 160, border: 'none' }}
            />
          </div>
          <p className="text-xs text-zinc-600 mt-2">This is a live iframe of the real overlay URL — exactly what OBS renders. Config edits push instantly over WebSocket, no refresh needed.</p>
        </Card>
      </div>
    </div>
  );
}
