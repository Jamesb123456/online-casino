import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  SFX,
  play as libPlay,
  stop as libStop,
  setMuted as libSetMuted,
  setVolume as libSetVolume,
  isMuted as libIsMuted,
  getVolume as libGetVolume,
  startAmbient as libStartAmbient,
  stopAmbient as libStopAmbient,
} from '../lib/audio';

const AudioContext = createContext(null);

/**
 * AudioProvider — exposes the singleton audio lib as React state.
 *
 * NOTE: The `value` object is wrapped in useMemo to avoid the Toast-style
 * gotcha where a new context object every render makes all consumers re-render
 * (and any consumer using destructuring inside an effect loops forever).
 */
export function AudioProvider({ children }) {
  // Initialise from localStorage via the lib (handles SSR / privacy mode safely).
  const [muted, setMutedState] = useState(() => libIsMuted());
  const [volume, setVolumeState] = useState(() => libGetVolume());

  const setMuted = useCallback((value) => {
    const next = !!value;
    libSetMuted(next);
    setMutedState(next);
  }, []);

  const setVolume = useCallback((value) => {
    const num = Number(value);
    const clamped = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0;
    libSetVolume(clamped);
    setVolumeState(clamped);
  }, []);

  const play = useCallback((name) => {
    libPlay(name);
  }, []);

  const stop = useCallback((name) => {
    libStop(name);
  }, []);

  const startAmbient = useCallback(() => {
    libStartAmbient();
  }, []);

  const stopAmbient = useCallback(() => {
    libStopAmbient();
  }, []);

  // Sync the lib state if some external code (e.g. another tab) changes
  // localStorage. Not load-bearing — purely defensive.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (e) => {
      if (e.key === 'audio.muted') setMutedState(libIsMuted());
      if (e.key === 'audio.volume') setVolumeState(libGetVolume());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(
    () => ({
      muted,
      volume,
      setMuted,
      setVolume,
      play,
      stop,
      startAmbient,
      stopAmbient,
      SFX,
    }),
    [muted, volume, setMuted, setVolume, play, stop, startAmbient, stopAmbient],
  );

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

export { AudioContext };

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    // Don't throw — audio is non-essential. Return a no-op shim so games
    // continue to function even if mounted outside the provider (e.g. in
    // an isolated test that forgot to wrap).
    return {
      muted: true,
      volume: 0,
      setMuted: () => {},
      setVolume: () => {},
      play: () => {},
      stop: () => {},
      startAmbient: () => {},
      stopAmbient: () => {},
      SFX,
    };
  }
  return ctx;
}

export default AudioContext;
