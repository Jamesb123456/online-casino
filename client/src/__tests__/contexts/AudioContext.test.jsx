import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock Audio so the lib doesn't actually try to load assets.
class MockAudio {
  constructor() {
    this.volume = 1;
    this.loop = false;
    this.preload = 'none';
    this.currentTime = 0;
  }
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener() {}
  cloneNode() { return new MockAudio(); }
}

describe('AudioContext', () => {
  beforeEach(() => {
    vi.stubGlobal('Audio', MockAudio);
    try { window.localStorage.clear(); } catch { /* ignore */ }
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('provides default state (muted=false, volume=0.5)', async () => {
    const { AudioProvider, useAudio } = await import('@/contexts/AudioContext');

    function Probe() {
      const { muted, volume } = useAudio();
      return (
        <div>
          <span data-testid="muted">{String(muted)}</span>
          <span data-testid="volume">{volume.toFixed(2)}</span>
        </div>
      );
    }

    render(
      <AudioProvider>
        <Probe />
      </AudioProvider>,
    );

    expect(screen.getByTestId('muted').textContent).toBe('false');
    expect(screen.getByTestId('volume').textContent).toBe('0.50');
  });

  it('setMuted() updates context state and persists', async () => {
    const { AudioProvider, useAudio } = await import('@/contexts/AudioContext');

    function Probe() {
      const { muted, setMuted } = useAudio();
      return (
        <div>
          <span data-testid="muted">{String(muted)}</span>
          <button data-testid="toggle" onClick={() => setMuted(!muted)}>toggle</button>
        </div>
      );
    }

    render(
      <AudioProvider>
        <Probe />
      </AudioProvider>,
    );

    expect(screen.getByTestId('muted').textContent).toBe('false');
    const user = userEvent.setup();
    await user.click(screen.getByTestId('toggle'));
    expect(screen.getByTestId('muted').textContent).toBe('true');
    expect(window.localStorage.getItem('audio.muted')).toBe('true');
  });

  it('setVolume() clamps to [0,1] and updates state', async () => {
    const { AudioProvider, useAudio } = await import('@/contexts/AudioContext');

    function Probe() {
      const { volume, setVolume } = useAudio();
      return (
        <div>
          <span data-testid="volume">{volume.toFixed(2)}</span>
          <button data-testid="hi" onClick={() => setVolume(2)}>hi</button>
          <button data-testid="lo" onClick={() => setVolume(-1)}>lo</button>
          <button data-testid="mid" onClick={() => setVolume(0.25)}>mid</button>
        </div>
      );
    }

    render(
      <AudioProvider>
        <Probe />
      </AudioProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId('hi'));
    expect(screen.getByTestId('volume').textContent).toBe('1.00');
    await user.click(screen.getByTestId('lo'));
    expect(screen.getByTestId('volume').textContent).toBe('0.00');
    await user.click(screen.getByTestId('mid'));
    expect(screen.getByTestId('volume').textContent).toBe('0.25');
  });

  it('useAudio() returns no-op shim when used outside a provider', async () => {
    const { useAudio } = await import('@/contexts/AudioContext');

    let captured;
    function Probe() {
      captured = useAudio();
      return null;
    }
    render(<Probe />);

    expect(captured.muted).toBe(true);
    expect(captured.volume).toBe(0);
    // These should be safely callable.
    expect(() => captured.play('bet')).not.toThrow();
    expect(() => captured.startAmbient()).not.toThrow();
  });

  it('exposes play / startAmbient / stopAmbient as functions', async () => {
    const { AudioProvider, useAudio } = await import('@/contexts/AudioContext');

    let captured;
    function Probe() {
      captured = useAudio();
      return null;
    }
    render(
      <AudioProvider>
        <Probe />
      </AudioProvider>,
    );

    expect(typeof captured.play).toBe('function');
    expect(typeof captured.stop).toBe('function');
    expect(typeof captured.startAmbient).toBe('function');
    expect(typeof captured.stopAmbient).toBe('function');
    expect(captured.SFX).toBeDefined();
    // Calling them does not throw with the mocked Audio constructor.
    act(() => {
      captured.play(captured.SFX.WIN);
      captured.startAmbient();
      captured.stopAmbient();
    });
  });
});
