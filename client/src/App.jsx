import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clapperboard, LayoutGrid, Gamepad2, Settings as SettingsIcon, LogOut, Lock } from 'lucide-react';
import { api } from './api';
import { Button } from './components/ui.jsx';
import OverlaysTab from './components/OverlaysTab.jsx';
import LiveControlTab from './components/LiveControlTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';

const TABS = [
  { id: 'overlays', label: 'Overlays', icon: LayoutGrid },
  { id: 'live', label: 'Live Control', icon: Gamepad2 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon }
];

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.login(pw);
      onDone();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="w-full max-w-sm bg-zinc-900/70 border border-zinc-800 rounded-2xl p-8"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
            <Clapperboard size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Overlayr</h1>
            <p className="text-xs text-zinc-500">Admin dashboard</p>
          </div>
        </div>
        <label>Admin password</label>
        <div className="relative">
          <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="pl-9"
            placeholder="••••••••"
            autoFocus
          />
        </div>
        {err && <p className="text-red-400 text-sm mt-2">{err}</p>}
        <Button className="w-full mt-4" disabled={busy || !pw}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-xs text-zinc-600 mt-4">
          Default password is <code>admin</code> — change it via ADMIN_PASSWORD in .env
        </p>
      </motion.form>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState('overlays');

  useEffect(() => {
    api.me().then((r) => setAuthed(r.authed)).catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="min-h-screen flex items-center justify-center text-zinc-500">Loading…</div>;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen max-w-7xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
            <Clapperboard size={18} />
          </div>
          <h1 className="font-bold text-lg">Overlayr</h1>
        </div>
        <button
          onClick={() => api.logout().then(() => setAuthed(false))}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <nav className="flex gap-1 mb-6 bg-zinc-900/70 border border-zinc-800 rounded-xl p-1 overflow-x-auto w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              tab === t.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab === t.id && (
              <motion.span layoutId="tab-bg" className="absolute inset-0 bg-violet-600/90 rounded-lg" transition={{ type: 'spring', duration: 0.4 }} />
            )}
            <t.icon size={15} className="relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {tab === 'overlays' && <OverlaysTab />}
          {tab === 'live' && <LiveControlTab />}
          {tab === 'settings' && <SettingsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
