import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock the wheel utils used by WheelBoard for label rendering.
vi.mock('@/games/wheel/wheelUtils', () => ({
  formatMultiplier: (m) => `${Number(m).toFixed(2)}x`,
}));

// Mock pixi.js — jsdom has no WebGL context. Inline stubs are required because
// vi.mock factories are hoisted above any imports.
vi.mock('pixi.js', () => {
  class StubContainer {
    constructor() {
      this.children = [];
      this.x = 0;
      this.y = 0;
      this.rotation = 0;
      this.scale = { x: 1, y: 1, set() {} };
      this.filters = [];
      this.alpha = 1;
    }
    addChild(c) { this.children.push(c); return c; }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
    removeChildren() { const r = this.children; this.children = []; return r; }
    destroy() {}
  }
  class StubGraphics extends StubContainer {
    clear() { return this; }
    beginFill() { return this; }
    endFill() { return this; }
    drawCircle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    arc() { return this; }
    closePath() { return this; }
    lineStyle() { return this; }
  }
  class StubText extends StubContainer {
    constructor(text) { super(); this.text = text; this.anchor = { set() {} }; }
  }
  class StubBlurFilter {
    constructor() { this.blurX = 0; this.blurY = 0; this.padding = 0; }
  }
  class StubApp {
    constructor() {
      this.stage = new StubContainer();
      this.renderer = { resize() {} };
      this.view = typeof document !== 'undefined' ? document.createElement('canvas') : {};
    }
    destroy() {}
  }
  return {
    Container: StubContainer,
    Graphics: StubGraphics,
    Text: StubText,
    BlurFilter: StubBlurFilter,
    Application: StubApp,
  };
});

// PixiStage stub — synchronously invokes onReady so the SUT builds its scene.
vi.mock('@/games/_shared/PixiStage', () => {
  function PixiStageStub({ onReady, ariaLabel = 'Game canvas', className = '' }) {
    React.useEffect(() => {
      if (typeof onReady !== 'function') return undefined;
      const stage = {
        children: [],
        addChild() {},
        removeChild() {},
        removeChildren() { return []; },
      };
      const app = {
        stage,
        renderer: { resize() {} },
        view: typeof document !== 'undefined' ? document.createElement('canvas') : {},
        destroy() {},
      };
      const cleanup = onReady(app, { width: 400, height: 400 });
      return () => {
        if (typeof cleanup === 'function') {
          try { cleanup(); } catch { /* ignore */ }
        }
      };
    }, [onReady]);
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        className={className}
        data-testid="pixi-stage-stub"
      />
    );
  }
  return { default: PixiStageStub };
});

// GSAP — we don't want timers running in tests. Return chainable no-ops that
// invoke onComplete synchronously so handleSpinComplete still fires.
vi.mock('gsap', () => {
  const tween = () => {
    const obj = {
      kill: vi.fn(),
      to: vi.fn(),
    };
    // Make it chainable
    obj.to = vi.fn(() => obj);
    return obj;
  };
  const gsap = {
    to: vi.fn((target, vars) => {
      if (vars && typeof vars.onComplete === 'function') {
        // Fire async so React state updates settle before the assertion.
        Promise.resolve().then(() => {
          try {
            if (vars.onUpdate) vars.onUpdate();
            vars.onComplete();
          } catch {
            /* ignore */
          }
        });
      }
      return tween();
    }),
    timeline: vi.fn(() => {
      const tl = {
        kill: vi.fn(),
      };
      tl.to = vi.fn(() => tl);
      return tl;
    }),
  };
  return { default: gsap, ...gsap };
});

// Sound + motion stubs — return predictable values without touching real APIs.
vi.mock('@/components/casino/SoundProvider', () => ({
  useSound: () => ({ play: vi.fn(), mute: false, muted: false, setMute: vi.fn() }),
}));
vi.mock('@/components/casino/MotionSafe', () => ({
  useReducedMotion: () => false,
}));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

// Import after mocks are set up.
import WheelBoard from '@/games/wheel/WheelBoard';

describe('WheelBoard (Pixi)', () => {
  it('renders an accessible stage element', () => {
    render(<WheelBoard segments={[]} />);
    const stage = screen.getByRole('img', { name: /Wheel of Fortune/i });
    expect(stage).toBeInTheDocument();
  });

  it('renders with provided segments without throwing', () => {
    const segments = [
      { multiplier: 1.5, color: '#ff0000' },
      { multiplier: 2.0, color: '#00ff00' },
      { multiplier: 5.0, color: '#0000ff' },
    ];
    expect(() => render(<WheelBoard segments={segments} />)).not.toThrow();
  });

  it('invokes onSpinComplete after a spin tween resolves', async () => {
    const onSpinComplete = vi.fn();
    const segments = [
      { multiplier: 1.5, color: '#ff0000' },
      { multiplier: 2.0, color: '#00ff00' },
    ];
    const { rerender } = render(
      <WheelBoard
        segments={segments}
        spinning={false}
        targetAngle={0}
        onSpinComplete={onSpinComplete}
      />,
    );
    rerender(
      <WheelBoard
        segments={segments}
        spinning
        targetAngle={1440}
        onSpinComplete={onSpinComplete}
      />,
    );
    // The gsap mock fires onComplete on a microtask — flush it.
    await new Promise((r) => setTimeout(r, 0));
    expect(onSpinComplete).toHaveBeenCalledTimes(1);
  });

  it('cleans up on unmount without throwing', () => {
    const segments = [{ multiplier: 1.5, color: '#ff0000' }];
    const { unmount } = render(
      <WheelBoard segments={segments} spinning targetAngle={720} />,
    );
    expect(() => unmount()).not.toThrow();
  });
});
