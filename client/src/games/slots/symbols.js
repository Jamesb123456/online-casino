import * as PIXI from 'pixi.js';

/**
 * Slots symbol library — SVG-rendered Pixi textures.
 *
 * Symbols are small, hand-tuned SVG markup encoded as data URIs and converted
 * to Pixi textures via `Texture.from(svgDataUri)`. No external assets, no
 * network requests, and the textures render crisply at any DPI because SVG
 * is rasterized once at the target size.
 *
 * Public API:
 *   SYMBOL_KEYS                 — ordered list of canonical symbol keys
 *   SYMBOL_META[key]            — { label, color } metadata for UI / a11y
 *   getSymbolTexture(key)       — returns a (cached) PIXI.Texture for the key
 *   normalizeSymbolKey(serverKey)
 *                               — maps server symbol strings (e.g. CHERRY,
 *                                 SEVEN, A/B/C, BAR, BELL) to our 7-icon
 *                                 visual set. Unknown keys fall back to 'bar'.
 *   destroySymbolTextures()     — disposes the cached textures (called on
 *                                 unmount of the last consumer if needed).
 */

const SVG_SIZE = 128;

const SYMBOL_SVGS = {
  gem: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#A78BFA"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <polygon points="64,18 104,46 88,104 40,104 24,46" fill="url(#g)" stroke="#F5F3FF" stroke-width="3" stroke-linejoin="round"/>
      <polygon points="64,18 88,46 64,62 40,46" fill="#C4B5FD" opacity="0.7"/>
      <polyline points="40,46 64,62 88,46" fill="none" stroke="#F5F3FF" stroke-width="2" opacity="0.8"/>
    </svg>
  `,
  seven: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FBBF24"/>
          <stop offset="100%" stop-color="#B45309"/>
        </linearGradient>
      </defs>
      <text x="64" y="92" text-anchor="middle" font-family="Space Grotesk, system-ui, sans-serif" font-size="86" font-weight="900" fill="url(#s)" stroke="#1F1300" stroke-width="3" paint-order="stroke">7</text>
    </svg>
  `,
  bell: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FDE68A"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
      </defs>
      <path d="M64 24 C44 24 36 40 36 60 L36 84 L32 92 L96 92 L92 84 L92 60 C92 40 84 24 64 24 Z" fill="url(#b)" stroke="#7C2D12" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="64" cy="100" r="8" fill="#92400E" stroke="#451A03" stroke-width="2"/>
      <rect x="60" y="16" width="8" height="10" rx="2" fill="#92400E"/>
    </svg>
  `,
  cherry: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <path d="M40 26 C60 26 72 46 72 70" fill="none" stroke="#16A34A" stroke-width="4" stroke-linecap="round"/>
      <path d="M40 26 C60 26 88 38 96 60" fill="none" stroke="#16A34A" stroke-width="4" stroke-linecap="round"/>
      <circle cx="42" cy="88" r="22" fill="#DC2626" stroke="#7F1D1D" stroke-width="3"/>
      <circle cx="86" cy="80" r="22" fill="#EF4444" stroke="#7F1D1D" stroke-width="3"/>
      <ellipse cx="36" cy="80" rx="6" ry="3" fill="#FCA5A5" opacity="0.8"/>
      <ellipse cx="80" cy="72" rx="6" ry="3" fill="#FCA5A5" opacity="0.8"/>
    </svg>
  `,
  bar: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#F9FAFB"/>
          <stop offset="100%" stop-color="#9CA3AF"/>
        </linearGradient>
      </defs>
      <rect x="20" y="46" width="88" height="36" rx="4" fill="url(#bar)" stroke="#1F2937" stroke-width="3"/>
      <text x="64" y="74" text-anchor="middle" font-family="Space Grotesk, system-ui, sans-serif" font-size="26" font-weight="900" fill="#111827" letter-spacing="2">BAR</text>
    </svg>
  `,
  wild: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="w" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#F472B6"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
      <rect x="14" y="14" width="100" height="100" rx="14" fill="url(#w)" stroke="#F5F3FF" stroke-width="3"/>
      <text x="64" y="86" text-anchor="middle" font-family="Space Grotesk, system-ui, sans-serif" font-size="44" font-weight="900" fill="#F5F3FF" stroke="#3B0764" stroke-width="2" paint-order="stroke">W</text>
    </svg>
  `,
  scatter: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <radialGradient id="sc" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="#FEF3C7"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </radialGradient>
      </defs>
      <polygon points="64,12 76,52 116,52 84,76 96,116 64,92 32,116 44,76 12,52 52,52" fill="url(#sc)" stroke="#7C2D12" stroke-width="3" stroke-linejoin="round"/>
    </svg>
  `,
};

export const SYMBOL_KEYS = Object.keys(SYMBOL_SVGS);

export const SYMBOL_META = {
  gem: { label: 'Gem', color: 0x7c3aed },
  seven: { label: 'Lucky Seven', color: 0xfbbf24 },
  bell: { label: 'Bell', color: 0xd97706 },
  cherry: { label: 'Cherry', color: 0xdc2626 },
  bar: { label: 'Bar', color: 0xe5e7eb },
  wild: { label: 'Wild', color: 0xa855f7 },
  scatter: { label: 'Scatter', color: 0xf59e0b },
};

const textureCache = new Map();

function svgToDataUri(svg) {
  // Strip leading/trailing whitespace from the template literal and inline
  // the SVG as a data URI. Pixi's Texture.from understands `data:image/svg+xml`.
  const trimmed = svg.trim().replace(/\s+/g, ' ');
  return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
}

export function getSymbolTexture(key) {
  const norm = SYMBOL_SVGS[key] ? key : 'bar';
  if (textureCache.has(norm)) return textureCache.get(norm);
  let texture;
  try {
    const uri = svgToDataUri(SYMBOL_SVGS[norm]);
    texture = PIXI.Texture.from(uri, { resourceOptions: { width: SVG_SIZE, height: SVG_SIZE } });
  } catch {
    // Fallback to an empty texture so the scene graph still renders.
    texture = PIXI.Texture.EMPTY;
  }
  textureCache.set(norm, texture);
  return texture;
}

/**
 * Map a server-side symbol string to our visual symbol set. The legacy slots
 * server uses fruit codes (CHERRY, LEMON, ORANGE, PLUM) + BAR/BELL/SEVEN +
 * placeholder letters (A/B/C). We collapse to the 7 visual icons.
 */
const NORMALIZE_MAP = {
  CHERRY: 'cherry',
  LEMON: 'bar',
  ORANGE: 'bell',
  PLUM: 'gem',
  BELL: 'bell',
  BAR: 'bar',
  SEVEN: 'seven',
  WILD: 'wild',
  SCATTER: 'scatter',
  A: 'gem',
  B: 'seven',
  C: 'wild',
};

export function normalizeSymbolKey(serverKey) {
  if (!serverKey) return 'bar';
  const upper = String(serverKey).toUpperCase();
  if (NORMALIZE_MAP[upper]) return NORMALIZE_MAP[upper];
  const lower = String(serverKey).toLowerCase();
  if (SYMBOL_SVGS[lower]) return lower;
  return 'bar';
}

export function destroySymbolTextures() {
  textureCache.forEach((tex) => {
    try {
      tex.destroy(true);
    } catch {
      /* ignore */
    }
  });
  textureCache.clear();
}
