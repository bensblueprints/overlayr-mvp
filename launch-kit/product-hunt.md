# Product Hunt Launch — Overlayr

## Name
Overlayr — your overlays, your server

## Tagline (60 chars)
Self-hosted OBS overlays. Pay $24 once, no subscription.

## Description (260 chars)
Countdown timers, goal bars, tickers, starting-soon scenes and alert boxes for OBS — each a tokenized Browser Source URL, updated live over WebSocket. Server-authoritative timers, webhook-fired alerts, 5 themes. One SQLite file. Desktop app or $5 VPS. MIT source.

## Full description

Overlayr is a self-hosted stream overlay suite for streamers who are tired of renting their own scenes from StreamElements or Streamlabs.

**What you get:**
- 5 overlay types: countdown timer (target date or duration mode), goal bar with milestone flash, rotating message ticker (fade/slide/marquee), a full-screen "starting soon" scene with embedded countdown + background image/audio, and a chat-style alert box
- Every overlay is just a URL — drop it into an OBS Browser Source, no plugin, no login for OBS (a per-overlay secret token *is* the auth)
- Server-authoritative timers: OBS reloads sources constantly, and this never loses track — remaining time is computed server-side and resent on every reconnect
- Live editor: config form on the left, a real iframe of the actual overlay on the right over a transparent checkerboard, so you see exactly what OBS sees — edits push instantly over WebSocket, no refresh
- Alerts fire from a dashboard button (with saved presets) or `POST /hook/:token` — wire it to Streamer.bot, Zapier, or a Twitch EventSub relay, whatever you've already got
- 5 built-in themes (neon, minimal, retro, brutalist, glass) with font/color/scale overrides per overlay
- One-screen Live Control panel for the whole stream session: fire alerts, bump goals, start/pause timers

**Two ways to run it:** double-click it as a desktop app (Electron) and point OBS at `localhost`, or `docker compose up` on a $5 VPS if you stream from somewhere your desktop can't reach OBS.

Source is MIT on GitHub. The paid version is the 1-click installer for streamers who'd rather not touch a terminal — pay once, own it forever.

## Maker first comment

Hey PH 👋

I got tired of renting my own overlays — and of cloud overlay services occasionally lagging or dropping mid-stream because some CDN somewhere had a bad day. So I built the whole overlay layer self-hosted: countdown, goal bar, ticker, starting-soon scene, and alert box, each just a URL your OBS Browser Source hits directly against your own server.

The part I'm proudest of: timers are fully server-authoritative. OBS's embedded browser reloads sources way more than people expect (scene switches, GPU hiccups, plugin updates), and if the timer state lives in the page's JS, every reload resets your countdown. Here the server tracks `started_at`/`ends_at`, so a reconnecting source always resyncs to the correct remaining time — you could kill your PC mid-countdown and the timer picks up exactly where it should.

MIT on GitHub if you want to self-host for free. The $24 version is the packaged installer for people who'd rather click "install" than run `docker compose up` — that's the whole business model, no tiers, no add-ons.

Honest limitations: no built-in Twitch/YouTube chat listener yet (alerts fire via webhook or the dashboard button — wire it to Streamer.bot or a EventSub relay for automatic chat-triggered alerts), and there's no cloud sync between multiple PCs. Happy to answer anything!

## Gallery shots (5)

1. **Hero:** OBS scene collection mockup with a neon countdown timer, a goal bar, and an alert box composited over gameplay footage, headline "Your overlays, your server. $24 once."
2. **Editor split view:** config form on the left (countdown fields, theme picker), live iframe preview on the right over the transparent checkerboard.
3. **Themes grid:** the same goal bar rendered in all 5 themes (neon, minimal, retro, brutalist, glass) side by side.
4. **Live Control panel:** the touch-friendly grid of buttons — Start/Pause/Reset, +1/+5/+10, preset alert-fire buttons — mid-stream.
5. **Comparison card:** "3 years of Streamlabs Ultra: $537–$1,788 ($149/yr–$19/mo). Overlayr: $24." pulled from the README table.
