// Theme = a CSS-variable set applied to overlay pages. Per-overlay theme_json can
// override any of these (font, colors, scale) on top of the chosen base theme.
// Fonts are system-stack based (no network fetch needed by OBS); drop real
// self-hosted woff2 files into client/public/fonts/ and reference them here if
// you want fully custom branding — see README "Fonts" section.

const THEMES = {
  neon: {
    label: 'Neon',
    vars: {
      '--ov-bg': 'transparent',
      '--ov-fg': '#f5f5ff',
      '--ov-accent': '#ff2fd0',
      '--ov-accent-2': '#2fe6ff',
      '--ov-panel': 'rgba(15, 6, 30, 0.55)',
      '--ov-border': 'rgba(255, 47, 208, 0.65)',
      '--ov-radius': '14px',
      '--ov-shadow': '0 0 24px rgba(255, 47, 208, 0.55), 0 0 48px rgba(47, 230, 255, 0.25)',
      '--ov-font': "'Segoe UI', system-ui, sans-serif"
    }
  },
  minimal: {
    label: 'Minimal',
    vars: {
      '--ov-bg': 'transparent',
      '--ov-fg': '#111111',
      '--ov-accent': '#111111',
      '--ov-accent-2': '#666666',
      '--ov-panel': 'rgba(255, 255, 255, 0.92)',
      '--ov-border': 'rgba(0, 0, 0, 0.08)',
      '--ov-radius': '10px',
      '--ov-shadow': '0 2px 12px rgba(0, 0, 0, 0.12)',
      '--ov-font': "'Segoe UI', system-ui, sans-serif"
    }
  },
  retro: {
    label: 'Retro',
    vars: {
      '--ov-bg': 'transparent',
      '--ov-fg': '#fdf3d8',
      '--ov-accent': '#ff8c2b',
      '--ov-accent-2': '#ffd23f',
      '--ov-panel': 'rgba(43, 24, 16, 0.75)',
      '--ov-border': '#ff8c2b',
      '--ov-radius': '0px',
      '--ov-shadow': '6px 6px 0 rgba(0,0,0,0.4)',
      '--ov-font': "'Courier New', ui-monospace, monospace"
    }
  },
  brutalist: {
    label: 'Brutalist',
    vars: {
      '--ov-bg': 'transparent',
      '--ov-fg': '#000000',
      '--ov-accent': '#000000',
      '--ov-accent-2': '#ffe600',
      '--ov-panel': '#ffffff',
      '--ov-border': '#000000',
      '--ov-radius': '0px',
      '--ov-shadow': '8px 8px 0 #000000',
      '--ov-font': "'Arial Black', Arial, sans-serif"
    }
  },
  glass: {
    label: 'Glass',
    vars: {
      '--ov-bg': 'transparent',
      '--ov-fg': '#ffffff',
      '--ov-accent': '#8ecdf5',
      '--ov-accent-2': '#c7a8ff',
      '--ov-panel': 'rgba(255, 255, 255, 0.14)',
      '--ov-border': 'rgba(255, 255, 255, 0.35)',
      '--ov-radius': '18px',
      '--ov-shadow': '0 8px 32px rgba(0, 0, 0, 0.25)',
      '--ov-font': "'Segoe UI', system-ui, sans-serif"
    }
  }
};

const FONTS = {
  system: "'Segoe UI', system-ui, sans-serif",
  mono: "ui-monospace, 'Courier New', monospace",
  serif: "Georgia, 'Times New Roman', serif",
  impact: "Impact, 'Arial Black', sans-serif",
  rounded: "'Segoe UI Rounded', 'Comic Sans MS', sans-serif"
};

function themeCssVars(themeConfig = {}) {
  const base = THEMES[themeConfig.theme] || THEMES.neon;
  const vars = { ...base.vars };
  if (themeConfig.font && FONTS[themeConfig.font]) vars['--ov-font'] = FONTS[themeConfig.font];
  if (themeConfig.accent) vars['--ov-accent'] = themeConfig.accent;
  if (themeConfig.accent2) vars['--ov-accent-2'] = themeConfig.accent2;
  if (themeConfig.scale) vars['--ov-scale'] = String(themeConfig.scale);
  else vars['--ov-scale'] = '1';
  return vars;
}

function cssVarString(vars) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}

module.exports = { THEMES, FONTS, themeCssVars, cssVarString };
