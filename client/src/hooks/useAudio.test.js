import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAudio, SFX } from './useAudio';
import { AudioProvider } from '../contexts/AudioContext';

describe('useAudio hook', () => {
  it('returns a non-null shim when used outside of AudioProvider', () => {
    // AudioContext intentionally returns a no-op shim when no provider is present.
    const { result } = renderHook(() => useAudio());

    expect(result.current).toBeDefined();
    expect(typeof result.current.play).toBe('function');
    expect(typeof result.current.stop).toBe('function');
    expect(typeof result.current.setMuted).toBe('function');
    expect(typeof result.current.setVolume).toBe('function');
    expect(typeof result.current.startAmbient).toBe('function');
    expect(typeof result.current.stopAmbient).toBe('function');
    expect(result.current.SFX).toBeDefined();
  });

  it('returns the provider value when wrapped in AudioProvider', () => {
    const wrapper = ({ children }) =>
      React.createElement(AudioProvider, null, children);

    const { result } = renderHook(() => useAudio(), { wrapper });
    expect(result.current).toBeDefined();
    expect(typeof result.current.muted).toBe('boolean');
    expect(typeof result.current.volume).toBe('number');
  });

  it('re-exports SFX from the audio lib', () => {
    expect(SFX).toBeDefined();
    expect(typeof SFX).toBe('object');
  });

  it('SFX includes expected sound effect keys', () => {
    // The audio lib defines named sound effects like BET, WIN, etc.
    const keys = Object.keys(SFX);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('shim setMuted/setVolume calls are no-ops and do not throw', () => {
    const { result } = renderHook(() => useAudio());
    expect(() => result.current.setMuted(true)).not.toThrow();
    expect(() => result.current.setVolume(0.5)).not.toThrow();
    expect(() => result.current.play(SFX.BET)).not.toThrow();
    expect(() => result.current.stop(SFX.BET)).not.toThrow();
  });
});
