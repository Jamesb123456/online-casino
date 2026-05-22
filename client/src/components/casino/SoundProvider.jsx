import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Howler } from 'howler';
import {
  registerSounds,
  playSound,
  setGlobalMute,
} from '../../services/sound';

const STORAGE_KEY = 'pc:muted';

/**
 * Default registry — keys map to filenames in /audio/. All entries are optional
 * (the service tolerates missing files), so the casino runs fine without any
 * assets installed yet.
 */
const DEFAULT_SOUNDS = {
  bet: '/audio/bet.mp3',
  cashout: '/audio/cashout.mp3',
  'win-small': '/audio/win-small.mp3',
  'win-big': '/audio/win-big.mp3',
  'win-jackpot': '/audio/win-jackpot.mp3',
  lose: '/audio/lose.mp3',
  'spin-tick': '/audio/spin-tick.mp3',
  'card-flip': '/audio/card-flip.mp3',
  'chip-drop': '/audio/chip-drop.mp3',
  'crash-bust': '/audio/crash-bust.mp3',
  'pin-hit': '/audio/pin-hit.mp3',
  'gem-reveal': '/audio/gem-reveal.mp3',
  'mine-boom': '/audio/mine-boom.mp3',
};

const SoundContext = createContext(null);

function readStoredMute() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredMute(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function SoundProvider({ children, sounds }) {
  const [muted, setMutedState] = useState(() => readStoredMute());
  const unlockedRef = useRef(false);

  // Register sounds once (and any time the caller-supplied map changes).
  useEffect(() => {
    registerSounds({ ...DEFAULT_SOUNDS, ...(sounds || {}) });
  }, [sounds]);

  // Sync Howler global mute with React state.
  useEffect(() => {
    setGlobalMute(muted);
  }, [muted]);

  // First-interaction unlock for browser autoplay policy. We attach a one-shot
  // pointerdown listener that resumes the Howler audio context. After it runs,
  // we remove the listener and never re-attach.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      try {
        const ctx = Howler.ctx;
        if (ctx && typeof ctx.resume === 'function' && ctx.state !== 'running') {
          ctx.resume().catch(() => {});
        }
      } catch {
        /* ignore */
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const setMute = useCallback((value) => {
    const next = !!value;
    setMutedState(next);
    writeStoredMute(next);
  }, []);

  const play = useCallback((name, opts) => {
    if (!name) return;
    try {
      playSound(name, opts);
    } catch {
      /* swallow — sound failures should never crash UI */
    }
  }, []);

  const value = useMemo(
    () => ({ play, mute: muted, muted, setMute }),
    [play, muted, setMute],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (ctx) return ctx;
  // Fallback for components rendered outside the provider (e.g. unit tests).
  // Keeps the API safe to call but is a no-op.
  return {
    play: () => {},
    mute: false,
    muted: false,
    setMute: () => {},
  };
}

export default SoundProvider;
