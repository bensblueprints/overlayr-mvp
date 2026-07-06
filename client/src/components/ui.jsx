import React, { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { api } from '../api';

export function Card({ title, children, actions, className = '' }) {
  return (
    <div className={`bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-violet-600 hover:bg-violet-500 text-white',
    ghost: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200',
    danger: 'bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-800'
  };
  return (
    <button
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function FileUpload({ value, onChange, accept = 'image/*', label = 'Upload file' }) {
  const ref = useRef();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(file) {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const { url } = await api.upload(file);
      onChange(url);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 max-w-[220px] truncate">
            <span className="truncate">{value.split('/').pop()}</span>
            <button onClick={() => onChange('')} className="text-zinc-500 hover:text-red-400 cursor-pointer">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="flex items-center gap-2 border border-dashed border-zinc-700 hover:border-violet-500 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {label}
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {err && <p className="text-red-400 text-xs mt-1">{err}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-violet-600' : 'bg-zinc-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm text-zinc-300 normal-case font-normal">{label}</span>}
    </label>
  );
}
