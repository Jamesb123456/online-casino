/**
 * Shared lightweight stubs for pixi.js and PixiStage.
 *
 * Pixi requires WebGL which jsdom doesn't provide, so unit tests that render
 * pixi-backed components mock the library out entirely. Import this module
 * from a test and call `installPixiMocks(vi)` *before* importing the SUT, or
 * use `vi.mock` directly with `pixiStub` / `pixiStageStub`.
 */
import React from 'react';

class StubContainer {
  constructor() {
    this.children = [];
    this.x = 0;
    this.y = 0;
    this.rotation = 0;
    this.scale = { x: 1, y: 1, set: () => {} };
    this.filters = [];
    this.alpha = 1;
    this.destroyed = false;
  }
  addChild(c) {
    this.children.push(c);
    return c;
  }
  removeChild(c) {
    this.children = this.children.filter((x) => x !== c);
    return c;
  }
  removeChildren() {
    const removed = this.children;
    this.children = [];
    return removed;
  }
  destroy() {
    this.destroyed = true;
  }
}

class StubGraphics extends StubContainer {
  clear() { return this; }
  beginFill() { return this; }
  endFill() { return this; }
  drawCircle() { return this; }
  drawRect() { return this; }
  moveTo() { return this; }
  lineTo() { return this; }
  arc() { return this; }
  closePath() { return this; }
  lineStyle() { return this; }
}

class StubText extends StubContainer {
  constructor(text) {
    super();
    this.text = text;
    this.anchor = { set: () => {} };
  }
}

class StubBlurFilter {
  constructor(blurX = 0, _quality = 4) {
    this.blurX = blurX;
    this.blurY = blurX;
    this.padding = 0;
  }
}

class StubApplication {
  constructor() {
    this.stage = new StubContainer();
    this.renderer = { resize: () => {} };
    this.view = typeof document !== 'undefined' ? document.createElement('canvas') : {};
    this.destroyed = false;
  }
  destroy() {
    this.destroyed = true;
  }
}

export const pixiStub = {
  Application: StubApplication,
  Container: StubContainer,
  Graphics: StubGraphics,
  Text: StubText,
  BlurFilter: StubBlurFilter,
};

/**
 * Mock for PixiStage that immediately calls onReady with a stub app and skips
 * the real canvas mount path. Returns the cleanup function so React can clean up.
 */
export function PixiStageStub({ onReady, ariaLabel = 'Game canvas', className = '' }) {
  const cleanupRef = React.useRef(null);
  React.useEffect(() => {
    if (typeof onReady === 'function') {
      const app = new StubApplication();
      const cleanup = onReady(app, { width: 400, height: 400 });
      if (typeof cleanup === 'function') cleanupRef.current = cleanup;
    }
    return () => {
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch {
          /* ignore */
        }
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

export const pixiStageStub = {
  default: PixiStageStub,
};

export default pixiStub;
