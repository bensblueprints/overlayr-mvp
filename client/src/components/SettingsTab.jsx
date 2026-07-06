import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api';
import { Card, Button, FileUpload } from './ui.jsx';

export default function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [assets, setAssets] = useState([]);
  const [saved, setSaved] = useState(false);

  async function load() {
    setSettings(await api.getSettings());
    setAssets(await api.assets());
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    await api.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function removeAsset(id) {
    await api.deleteAsset(id);
    setAssets(await api.assets());
  }

  if (!settings) return <p className="text-zinc-500 text-sm">Loading…</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card title="Base URL">
        <p className="text-xs text-zinc-500 mb-3">
          Used when generating OBS Browser Source / webhook links. Leave blank to use the request's own host — set this if you're
          behind a reverse proxy with a different public hostname.
        </p>
        <label>Base URL</label>
        <input
          value={settings.base_url}
          onChange={(e) => setSettings({ ...settings, base_url: e.target.value })}
          placeholder="https://overlays.example.com"
          className="mb-3"
        />
        <Button onClick={save}>{saved ? 'Saved!' : 'Save'}</Button>
      </Card>

      <Card title="Asset manager">
        <FileUpload label="Upload asset" onChange={load} />
        <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
          {assets.length === 0 && <p className="text-xs text-zinc-600">No uploaded assets yet.</p>}
          {assets.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-3 py-2 text-xs">
              <span className="truncate">{a.filename}</span>
              <button onClick={() => removeAsset(a.id)} className="text-red-400 hover:text-red-300 cursor-pointer">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
