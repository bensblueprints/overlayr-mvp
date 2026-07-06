// WebSocket hub for overlay pages. Each connected OBS Browser Source hits
// `/ws?token=<overlay token>`; we key connections by overlay id so config/alert
// pushes only fan out to that overlay's viewers. A 30s ping/pong heartbeat keeps
// the socket alive through OBS's embedded Chromium; dead sockets are terminated.
class WsHub {
  constructor() {
    this.byOverlay = new Map(); // overlayId -> Set<ws>
    this.heartbeat = setInterval(() => this.pingAll(), 30000);
    if (this.heartbeat.unref) this.heartbeat.unref();
  }

  add(overlayId, ws) {
    if (!this.byOverlay.has(overlayId)) this.byOverlay.set(overlayId, new Set());
    this.byOverlay.get(overlayId).add(ws);
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('close', () => {
      const set = this.byOverlay.get(overlayId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) this.byOverlay.delete(overlayId);
      }
    });
    ws.on('error', () => {});
  }

  send(ws, obj) {
    if (ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(obj));
      } catch {
        /* ignore */
      }
    }
  }

  broadcast(overlayId, obj) {
    const set = this.byOverlay.get(overlayId);
    if (!set) return 0;
    for (const ws of set) this.send(ws, obj);
    return set.size;
  }

  pingAll() {
    for (const set of this.byOverlay.values()) {
      for (const ws of set) {
        if (ws.isAlive === false) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch {
          /* ignore */
        }
      }
    }
  }

  stop() {
    clearInterval(this.heartbeat);
  }
}

module.exports = { WsHub };
