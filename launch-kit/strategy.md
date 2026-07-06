# Launch Strategy — Overlayr

## Positioning
"Your overlays, your server, no watermarks, no subscription." Target: Twitch/YouTube streamers (especially smaller/indie streamers who feel StreamElements/Streamlabs premium tiers nickel-and-dime them) who already run OBS and are comfortable dropping in a Browser Source URL. Price anchors: StreamElements (free-core but pushes SE.Pay/premium themes), Streamlabs Ultra **$19/mo or $149/yr**, OWN3D Pro **$12.99/mo**.

## Target communities (rules-aware angles)

| Community | Angle |
|---|---|
| r/Twitch | Show a 30s clip of the countdown surviving a scene-switch reload + the goal bar milestone flash. No link spam — post in self-promo/weekly threads per sub rules, lead with the reliability story not the price. |
| r/streaming | Broader OBS/production audience — post as a "built this because X" project share, mention MIT source first. |
| r/obs | Frame as an OBS Browser Source resource, not an ad — obs subreddit is protective of self-promo, so lead with the technical detail (server-authoritative timers, transparent background, reconnect logic) and link the GitHub repo, not a sales page. |
| OBS Studio forums (resources section) | Post as a free/open-source resource in the resources/plugins area — most forums there require it be genuinely free-to-self-host, which it is (MIT). Mention the paid installer only as an optional convenience. |
| r/Twitch Discord / streamer Discords | Share the 30s demo clip in self-promo channels, same rules-aware framing. |
| Indie Hackers / r/EntrepreneurRideAlong | Build-in-public angle: "$24 one-time vs $149/yr SaaS — here's the reliability bug (timer resets on reconnect) that actually motivated building this." |

## Hacker News — Show HN draft

**Title:** Show HN: Self-hosted OBS overlays over WebSocket (no subscription)

**Body:**
I got tired of renting my own overlays — and of cloud overlay services occasionally lagging or dropping frames mid-stream — so I built a self-hosted replacement.

It's a single Node process: Express + a raw `ws` WebSocket server serve 5 overlay types (countdown, goal bar, ticker, starting-soon scene, alert box) as tokenized `/o/:token` pages that OBS loads as Browser Sources. The token itself is the auth, since OBS can't do logins. The part I spent the most time on: timers are server-authoritative — the server tracks `started_at`/`ends_at` (or `remaining_ms` while paused) in SQLite, and a reconnecting Browser Source (which happens *a lot* — scene switches, GPU driver hiccups) always resyncs to the correct time instead of resetting. Alerts fire from a dashboard button or a `POST /hook/:token` webhook, so it slots into whatever automation streamers already have (Streamer.bot, Zapier, a EventSub relay).

MIT source. I sell a packaged installer ($24 one-time) for streamers who'd rather not run `docker compose up` themselves.

## SEO keywords (10)
1. obs browser source overlay
2. streamelements alternative
3. self hosted stream overlays
4. obs countdown timer overlay
5. stream goal bar widget
6. streamlabs alternative free
7. starting soon screen obs
8. obs alert box custom
9. stream overlay maker
10. twitch overlay without subscription

## AppSumo / PitchGround pitch

Overlayr is the "pay once, own forever" answer to the StreamElements/Streamlabs overlay treadmill — a self-hosted overlay suite your buyers install in one click (desktop app) or one `docker compose up` (any $5 VPS). It ships 5 overlay types (countdown, goal bar, ticker, starting-soon scene, alert box), each a tokenized OBS Browser Source URL that updates live over WebSocket — no cloud dependency, no lag, no watermark. Timers are server-authoritative so OBS's constant Browser Source reloads never desync a countdown. Alerts fire from a touch-friendly Live Control dashboard or a webhook endpoint that plugs into Streamer.bot/Zapier. Source is MIT (auditable by your community), the deal is a lifetime license with updates. LTV math for your audience: Streamlabs Ultra is $149/year; this pays for itself in about 5 weeks and there's nothing left to churn from.

## Pricing

**$24 one-time** (installer + lifetime updates).
- vs Streamlabs Ultra $19/mo ($149/yr) → pays for itself in **~5 weeks**
- vs OWN3D Pro $12.99/mo → pays for itself in **~7.5 weeks**
- 3-year saving vs Streamlabs Ultra: **$423**

Optional later: $39 "Pro pack" tier (extra theme pack + priority support) once reviews exist. Keep the $24 anchor at launch.
