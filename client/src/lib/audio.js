/**
 * Thin audio wrapper for SFX + ambient lobby track.
 *
 * Pure singleton module — no React, no dependencies. Plays HTMLAudio elements
 * served from /audio/<name>.mp3 (under client/public/audio/).
 *
 * Design notes:
 * - Per-event Audio nodes are created lazily on first play().
 * - play() clones the audio node so overlapping plays don't cut each other off.
 * - Ambient is a single looping Audio instance at a reduced volume.
 * - Failures (missing assets, autoplay rejection) are caught and logged once
 *   per offending key so game UI keeps working with no audio assets present.
 * - Mute + volume persist to localStorage under `audio.muted` / `audio.volume`.
 */

export const SFX = {
  BET: 'bet',
  WIN: 'win',
  LOSS: 'loss',
  TICK: 'tick',
  DRUMROLL: 'drumroll',
  BIG_WIN: 'big_win',
  AMBIENT: 'ambient',
};

const STORAGE_KEYS = {
  MUTED: 'audio.muted',
  VOLUME: 'audio.volume',
};

const DEFAULT_VOLUME = 0.5;
const AMBIENT_VOLUME_FACTOR = 0.4;

// In-memory state — initialised from localStorage on first access.
let _muted = null;
let _volume = null;

// Lazily-created base Audio nodes (one per SFX key, used as the "template" for clones).
const _baseNodes = new Map();
// Single ambient Audio instance (looping).
let _ambientNode = null;
let _ambientPlaying = false;

// Keys that have already 404'd or otherwise failed — never try to load again.
const _failedKeys = new Set();
// Keys that have already emitted a warning — keep noise to one per file.
const _warnedKeys = new Set();

function _readMuted() {
  if (_muted !== null) return _muted;
  try {
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.MUTED)
      : null;
    _muted = stored === 'true';
  } catch {
    _muted = false;
  }
  return _muted;
}

function _readVolume() {
  if (_volume !== null) return _volume;
  try {
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEYS.VOLUME)
      : null;
    const parsed = stored != null ? Number.parseFloat(stored) : NaN;
    _volume = Number.isFinite(parsed) ? _clamp01(parsed) : DEFAULT_VOLUME;
  } catch {
    _volume = DEFAULT_VOLUME;
  }
  return _volume;
}

function _clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function _srcFor(name) {
  return `/audio/${name}.mp3`;
}

function _warnOnce(name, err) {
  if (_warnedKeys.has(name)) return;
  _warnedKeys.add(name);
  _failedKeys.add(name);
  console.warn(`[audio] failed to play '${name}':`, err && err.message ? err.message : err);
}

function _getOrCreateBase(name) {
  if (_failedKeys.has(name)) return null;
  let node = _baseNodes.get(name);
  if (!node) {
    try {
      if (typeof Audio === 'undefined') return null;
      node = new Audio(_srcFor(name));
      // Hint the browser these are short SFX (ignored for ambient — we set it lower).
      node.preload = 'auto';
      // Surface load errors so we can blacklist the key.
      node.addEventListener('error', () => _warnOnce(name, new Error('asset load error')), { once: true });
      _baseNodes.set(name, node);
    } catch (err) {
      _warnOnce(name, err);
      return null;
    }
  }
  return node;
}

/**
 * Lazily create Audio objects for every SFX. Safe to call multiple times.
 * Useful to warm the cache after a user interaction (which unlocks autoplay).
 */
export function preload() {
  for (const name of Object.values(SFX)) {
    _getOrCreateBase(name);
  }
}

/**
 * Play a one-shot SFX. No-op if muted or volume=0.
 *
 * Note: ambient must be started via startAmbient() for looping; play(AMBIENT)
 * is supported as a one-shot but won't loop.
 */
export function play(name) {
  if (!name) return;
  if (_readMuted()) return;
  const vol = _readVolume();
  if (vol <= 0) return;
  if (_failedKeys.has(name)) return;

  const base = _getOrCreateBase(name);
  if (!base) return;

  try {
    // Cloning lets overlapping plays coexist (e.g. rapid TICKs).
    const node = typeof base.cloneNode === 'function' ? base.cloneNode() : base;
    node.volume = vol;
    const result = node.play && node.play();
    if (result && typeof result.catch === 'function') {
      result.catch((err) => _warnOnce(name, err));
    }
  } catch (err) {
    _warnOnce(name, err);
  }
}

/**
 * Stop a playing sound. Mainly used for ambient; for cloned one-shots there is
 * nothing to stop because clones are fire-and-forget.
 */
export function stop(name) {
  if (name === SFX.AMBIENT) {
    stopAmbient();
    return;
  }
  const node = _baseNodes.get(name);
  if (!node) return;
  try {
    if (typeof node.pause === 'function') node.pause();
    if ('currentTime' in node) node.currentTime = 0;
  } catch {
    /* ignore */
  }
}

export function setMuted(value) {
  const next = !!value;
  _muted = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.MUTED, next ? 'true' : 'false');
    }
  } catch { /* ignore quota / privacy mode */ }
  // Reflect on ambient immediately.
  if (next) {
    stopAmbient();
  } else if (_ambientPlaying) {
    // Was previously requested but stopped on mute — restart.
    startAmbient();
  } else if (_ambientNode) {
    // Update volume if user toggles while ambient is paused.
    try { _ambientNode.volume = _readVolume() * AMBIENT_VOLUME_FACTOR; } catch { /* ignore */ }
  }
}

export function isMuted() {
  return _readMuted();
}

export function setVolume(value) {
  const next = _clamp01(Number(value));
  _volume = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.VOLUME, String(next));
    }
  } catch { /* ignore quota / privacy mode */ }
  // Apply to the active ambient node if any.
  if (_ambientNode) {
    try { _ambientNode.volume = next * AMBIENT_VOLUME_FACTOR; } catch { /* ignore */ }
  }
}

export function getVolume() {
  return _readVolume();
}

/**
 * Start the looping ambient track. No-op if muted or asset is missing.
 * Multiple calls are idempotent — the same node is reused.
 */
export function startAmbient() {
  _ambientPlaying = true;
  if (_readMuted()) return;
  if (_failedKeys.has(SFX.AMBIENT)) return;
  const vol = _readVolume();
  if (vol <= 0) return;

  if (!_ambientNode) {
    try {
      if (typeof Audio === 'undefined') return;
      _ambientNode = new Audio(_srcFor(SFX.AMBIENT));
      _ambientNode.loop = true;
      _ambientNode.preload = 'auto';
      _ambientNode.addEventListener('error', () => _warnOnce(SFX.AMBIENT, new Error('asset load error')), { once: true });
    } catch (err) {
      _warnOnce(SFX.AMBIENT, err);
      return;
    }
  }

  try {
    _ambientNode.volume = vol * AMBIENT_VOLUME_FACTOR;
    const result = _ambientNode.play && _ambientNode.play();
    if (result && typeof result.catch === 'function') {
      result.catch((err) => _warnOnce(SFX.AMBIENT, err));
    }
  } catch (err) {
    _warnOnce(SFX.AMBIENT, err);
  }
}

export function stopAmbient() {
  _ambientPlaying = false;
  if (!_ambientNode) return;
  try {
    if (typeof _ambientNode.pause === 'function') _ambientNode.pause();
    if ('currentTime' in _ambientNode) _ambientNode.currentTime = 0;
  } catch {
    /* ignore */
  }
}

/**
 * Test-only reset. Not exported in the public surface (intentionally underscored).
 * Used by unit tests to clear singleton state between cases.
 */
export function __resetForTests() {
  _muted = null;
  _volume = null;
  _baseNodes.clear();
  _ambientNode = null;
  _ambientPlaying = false;
  _failedKeys.clear();
  _warnedKeys.clear();
}
