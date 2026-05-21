import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

/**
 * GameCanvas — a self-sizing <canvas> that handles DPR scaling and exposes
 * an imperative `redraw()` handle.
 *
 * Props
 *   render(ctx, { width, height, dpr })  drawing callback (called on resize
 *                                        and on every RAF tick if `tick`)
 *   aspectRatio  number (w / h); enforced via CSS `aspect-ratio`. Default 1
 *   ariaLabel    accessible name for the visual stage
 *   className    optional extra classes for the wrapper
 *   tick         when true, runs a requestAnimationFrame loop; when false,
 *                consumer must call `redraw()` via ref to repaint.
 *   announcement optional live string for the polite aria-live region
 *
 * Imperative handle: `{ redraw() }`
 */
const GameCanvas = forwardRef(function GameCanvas(
  {
    render,
    aspectRatio = 1,
    ariaLabel = 'Game stage',
    className = '',
    tick = false,
    announcement = '',
  },
  ref
) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const renderRef = useRef(render);
  const rafRef = useRef(0);

  // Keep latest render fn without re-subscribing the RAF loop.
  renderRef.current = render;

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const fn = renderRef.current;
    if (typeof fn !== 'function') return;
    const { width, height, dpr } = sizeRef.current;
    if (width <= 0 || height <= 0) return;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fn(ctx, { width, height, dpr });
    ctx.restore();
  }, []);

  const resize = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const rect = wrapper.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (
      sizeRef.current.width === width &&
      sizeRef.current.height === height &&
      sizeRef.current.dpr === dpr
    ) {
      return;
    }
    sizeRef.current = { width, height, dpr };
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    paint();
  }, [paint]);

  // Observe wrapper size.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') {
      resize();
      return undefined;
    }
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrapper);
    resize();
    return () => ro.disconnect();
  }, [resize]);

  // RAF loop when `tick` is on.
  useEffect(() => {
    if (!tick) return undefined;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      paint();
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [tick, paint]);

  useImperativeHandle(
    ref,
    () => ({
      redraw: () => paint(),
    }),
    [paint]
  );

  return (
    <div
      ref={wrapperRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative w-full ${className}`}
      style={{ aspectRatio: String(aspectRatio) }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        aria-hidden="true"
      />
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only absolute -m-px h-px w-px overflow-hidden p-0"
      >
        {announcement}
      </div>
    </div>
  );
});

export default GameCanvas;
