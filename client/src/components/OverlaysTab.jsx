import React, { useEffect, useState } from 'react';
import { Plus, Timer, Target, MessageSquareText, Tv, PartyPopper, Copy, RefreshCw, Trash2, ExternalLink, ChevronLeft } from 'lucide-react';
import { api, OVERLAY_TYPES, overlayDefaultConfig } from '../api';
import { Card, Button } from './ui.jsx';
import Editor from './Editor.jsx';

const ICONS = { Timer, Target, MessageSquareText, Tv, PartyPopper };

function TypeIcon({ type, size = 18, className = '' }) {
  const meta = OVERLAY_TYPES.find((t) => t.value === type);
  const Icon = ICONS[meta?.icon] || Timer;
  return <Icon size={size} className={className} />;
}

function NewOverlayModal({ onClose, onCreated }) {
  const [type, setType] = useState('countdown');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const overlay = await api.createOverlay({
        type,
        name: name || OVERLAY_TYPES.find((t) => t.value === type).label,
        config: overlayDefaultConfig(type),
        theme: { theme: 'neon' }
      });
      onCreated(overlay);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4">New overlay</h3>
        <label>Type</label>
        <div className="grid grid-cols-1 gap-2 mb-4">
          {OVERLAY_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors cursor-pointer ${
                type === t.value ? 'border-violet-500 bg-violet-600/10 text-white' : 'border-zinc-800 hover:border-zinc-700 text-zinc-300'
              }`}
            >
              <TypeIcon type={t.value} />
              {t.label}
            </button>
          ))}
        </div>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sub goal (main)" className="mb-4" />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
        </div>
      </div>
    </div>
  );
}

function OverlayCard({ overlay, onOpen, onChanged }) {
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    navigator.clipboard?.writeText(overlay.obs_url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function duplicate(e) {
    e.stopPropagation();
    await api.duplicateOverlay(overlay.id);
    onChanged();
  }
  async function remove(e) {
    e.stopPropagation();
    if (!confirm(`Delete "${overlay.name}"? This cannot be undone.`)) return;
    await api.deleteOverlay(overlay.id);
    onChanged();
  }

  return (
    <Card className="cursor-pointer hover:border-zinc-700 transition-colors" >
      <div onClick={() => onOpen(overlay)}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-300 flex items-center justify-center">
            <TypeIcon type={overlay.type} size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{overlay.name}</p>
            <p className="text-xs text-zinc-500">{OVERLAY_TYPES.find((t) => t.value === overlay.type)?.label}</p>
          </div>
        </div>
        <div className="checkerboard rounded-lg h-20 flex items-center justify-center overflow-hidden mb-3">
          <iframe
            title={overlay.name}
            src={`/o/${overlay.token}`}
            className="pointer-events-none"
            style={{ width: 360, height: 120, transform: 'scale(0.55)', border: 'none' }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={copyUrl} className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg px-2 py-1.5 cursor-pointer">
          <Copy size={12} /> {copied ? 'Copied!' : 'Copy URL'}
        </button>
        <a href={`/o/${overlay.token}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="bg-zinc-800 hover:bg-zinc-700 rounded-lg p-1.5 cursor-pointer">
          <ExternalLink size={14} />
        </a>
        <button onClick={duplicate} className="bg-zinc-800 hover:bg-zinc-700 rounded-lg p-1.5 cursor-pointer" title="Duplicate">
          <RefreshCw size={14} />
        </button>
        <button onClick={remove} className="bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg p-1.5 cursor-pointer" title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </Card>
  );
}

export default function OverlaysTab() {
  const [overlays, setOverlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      setOverlays(await api.overlays());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (editing) {
    return (
      <div>
        <button onClick={() => { setEditing(null); load(); }} className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-4 cursor-pointer">
          <ChevronLeft size={16} /> Back to overlays
        </button>
        <Editor overlayId={editing.id} onSaved={load} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{overlays.length} overlay{overlays.length === 1 ? '' : 's'}</p>
        <Button onClick={() => setShowNew(true)} className="flex items-center gap-1.5">
          <Plus size={15} /> New overlay
        </Button>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : overlays.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-zinc-400 mb-4">No overlays yet — create your first one and drop the URL into an OBS Browser Source.</p>
          <Button onClick={() => setShowNew(true)} className="mx-auto flex items-center gap-1.5">
            <Plus size={15} /> New overlay
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {overlays.map((o) => (
            <OverlayCard key={o.id} overlay={o} onOpen={setEditing} onChanged={load} />
          ))}
        </div>
      )}

      {showNew && (
        <NewOverlayModal
          onClose={() => setShowNew(false)}
          onCreated={(o) => {
            setShowNew(false);
            load();
            setEditing(o);
          }}
        />
      )}
    </div>
  );
}
