import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

/**
 * PixiStage — minimal DPR-aware Pixi.js v7 mount.
 *
 * Owns a <div> that holds a Pixi Application's canvas. Calls back to the
 * consumer once on mount with the live `app` instance so the consumer can
 * build its scene graph imperatively (this is the cleanest pattern for
 * games that also run matter-js, GSAP, or any non-React physics loop).
 *
 * Props
 *   onReady(app, { width, height }) — invoked once after the Application is
 *                                     created. Consumer should populate the
 *                                     `app.stage` and return a cleanup function
 *                                     (called on unmount or before resize).
 *   onResize(app, { width, height }) — optional callback when the wrapper
 *                                     resizes; runs *after* `app.renderer.resize`.
 *   aspectRatio  number — width/height ratio for the wrapper (default 1).
 *   background   number (hex) — clear color (default 0x07080F — matches
 *                              --color-bg-game).
 *   ariaLabel    string — accessible name on the wrapper div.
 *   className    extra wrapper classes.
 */
function PixiStage({
  onReady,
  onResize,
  aspectRatio = 1,
  background = 0x07080F,
  ariaLabel = 'Game canvas',
  className = '',
}) {
  const wrapperRef = useRef(null);
  const appRef = useRef(null);
  const cleanupRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onResizeRef = useRef(onResize);

  // Keep latest callbacks without restarting the Pixi app.
  onReadyRef.current = onReady;
  onResizeRef.current = onResize;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = wrapper.getBoundingClientRect();
    const width = Math.max(2, Math.floor(rect.width));
    const height = Math.max(2, Math.floor(rect.height || width / aspectRatio));

    let app;
    try {
      app = new PIXI.Application({
        width,
        height,
        backgroundColor: background,
        antialias: true,
        resolution: dpr,
        autoDensity: true,
      });
    } catch {
      // jsdom or no-WebGL environment — render a graceful fallback.
      return undefined;
    }

    appRef.current = app;
    if (app.view && typeof app.view.style !== 'undefined') {
      app.view.style.display = 'block';
      app.view.style.width = '100%';
      app.view.style.height = '100%';
    }
    wrapper.appendChild(app.view);

    try {
      const cleanup = onReadyRef.current && onReadyRef.current(app, { width, height });
      if (typeof cleanup === 'function') cleanupRef.current = cleanup;
    } catch {
      /* swallow — never crash the UI on scene-build errors */
    }

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (!appRef.current) return;
        const r = wrapper.getBoundingClientRect();
        const w = Math.max(2, Math.floor(r.width));
        const h = Math.max(2, Math.floor(r.height || w / aspectRatio));
        try {
          appRef.current.renderer.resize(w, h);
        } catch {
          /* ignore */
        }
        if (onResizeRef.current) {
          try {
            onResizeRef.current(appRef.current, { width: w, height: h });
          } catch {
            /* ignore */
          }
        }
      });
      ro.observe(wrapper);
    }

    return () => {
      if (ro) {
        try {
          ro.disconnect();
        } catch {
          /* ignore */
        }
      }
      if (cleanupRef.current) {
        try {
          cleanupRef.current();
        } catch {
          /* ignore */
        }
        cleanupRef.current = null;
      }
      if (appRef.current) {
        try {
          appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        } catch {
          /* ignore */
        }
        appRef.current = null;
      }
    };
  }, [aspectRatio, background]);

  return (
    <div
      ref={wrapperRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative w-full ${className}`}
      style={{ aspectRatio: String(aspectRatio) }}
    />
  );
}

export default PixiStage;
