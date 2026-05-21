import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

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

// GSAP — no real tweens in tests. Return chainable no-ops.
vi.mock('gsap', () => {
  const tween = { kill: vi.fn() };
  const timeline = { kill: vi.fn() };
  timeline.to = vi.fn(() => timeline);
  const gsap = {
    to: vi.fn(() => tween),
    timeline: vi.fn(() => timeline),
    set: vi.fn(),
  };
  return { default: gsap, ...gsap };
});

// Sound + motion stubs.
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
import RouletteWheel from '@/games/roulette/RouletteWheel';

describe('RouletteWheel', () => {
  it('renders a Pixi-backed wheel with an accessible label', () => {
    render(<RouletteWheel />);
    const stage = screen.getByRole('img', { name: /Roulette wheel/i });
    expect(stage).toBeInTheDocument();
  });

  it('does not show winning number overlay while spinning', () => {
    render(<RouletteWheel isSpinning={true} winningNumber={17} showResult={false} />);
    expect(screen.queryByText('17')).not.toBeInTheDocument();
  });

  it('shows the winning number overlay when showResult is true and not spinning', () => {
    render(<RouletteWheel isSpinning={false} winningNumber={17} showResult={true} />);
    expect(screen.getByText('17')).toBeInTheDocument();
  });

  it('does not throw when winningNumber is null', () => {
    expect(() => render(<RouletteWheel winningNumber={null} showResult={true} />)).not.toThrow();
  });

  it('cleans up on unmount without throwing', () => {
    const { unmount } = render(
      <RouletteWheel isSpinning={true} winningNumber={5} showResult={false} />,
    );
    expect(() => unmount()).not.toThrow();
  });
});
