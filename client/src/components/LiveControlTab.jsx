import React, { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, PartyPopper, Timer, Target, MessageSquareText, Tv } from 'lucide-react';
import { api } from '../api';
import { Card, Button } from './ui.jsx';

const ICONS = { countdown: Timer, goal: Target, ticker: MessageSquareText, starting_soon: Tv, alertbox: PartyPopper };

export default function LiveControlTab() {
  const [overlays, setOverlays] = useState([]);
  const [busy, setBusy] = useState(null);

  async function load() {
    setOverlays(await api.overlays());
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function run(id, action, params) {
    setBusy(`${id}:${action}`);
    try {
      await api.control(id, action, params);
    } finally {
      setBusy(null);
    }
  }

  if (overlays.length === 0) {
    return <Card className="text-center py-16"><p className="text-zinc-400">No overlays yet. Create one in the Overlays tab first.</p></Card>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {overlays.map((o) => {
        const Icon = ICONS[o.type] || Timer;
        return (
          <Card key={o.id}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-300 flex items-center justify-center">
                <Icon size={16} />
              </div>
              <p className="font-semibold text-sm truncate">{o.name}</p>
            </div>

            {(o.type === 'countdown' || o.type === 'starting_soon') && (
              <div className="grid grid-cols-3 gap-2">
                <Button className="flex items-center justify-center gap-1 text-xs py-3" disabled={busy} onClick={() => run(o.id, 'start')}>
                  <Play size={14} /> Start
                </Button>
                <Button variant="ghost" className="flex items-center justify-center gap-1 text-xs py-3" disabled={busy} onClick={() => run(o.id, 'pause')}>
                  <Pause size={14} /> Pause
                </Button>
                <Button variant="ghost" className="flex items-center justify-center gap-1 text-xs py-3" disabled={busy} onClick={() => run(o.id, 'reset')}>
                  <RotateCcw size={14} /> Reset
                </Button>
              </div>
            )}

            {o.type === 'goal' && (
              <div className="grid grid-cols-3 gap-2">
                {[1, 5, 10].map((n) => (
                  <Button key={n} variant="ghost" className="text-sm py-3" disabled={busy} onClick={() => run(o.id, 'increment', { by: n })}>
                    +{n}
                  </Button>
                ))}
              </div>
            )}

            {o.type === 'alertbox' && (
              <div className="flex flex-wrap gap-2">
                {(o.config.presets || []).length === 0 && <p className="text-xs text-zinc-600">No presets — add some in the editor.</p>}
                {(o.config.presets || []).map((p, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    className="text-xs py-2.5 flex items-center gap-1.5"
                    disabled={busy}
                    onClick={() => run(o.id, 'fire_alert', { name: p.name, message: p.message, image: o.config.default_image, sound: o.config.default_sound })}
                  >
                    <PartyPopper size={12} /> {p.name}
                  </Button>
                ))}
              </div>
            )}

            {o.type === 'ticker' && <p className="text-xs text-zinc-600">Ticker rotates automatically — no live controls needed.</p>}
          </Card>
        );
      })}
    </div>
  );
}
