import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom doesn't implement HTMLAudioElement usefully. Stub a tiny class that
// records play/pause/cloneNode and lets us simulate load failure.
class MockAudio {
  constructor(src) {
    this.src = src;
    this.volume = 1;
    this.loop = false;
    this.preload = 'none';
    this.currentTime = 0;
    this._listeners = {};
    MockAudio.instances.push(this);
  }
  play() {
    MockAudio.playCalls.push(this.src);
    return Promise.resolve();
  }
  pause() {
    MockAudio.pauseCalls.push(this.src);
  }
  addEventListener(name, fn) {
    this._listeners[name] = this._listeners[name] || [];
    this._listeners[name].push(fn);
  }
  // Allow tests to fire a synthetic 'error' to mark an asset as failed.
  _dispatch(name) {
    (this._listeners[name] || []).forEach((fn) => fn());
  }
  cloneNode() {
    return new MockAudio(this.src);
  }
}

MockAudio.instances = [];
MockAudio.playCalls = [];
MockAudio.pauseCalls = [];

describe('lib/audio', () => {
  let audio;

  beforeEach(async () => {
    MockAudio.instances = [];
    MockAudio.playCalls = [];
    MockAudio.pauseCalls = [];
    vi.stubGlobal('Audio', MockAudio);
    try { window.localStorage.clear(); } catch { /* ignore */ }

    // Re-import fresh to pick up cleared module state.
    vi.resetModules();
    audio = await import('@/lib/audio');
    audio.__resetForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults: volume=0.5 and muted=false', () => {
    expect(audio.isMuted()).toBe(false);
    expect(audio.getVolume()).toBeCloseTo(0.5, 5);
  });

  it('setMuted() persists to localStorage', () => {
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    expect(window.localStorage.getItem('audio.muted')).toBe('true');
    audio.setMuted(false);
    expect(window.localStorage.getItem('audio.muted')).toBe('false');
  });

  it('setVolume() persists and clamps to [0,1]', () => {
    audio.setVolume(0.3);
    expect(audio.getVolume()).toBeCloseTo(0.3, 5);
    expect(window.localStorage.getItem('audio.volume')).toBe('0.3');

    audio.setVolume(2);
    expect(audio.getVolume()).toBe(1);

    audio.setVolume(-1);
    expect(audio.getVolume()).toBe(0);
  });

  it('play() no-ops when muted', () => {
    audio.setMuted(true);
    audio.play(audio.SFX.BET);
    expect(MockAudio.playCalls.length).toBe(0);
  });

  it('play() no-ops when volume is 0', () => {
    audio.setVolume(0);
    audio.play(audio.SFX.BET);
    expect(MockAudio.playCalls.length).toBe(0);
  });

  it('play() invokes Audio.play when unmuted', () => {
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.play(audio.SFX.WIN);
    expect(MockAudio.playCalls.length).toBe(1);
    expect(MockAudio.playCalls[0]).toMatch(/win\.mp3$/);
  });

  it('emits exactly one warning per failed-asset key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.setMuted(false);
    audio.setVolume(0.5);
    // First play() creates the base node (which we will mark as failed).
    audio.play(audio.SFX.WIN);
    // Mark the base node as failed by dispatching 'error'.
    const base = MockAudio.instances[0];
    base._dispatch('error');
    // Subsequent plays must be no-ops and must NOT emit further warnings.
    audio.play(audio.SFX.WIN);
    audio.play(audio.SFX.WIN);
    audio.play(audio.SFX.WIN);

    const winWarnings = warn.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes("'win'"),
    );
    expect(winWarnings.length).toBe(1);
    warn.mockRestore();
  });

  it('isMuted() / getVolume() reflect localStorage after a reload', async () => {
    window.localStorage.setItem('audio.muted', 'true');
    window.localStorage.setItem('audio.volume', '0.25');
    // Force a fresh module import to re-read storage.
    vi.resetModules();
    const fresh = await import('@/lib/audio');
    expect(fresh.isMuted()).toBe(true);
    expect(fresh.getVolume()).toBeCloseTo(0.25, 5);
  });

  it('startAmbient() creates a looping node and stopAmbient() pauses it', () => {
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.startAmbient();
    const ambientNodes = MockAudio.instances.filter((n) => /ambient\.mp3$/.test(n.src));
    expect(ambientNodes.length).toBeGreaterThanOrEqual(1);
    expect(ambientNodes[0].loop).toBe(true);
    expect(MockAudio.playCalls.some((s) => /ambient\.mp3$/.test(s))).toBe(true);

    audio.stopAmbient();
    expect(MockAudio.pauseCalls.some((s) => /ambient\.mp3$/.test(s))).toBe(true);
  });

  it('startAmbient() is a no-op while muted', () => {
    audio.setMuted(true);
    audio.startAmbient();
    expect(MockAudio.playCalls.filter((s) => /ambient\.mp3$/.test(s)).length).toBe(0);
  });

  it('preload() warms a base Audio node for every SFX key', () => {
    audio.preload();
    // One Audio per entry in SFX (BET, WIN, LOSS, TICK, DRUMROLL, BIG_WIN, AMBIENT).
    expect(MockAudio.instances.length).toBeGreaterThanOrEqual(7);
  });

  it('stop() pauses and resets the cached base node for non-ambient SFX', () => {
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.play(audio.SFX.WIN); // creates base node
    const base = MockAudio.instances.find((n) => /win\.mp3$/.test(n.src));
    expect(base).toBeDefined();
    base.currentTime = 5;

    audio.stop(audio.SFX.WIN);

    expect(MockAudio.pauseCalls.some((s) => /win\.mp3$/.test(s))).toBe(true);
    expect(base.currentTime).toBe(0);
  });

  it('stop() is a no-op when no base node exists for the key', () => {
    audio.stop(audio.SFX.LOSS);
    expect(MockAudio.pauseCalls.length).toBe(0);
  });

  it('stop() routes to stopAmbient when called with AMBIENT', () => {
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.startAmbient();
    audio.stop(audio.SFX.AMBIENT);
    expect(MockAudio.pauseCalls.some((s) => /ambient\.mp3$/.test(s))).toBe(true);
  });

  it('stop() swallows pause() exceptions', () => {
    class ThrowingAudio extends MockAudio {
      pause() { throw new Error('pause boom'); }
    }
    vi.stubGlobal('Audio', ThrowingAudio);
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.play(audio.SFX.TICK);
    // Must not throw.
    expect(() => audio.stop(audio.SFX.TICK)).not.toThrow();
  });

  it('stopAmbient() swallows pause() exceptions', () => {
    class ThrowingAmbient extends MockAudio {
      pause() { throw new Error('pause boom'); }
    }
    vi.stubGlobal('Audio', ThrowingAmbient);
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.startAmbient();
    expect(() => audio.stopAmbient()).not.toThrow();
  });

  it('warns when play() throws synchronously inside the try block', () => {
    class SyncThrowAudio extends MockAudio {
      cloneNode() { throw new Error('clone failed'); }
    }
    vi.stubGlobal('Audio', SyncThrowAudio);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.setMuted(false);
    audio.setVolume(0.5);
    // Force base node creation to succeed, then cloneNode throws inside play().
    audio.play(audio.SFX.BET);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns when play()s underlying promise rejects', async () => {
    class RejectingAudio extends MockAudio {
      play() {
        MockAudio.playCalls.push(this.src);
        return Promise.reject(new Error('autoplay blocked'));
      }
      // Override cloneNode so the clone is also rejecting (default cloneNode
      // returns `new MockAudio` which uses the parent class).
      cloneNode() { return new RejectingAudio(this.src); }
    }
    vi.stubGlobal('Audio', RejectingAudio);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.play(audio.SFX.BET);
    // Flush the microtask queue so the promise rejection runs.
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns when startAmbient throws synchronously inside its play try-block', () => {
    // Construction must succeed; the synchronous try-block fails when play() throws.
    class StubbornAmbient extends MockAudio {
      play() { throw new Error('decode failed'); }
    }
    vi.stubGlobal('Audio', StubbornAmbient);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.startAmbient();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns when startAmbient()s play promise rejects', async () => {
    class RejectingAmbient extends MockAudio {
      play() {
        MockAudio.playCalls.push(this.src);
        return Promise.reject(new Error('autoplay blocked'));
      }
    }
    vi.stubGlobal('Audio', RejectingAmbient);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.startAmbient();
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns and blacklists the key when the Audio constructor throws (play)', () => {
    class ThrowingCtor {
      constructor() { throw new Error('no decoder'); }
    }
    vi.stubGlobal('Audio', ThrowingCtor);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.play(audio.SFX.BET);
    expect(warn).toHaveBeenCalled();
    // Subsequent plays are blacklisted (single warn only).
    audio.play(audio.SFX.BET);
    audio.play(audio.SFX.BET);
    expect(warn.mock.calls.length).toBe(1);
    warn.mockRestore();
  });

  it('warns when startAmbient()s Audio constructor throws', () => {
    class ThrowingCtor {
      constructor() { throw new Error('no ambient'); }
    }
    vi.stubGlobal('Audio', ThrowingCtor);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.startAmbient();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('setMuted(false) restarts ambient that was previously requested while muted', () => {
    audio.setMuted(true);
    audio.setVolume(0.5);
    // While muted, startAmbient() sets _ambientPlaying=true and returns
    // without actually playing. setMuted(false) should then restart it.
    audio.startAmbient();
    const playsBefore = MockAudio.playCalls.filter((s) => /ambient\.mp3$/.test(s)).length;
    expect(playsBefore).toBe(0);

    audio.setMuted(false);

    const playsAfter = MockAudio.playCalls.filter((s) => /ambient\.mp3$/.test(s)).length;
    expect(playsAfter).toBeGreaterThan(0);
  });

  it('setMuted(false) refreshes ambient node volume when ambient exists but is paused', () => {
    // Start ambient so the node exists, then stopAmbient sets _ambientPlaying=false.
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.startAmbient();
    audio.stopAmbient();
    const ambientNode = MockAudio.instances.find((n) => /ambient\.mp3$/.test(n.src));
    expect(ambientNode).toBeDefined();
    // Force-set so we can verify the volume update path.
    ambientNode.volume = -1;

    // Now call setMuted(false) while ambient is paused — should hit the "else if (_ambientNode)" branch.
    audio.setMuted(false);
    // Volume = 0.5 * 0.4 = 0.2
    expect(ambientNode.volume).toBeCloseTo(0.2, 5);
  });

  it('setVolume() applies the new volume to the active ambient node', () => {
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.startAmbient();
    const ambientNode = MockAudio.instances.find((n) => /ambient\.mp3$/.test(n.src));
    expect(ambientNode).toBeDefined();

    audio.setVolume(0.8);
    // ambient factor is 0.4
    expect(ambientNode.volume).toBeCloseTo(0.32, 5);
  });

  it('falls back to defaults when localStorage.getItem throws', () => {
    const origGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('access denied'); };
    try {
      audio.__resetForTests();
      // Should not throw and should fall back to defaults.
      expect(audio.isMuted()).toBe(false);
      expect(audio.getVolume()).toBeCloseTo(0.5, 5);
    } finally {
      Storage.prototype.getItem = origGetItem;
    }
  });

  it('ignores localStorage.setItem failures on setMuted/setVolume', () => {
    const stub = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => audio.setMuted(true)).not.toThrow();
    expect(() => audio.setVolume(0.7)).not.toThrow();
    stub.mockRestore();
  });

  it('play() is a no-op when name is empty', () => {
    audio.setMuted(false);
    audio.setVolume(0.5);
    audio.play('');
    audio.play(undefined);
    expect(MockAudio.playCalls.length).toBe(0);
  });
});
