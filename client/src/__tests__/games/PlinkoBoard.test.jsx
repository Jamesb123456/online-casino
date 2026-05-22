import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

vi.mock('@/games/plinko/plinkoUtils', () => ({
  getPlinkoRows: () => 4,
  getNumberOfBuckets: (rows) => rows + 1,
  formatMultiplier: (m) => `${Number(m).toFixed(2)}x`,
  getMultiplierColor: () => 'rgb(124, 58, 237)',
  getPlinkoMultipliers: () => [0.5, 1, 2, 5, 0.5],
}));

vi.mock('pixi.js', () => {
  class StubContainer {
    constructor() {
      this.children = [];
      this.x = 0;
      this.y = 0;
      this.alpha = 1;
      this.scale = { x: 1, y: 1, set(v) { this.x = v; this.y = v; } };
    }
    addChild(...cs) { cs.forEach((c) => this.children.push(c)); return cs[0]; }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
    destroy() {}
    get parent() { return null; }
  }
  class StubGraphics extends StubContainer {
    clear() { return this; }
    beginFill() { return this; }
    endFill() { return this; }
    drawRect() { return this; }
    drawCircle() { return this; }
    drawRoundedRect() { return this; }
    lineStyle() { return this; }
  }
  class StubText extends StubContainer {
    constructor(text) { super(); this.text = text; this.anchor = { set() {} }; }
  }
  class StubApp {
    constructor() {
      this.stage = new StubContainer();
      this.renderer = { resize() {} };
      this.view = typeof document !== 'undefined' ? document.createElement('canvas') : {};
      this.ticker = {
        cbs: [],
        add(cb) { this.cbs.push(cb); },
        remove(cb) { this.cbs = this.cbs.filter((x) => x !== cb); },
        tick(delta = 1) { this.cbs.forEach((cb) => cb(delta)); },
      };
    }
    destroy() {}
  }
  return {
    Container: StubContainer,
    Graphics: StubGraphics,
    Text: StubText,
    Application: StubApp,
  };
});

vi.mock('matter-js', () => {
  const collisionListeners = [];
  const stub = {
    Engine: {
      create: vi.fn(() => ({ world: { bodies: [] } })),
      update: vi.fn(),
      clear: vi.fn(),
    },
    World: {
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    Bodies: {
      circle: vi.fn((x, y, _r, opts = {}) => ({
        position: { x, y },
        velocity: { x: 0, y: 0.4 },
        label: opts.label || 'body',
      })),
      rectangle: vi.fn((x, y, _w, _h, opts = {}) => ({
        position: { x, y },
        label: opts.label || 'body',
      })),
    },
    Body: { setVelocity: vi.fn() },
    Events: {
      on: vi.fn((_engine, _event, cb) => collisionListeners.push(cb)),
      off: vi.fn(() => { collisionListeners.length = 0; }),
    },
  };
  return { default: stub };
});

vi.mock('gsap', () => ({
  default: {
    fromTo: vi.fn(),
    to: vi.fn(),
  },
}));

const playMock = vi.fn();
vi.mock('@/components/casino/SoundProvider', () => ({
  useSound: () => ({ play: playMock, mute: false, muted: false, setMute: vi.fn() }),
}));
vi.mock('@/components/casino/MotionSafe', () => ({
  useReducedMotion: () => false,
}));

vi.mock('@/games/_shared/PixiStage', async () => {
  const PIXI = await import('pixi.js');
  function PixiStageStub({ onReady, ariaLabel = 'Game canvas', className = '' }) {
    React.useEffect(() => {
      if (typeof onReady !== 'function') return undefined;
      const app = new PIXI.Application();
      window.__pixiApp = app;
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

beforeEach(() => {
  vi.clearAllMocks();
  playMock.mockClear();
  delete window.__pixiApp;
});
afterEach(() => {
  vi.restoreAllMocks();
});

import PlinkoBoard from '@/games/plinko/PlinkoBoard';

describe('PlinkoBoard', () => {
  it('renders an accessible canvas stage', () => {
    render(<PlinkoBoard multipliers={[1, 2, 3, 4, 5]} />);
    const stage = screen.getByRole('img', { name: /Plinko board/i });
    expect(stage).toBeInTheDocument();
  });

  it('renders without multipliers and without animation path', () => {
    render(<PlinkoBoard />);
    expect(screen.getByTestId('pixi-stage-stub')).toBeInTheDocument();
  });

  it('builds the scene when PixiStage signals ready', () => {
    render(<PlinkoBoard multipliers={[0.5, 1, 2, 5, 0.5]} />);
    expect(window.__pixiApp).toBeDefined();
    // Ticker is wired, scene built.
    expect(window.__pixiApp.ticker.cbs.length).toBeGreaterThan(0);
  });

  it('accepts an animationPath prop and triggers drop', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const Matter = (await import('matter-js')).default;
    render(
      <PlinkoBoard
        multipliers={[0.5, 1, 2, 5, 0.5]}
        animationPath={[0, 1, 0, 1]}
        onAnimationComplete={onComplete}
      />,
    );
    // Allow the auto-drop setTimeout(60) to fire.
    act(() => {
      vi.advanceTimersByTime(80);
    });
    // Run the ticker — exercises Matter.Engine.update and pin glow code paths.
    const app = window.__pixiApp;
    expect(app).toBeDefined();
    act(() => {
      for (let i = 0; i < 30; i += 1) {
        app.ticker.tick(1);
      }
    });
    vi.useRealTimers();
    // The component should at least have called Matter.Bodies.circle (ball + pins).
    expect(Matter.Bodies.circle).toHaveBeenCalled();
  });

  it('cleans up on unmount without throwing', () => {
    const { unmount } = render(
      <PlinkoBoard multipliers={[1, 2, 3, 4, 5]} animationPath={[0, 1, 0, 1]} />,
    );
    expect(() => unmount()).not.toThrow();
  });

  it('handles empty animationPath (no drop)', () => {
    expect(() =>
      render(
        <PlinkoBoard
          multipliers={[0.5, 1, 2, 5, 0.5]}
          animationPath={[]}
        />,
      ),
    ).not.toThrow();
  });
});
