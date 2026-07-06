async function req(method, url, body) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  if (r.status === 401) throw Object.assign(new Error('Unauthorized'), { unauthorized: true });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export const api = {
  me: () => req('GET', '/api/me'),
  login: (password) => req('POST', '/api/login', { password }),
  logout: () => req('POST', '/api/logout'),
  meta: () => req('GET', '/api/meta'),
  getSettings: () => req('GET', '/api/settings'),
  saveSettings: (s) => req('PUT', '/api/settings', s),

  overlays: () => req('GET', '/api/overlays'),
  overlay: (id) => req('GET', `/api/overlays/${id}`),
  createOverlay: (o) => req('POST', '/api/overlays', o),
  updateOverlay: (id, o) => req('PUT', `/api/overlays/${id}`, o),
  deleteOverlay: (id) => req('DELETE', `/api/overlays/${id}`),
  duplicateOverlay: (id) => req('POST', `/api/overlays/${id}/duplicate`),
  regenerateToken: (id) => req('POST', `/api/overlays/${id}/regenerate-token`),
  control: (id, action, params = {}) => req('POST', `/api/overlays/${id}/control`, { action, ...params }),

  assets: () => req('GET', '/api/assets'),
  deleteAsset: (id) => req('DELETE', `/api/assets/${id}`),
  upload: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/assets', { method: 'POST', body: fd, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Upload failed');
    return j; // { url, filename, mime, size }
  }
};

export const OVERLAY_TYPES = [
  { value: 'countdown', label: 'Countdown timer', icon: 'Timer' },
  { value: 'goal', label: 'Goal bar', icon: 'Target' },
  { value: 'ticker', label: 'Rotating messages', icon: 'MessageSquareText' },
  { value: 'starting_soon', label: 'Starting soon scene', icon: 'Tv' },
  { value: 'alertbox', label: 'Alert box', icon: 'PartyPopper' }
];

export function overlayDefaultConfig(type) {
  switch (type) {
    case 'countdown':
      return { mode: 'duration', duration_ms: 10 * 60 * 1000, target_at: '', end_message: "We're live!", format: 'hms' };
    case 'goal':
      return { label: 'Sub Goal', current: 0, target: 100 };
    case 'ticker':
      return { messages: ['Welcome to the stream!', 'Follow for more!'], interval_s: 6, transition: 'fade', marquee: false };
    case 'starting_soon':
      return {
        headline: 'Starting Soon',
        subtext: 'Grab a drink, we\'re about to go live.',
        show_countdown: true,
        mode: 'duration',
        duration_ms: 5 * 60 * 1000,
        target_at: '',
        format: 'hms',
        end_message: "We're live!",
        bg_image: '',
        bg_audio: ''
      };
    case 'alertbox':
      return { presets: [{ name: 'New Follower', message: 'just followed!' }], min_display_ms: 4000 };
    default:
      return {};
  }
}
