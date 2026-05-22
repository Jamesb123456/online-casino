/**
 * sound.js — Howler-based casino SFX registry.
 *
 * Lazy: Howl instances are created the first time a sound is played.
 * Defensive: missing audio files emit a single warning per key and noop.
 *
 * Public API:
 *   registerSounds({ name: 'path/or/[paths]' })  add or merge sources
 *   playSound(name, { volume } = {})              fire-and-forget playback
 *   stopSound(name)                                stop any currently playing instances
 *   setGlobalMute(boolean)                         toggle Howler global mute
 *   isGlobalMuted()                                read current mute
 *   getHowl(name)                                  lazy-create + return Howl
 *
 * The SoundProvider React layer is the canonical consumer of this module — it
 * persists mute state to localStorage and calls registerSounds() on mount.
 */
import { Howl, Howler } from 'howler';

const _sources = new Map(); // name -> string | string[]
const _howls = new Map();   // name -> Howl
const _failed = new Set();
const _warned = new Set();

function _warnOnce(name, err) {
  if (_warned.has(name)) return;
  _warned.add(name);
  _failed.add(name);
  const msg = err && err.message ? err.message : String(err || 'unknown');
  console.warn(`[sound] failed '${name}': ${msg}`);
}

function _toArray(src) {
  if (!src) return [];
  return Array.isArray(src) ? src : [src];
}

/**
 * Register or merge a batch of sound sources. Safe to call multiple times.
 */
export function registerSounds(map) {
  if (!map || typeof map !== 'object') return;
  for (const [name, src] of Object.entries(map)) {
    if (!name || !src) continue;
    _sources.set(name, src);
    // Invalidate any previously failed marker so a later registration retries.
    _failed.delete(name);
    _warned.delete(name);
  }
}

/**
 * Get the cached Howl for a name, lazily creating it if needed. Returns null
 * if Howler is unavailable, the name is unregistered, or the asset has failed.
 */
export function getHowl(name) {
  if (!name) return null;
  if (_failed.has(name)) return null;
  if (_howls.has(name)) return _howls.get(name);
  const src = _sources.get(name);
  if (!src) return null;
  try {
    const howl = new Howl({
      src: _toArray(src),
      preload: true,
      html5: false,
      onloaderror: (_id, err) => _warnOnce(name, err),
      onplayerror: (_id, err) => {
        // Autoplay-policy errors typically clear after first user gesture.
        _warnOnce(name, err);
      },
    });
    _howls.set(name, howl);
    return howl;
  } catch (err) {
    _warnOnce(name, err);
    return null;
  }
}

/**
 * Play a registered sound. No-op if globally muted, unregistered, or asset failed.
 */
export function playSound(name, { volume } = {}) {
  if (!name) return;
  try {
    if (Howler && Howler._muted) return;
  } catch {
    /* ignore */
  }
  const howl = getHowl(name);
  if (!howl) return;
  try {
    const id = howl.play();
    if (typeof volume === 'number' && Number.isFinite(volume)) {
      howl.volume(Math.max(0, Math.min(1, volume)), id);
    }
  } catch (err) {
    _warnOnce(name, err);
  }
}

export function stopSound(name) {
  const howl = _howls.get(name);
  if (!howl) return;
  try {
    howl.stop();
  } catch {
    /* ignore */
  }
}

export function setGlobalMute(value) {
  try {
    Howler.mute(!!value);
  } catch {
    /* ignore */
  }
}

export function isGlobalMuted() {
  try {
    return !!Howler._muted;
  } catch {
    return false;
  }
}

/**
 * Test-only reset for unit tests. Underscored to signal non-public usage.
 */
export function __resetForTests() {
  _sources.clear();
  _howls.clear();
  _failed.clear();
  _warned.clear();
}
