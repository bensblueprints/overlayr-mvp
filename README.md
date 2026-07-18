# 🎥 Overlayr

## Demo

VIDEO-PLACEHOLDER

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Your overlays, your server. Pay once. Own it forever. No subscription.**

Self-hosted stream overlays for OBS: countdown timers, goal bars, rotating message tickers, "starting soon" scenes, and dashboard-triggered alerts. Every overlay is just a URL you drop into an OBS Browser Source — updated live over WebSocket, server-authoritative so timers never desync on a reload.

![Screenshot](docs/screenshot.png)

## ☕ Skip the setup — get the 1-click installer

Don't want to touch a terminal? Grab the packaged installer (Windows desktop app + guided VPS deploy) here:

**→ [https://whop.com/onetime-suite](https://whop.com/onetime-suite)** — one-time purchase, lifetime updates.

## Features

- **Countdown timer** — target datetime or duration mode, pause/resume/reset from the dashboard, custom end message, optional end sound, HH:MM:SS or minutes-only format
- **Goal bar** — animated fill, +1/+5/+10 dashboard buttons, milestone flash when the target is hit, also settable via webhook (`amount`)
- **Rotating messages (ticker)** — a list of messages with fade/slide transitions or a scrolling marquee mode
- **Starting soon scene** — full-screen headline + sub-text + embedded countdown, optional background image and looping audio
- **Alert box** — chat-style name + message + optional image/sound, fired from a dashboard button (with saved presets) or `POST /hook/:token` — wire it to Streamer.bot, Zapier, or anything that can make an HTTP request
- **Live editor** — config form on the left, a real iframe of the actual overlay URL on the right over a transparent checkerboard (exactly what OBS sees) — edits push instantly over WebSocket, no refresh
- **5 built-in themes** — neon, minimal, retro, brutalist, glass — plus per-overlay font, accent color, and scale overrides
- **Live Control panel** — one screen with big buttons for the whole stream session: fire alerts, bump goals, start/pause timers
- **Server-authoritative timers** — OBS reloads Browser Sources constantly; remaining time is computed server-side and resent on every reconnect, so a countdown never resets by accident
- **Duplicate overlay + regenerate token** — invalidate a leaked OBS URL without rebuilding the whole overlay
- **100% local & private** — one SQLite file, no telemetry, no external services

## Quick start

```bash
npm i
npm run build   # builds the admin UI
npm start       # → http://localhost:5337
```

- **Admin dashboard:** `http://localhost:5337/admin` (default password `admin` — change via `ADMIN_PASSWORD`)
- **Overlay pages:** `http://localhost:5337/o/<token>` — paste into an OBS Browser Source
- **Webhook:** `POST http://localhost:5337/hook/<token>` — fire alerts or bump goals from anywhere

### Desktop mode

Run it as a desktop app, or deploy to a $5 VPS when you need it public:

```bash
npm run desktop   # Electron window, auto-logged-in, data stored per-user
```

Point OBS at the printed `http://127.0.0.1:<port>/o/<token>` URLs — same server, same tokens, just running locally.

`npm run dist` packages a Windows installer (NSIS) via electron-builder.

### Docker (VPS deploy)

```bash
cp .env.example .env   # set ADMIN_PASSWORD!
docker compose up -d   # persists SQLite + uploads in a named volume
```

## OBS setup

1. Create an overlay in the dashboard, pick a type and theme.
2. Copy its OBS URL from the editor (each type shows a recommended Browser Source size).
3. In OBS: **Sources → + → Browser Source**, paste the URL, set the width/height, check **"Shutdown source when not visible"** off and leave the background transparent (Overlayr's pages render `background: transparent` by default).
4. Edits in the dashboard push to the overlay instantly — no need to refresh the Browser Source.

## Overlayr vs Streamlabs / OWN3D

| | **Overlayr (this)** | Streamlabs Ultra | OWN3D Pro |
|---|---|---|---|
| Price | **$24 once** | $19/mo ($149/yr) | $12.99/mo |
| Self-hosted, own your data | ✅ Yes | ❌ Cloud only | ❌ Cloud only |
| Watermark / branding | **None** | On free tier | On free tier |
| Webhook-triggered alerts | ✅ Built in | Paid tier | Paid tier |
| Server-authoritative timers | ✅ Survives reconnects | Varies | Varies |
| Themes | 5 presets + full overrides | Marketplace | Marketplace |
| Cost over 3 years | **$24** | $537–$1,788 | $467 |

## Tech stack

- **Server:** Node 20+, Express, `ws` (raw WebSocket server on the same HTTP server), better-sqlite3 (WAL) — single process serves the admin API, admin UI, overlay pages, and the webhook endpoint
- **Admin UI:** React 18, Vite, Tailwind CSS 4, Framer Motion, Lucide icons
- **Overlay pages:** server-rendered plain HTML/CSS/JS (no framework payload) with a dependency-free reconnecting WS client — kept ES2017-safe for OBS's older embedded Chromium
- **Desktop:** thin Electron wrapper reusing the exact same server on a free local port
- **Storage:** one SQLite file + an uploads folder for images/sounds. Back up = copy two things.

## Data model

- `overlays` — type, name, unique token, config JSON, theme JSON
- `runtime_state` — per-overlay live state (timer started_at/ends_at, goal value, last alert) — persisted so a restart doesn't lose a running countdown
- `alert_events` — history of fired alerts (dashboard + webhook)
- `assets` — uploaded images/sounds
- `sessions` — persisted admin sessions

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `5337` | Server port |
| `ADMIN_PASSWORD` | `admin` | Admin dashboard password |
| `DATA_DIR` | `./data` | SQLite db + uploaded assets |
| `BASE_URL` | *(request host)* | Override the host used in generated OBS/webhook URLs (behind a reverse proxy) |

## Fonts

Theme fonts use system font stacks by default (no network fetch required — OBS's embedded browser shouldn't need to hit a CDN for a webfont). Drop self-hosted `.woff2` files into `client/public/fonts/` and reference them in `server/themes.js` if you want fully custom branded typography.

## Development

```bash
npm start        # API + WS + overlay pages on :5337
npm run dev      # Vite dev server for the admin UI on :5338 (proxies /api, /o, /ws)
npm test         # end-to-end smoke test against a throwaway db (spawns the real server on :5437)
```

## License

MIT © 2026 Ben ([bensblueprints](https://github.com/bensblueprints))
