import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/games/slots/symbols', () => ({
  SYMBOL_KEYS: ['gem', 'seven', 'bell', 'bar', 'cherry', 'A', 'B'],
  getSymbolTexture: vi.fn(() => ({ valid: true })),
  normalizeSymbolKey: (k) => (k && typeof k === 'string' ? k.toLowerCase() : 'bar'),
}));

vi.mock('pixi.js', () => {
  class StubContainer {
    constructor() {
      this.children = [];
      this.x = 0;
      this.y = 0;
      this.alpha = 1;
      this.rotation = 0;
      this.scale = { x: 1, y: 1, set() {} };
      this.filters = [];
      this.mask = null;
    }
    addChild(...cs) { cs.forEach((c) => this.children.push(c)); return cs[0]; }
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
    removeChildren() { const r = this.children; this.children = []; return r; }
    destroy() {}
  }
  class StubGraphics extends StubContainer {
    clear() { return this; }
    beginFill() { return this; }
    endFill() { return this; }
    drawRect() { return this; }
    drawRoundedRect() { return this; }
    drawCircle() { return this; }
    lineStyle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
  }
  class StubText extends StubContainer {
    constructor(text) { super(); this.text = text; this.anchor = { set() {} }; }
  }
  class StubSprite extends StubContainer {
    constructor(_tex) {
      super();
      this.width = 0;
      this.height = 0;
      this.anchor = { set() {} };
    }
  }
  class StubBlurFilter {
    constructor() { this.blurX = 0; this.blurY = 0; this.padding = 0; }
  }
  class StubTexture {}
  StubTexture.EMPTY = {};
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
    Sprite: StubSprite,
    BlurFilter: StubBlurFilter,
    Texture: StubTexture,
    Application: StubApp,
  };
});

vi.mock('gsap', () => {
  const tween = {
    kill: vi.fn(),
  };
  const tl = {
    kill: vi.fn(),
  };
  tl.to = vi.fn(() => tl);
  const gsap = {
    to: vi.fn((target, vars) => {
      if (vars && typeof vars.onComplete === 'function') {
        Promise.resolve().then(() => {
          try { vars.onComplete(); } catch { /* ignore */ }
        });
      }
      return tween;
    }),
    timeline: vi.fn(() => tl),
  };
  return { default: gsap, ...gsap };
});

vi.mock('@/components/casino/SoundProvider', () => ({
  useSound: () => ({ play: vi.fn(), mute: false, muted: false, setMute: vi.fn() }),
}));

const reducedMotionRef = { value: false };
vi.mock('@/components/casino/MotionSafe', () => ({
  useReducedMotion: () => reducedMotionRef.value,
}));

vi.mock('@/games/_shared/PixiStage', async () => {
  const PIXI = await import('pixi.js');
  function PixiStageStub({ onReady, onResize, ariaLabel = 'Game canvas', className = '' }) {
    React.useEffect(() => {
      if (typeof onReady !== 'function') return undefined;
      const app = new PIXI.Application();
      window.__pixiApp = app;
      const cleanup = onReady(app, { width: 600, height: 360 });
      // Trigger a resize for coverage.
      if (typeof onResize === 'function') {
        try { onResize(app, { width: 800, height: 480 }); } catch { /* ignore */ }
      }
      return () => {
        if (typeof cleanup === 'function') {
          try { cleanup(); } catch { /* ignore */ }
        }
      };
    }, [onReady, onResize]);
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
  reducedMotionRef.value = false;
  delete window.__pixiApp;
});
afterEach(() => {
  vi.restoreAllMocks();
});

import SlotsBoard from '@/games/slots/SlotsBoard';

describe('SlotsBoard', () => {
  it('renders an accessible stage element', () => {
    render(<SlotsBoard reels={[]} />);
    const stage = screen.getByRole('img', { name: /Slots reels/i });
    expect(stage).toBeInTheDocument();
  });

  it('builds the scene on ready and lays out reels', () => {
    render(<SlotsBoard reels={[]} />);
    expect(window.__pixiApp).toBeDefined();
    // 5 reels, each adds a strip + a mask graphics + win overlay + flash + bg.
    expect(window.__pixiApp.stage.children.length).toBeGreaterThan(0);
  });

  it('applies provided reels on idle prop updates', () => {
    const reels = [
      ['gem', 'seven', 'bar'],
      ['bell', 'cherry', 'gem'],
      ['A', 'B', 'seven'],
      ['cherry', 'gem', 'bell'],
      ['bar', 'A', 'B'],
    ];
    expect(() => render(<SlotsBoard reels={reels} />)).not.toThrow();
  });

  it('draws winning cells overlay (small win)', () => {
    const reels = [
      ['gem', 'gem', 'gem'],
      ['gem', 'gem', 'gem'],
      ['gem', 'gem', 'gem'],
      ['gem', 'gem', 'gem'],
      ['gem', 'gem', 'gem'],
    ];
    const winningCells = new Set(['0:1', '1:1', '2:1', '3:1', '4:1']);
    expect(() =>
      render(
        <SlotsBoard reels={reels} winningCells={winningCells} bigWin={false} />,
      ),
    ).not.toThrow();
  });

  it('draws winning cells overlay (big win)', () => {
    const winningCells = new Set(['0:0', '1:0', '2:0']);
    expect(() =>
      render(
        <SlotsBoard reels={[]} winningCells={winningCells} bigWin />,
      ),
    ).not.toThrow();
  });

  it('runs spin lifecycle and fires onSpinComplete', async () => {
    const onSpinComplete = vi.fn();
    const reels = [
      ['gem', 'seven', 'bar'],
      ['bell', 'cherry', 'gem'],
      ['A', 'B', 'seven'],
      ['cherry', 'gem', 'bell'],
      ['bar', 'A', 'B'],
    ];
    const { rerender } = render(
      <SlotsBoard reels={reels} spinning={false} onSpinComplete={onSpinComplete} />,
    );
    rerender(
      <SlotsBoard reels={reels} spinning onSpinComplete={onSpinComplete} />,
    );
    // Flush gsap onComplete microtasks (one per reel).
    await new Promise((r) => setTimeout(r, 10));
    // After all 5 reels report done, spin complete fires once.
    expect(onSpinComplete).toHaveBeenCalled();
  });

  it('snaps to rest with reduced motion', async () => {
    reducedMotionRef.value = true;
    const onSpinComplete = vi.fn();
    const reels = [
      ['gem', 'seven', 'bar'],
      ['bell', 'cherry', 'gem'],
      ['A', 'B', 'seven'],
      ['cherry', 'gem', 'bell'],
      ['bar', 'A', 'B'],
    ];
    const { rerender } = render(
      <SlotsBoard reels={reels} spinning={false} onSpinComplete={onSpinComplete} />,
    );
    rerender(
      <SlotsBoard reels={reels} spinning onSpinComplete={onSpinComplete} />,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(onSpinComplete).toHaveBeenCalledTimes(1);
  });

  it('handles malformed winning cell keys gracefully', () => {
    const winningCells = new Set(['not:valid', 'x:0', '99:99']);
    expect(() =>
      render(<SlotsBoard reels={[]} winningCells={winningCells} />),
    ).not.toThrow();
  });

  it('cleans up on unmount without throwing', () => {
    const { unmount } = render(<SlotsBoard reels={[]} spinning />);
    expect(() => unmount()).not.toThrow();
  });
});
