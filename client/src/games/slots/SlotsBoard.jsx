import React, { useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import PixiStage from '../_shared/PixiStage';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';
import {
  SYMBOL_KEYS,
  getSymbolTexture,
  normalizeSymbolKey,
} from './symbols';

/**
 * SlotsBoard — Pixi.js render layer for the slot reels.
 *
 * Props
 *   reels        string[][]   resolved (or placeholder) reel grid — 5 columns × 3 rows.
 *                              Server symbols are normalized to our visual set.
 *   spinning     boolean      when transitions true, kicks off the spin timeline.
 *   winningCells Set<string>  "r:row" keys to glow when a win is shown.
 *   bigWin       boolean      when true and a spin lands, fires the cinematic flash.
 *   onSpinComplete fn         called once the last reel finishes its snap.
 *
 * Visual model:
 *   - 5 reels, each a long sprite strip ~ 24 symbols tall.
 *   - Spin animates strip.y from current to target via GSAP back.out(1.1).
 *   - BlurFilter blurY: 0 → 16 → 0 over the spin window.
 *   - Stagger: reel `i` stops at 1.0 + i * 0.3 seconds.
 *   - Win polyline drawn over winning cells, lime for small, gold for big.
 *   - Reduced motion: jump to final state, no blur, no flash.
 */

const REELS = 5;
const ROWS = 3;
const STRIP_LENGTH = 24;
const STAGGER_BASE = 1.0;
const STAGGER_STEP = 0.3;

function pickRandomKey(rng = Math.random) {
  return SYMBOL_KEYS[Math.floor(rng() * SYMBOL_KEYS.length)];
}

function buildRandomStripKeys() {
  const arr = new Array(STRIP_LENGTH);
  for (let i = 0; i < STRIP_LENGTH; i++) arr[i] = pickRandomKey();
  return arr;
}

/**
 * Place the final 3 visible symbols at the end of the strip so the spin
 * snaps to them. Returns the strip keys and the y-offset that shows rows
 * 0..2 of the visible window when the strip ends at the desired position.
 */
function buildResolvedStripKeys(visibleKeys) {
  const filler = STRIP_LENGTH - ROWS;
  const arr = new Array(STRIP_LENGTH);
  for (let i = 0; i < filler; i++) arr[i] = pickRandomKey();
  for (let r = 0; r < ROWS; r++) arr[filler + r] = visibleKeys[r];
  return arr;
}

const SlotsBoard = ({
  reels = [],
  spinning = false,
  winningCells = new Set(),
  bigWin = false,
  onSpinComplete = () => {},
}) => {
  const { play } = useSound();
  const reduced = useReducedMotion();

  // Imperative scene refs — keep Pixi out of React's render loop.
  const sceneRef = useRef({
    app: null,
    boardWidth: 0,
    boardHeight: 0,
    cellSize: 0,
    reelMaskGfx: null,
    reels: [], // per reel: { strip: PIXI.Container, sprites: Sprite[], keys: string[], blur, x }
    winOverlay: null, // PIXI.Graphics on top of reels for win polylines
    flashOverlay: null, // PIXI.Graphics — full-board flash on big wins
  });

  const tweensRef = useRef([]);
  const blurTweensRef = useRef([]);
  const flashTweenRef = useRef(null);
  const winFadeTweenRef = useRef(null);

  const playRef = useRef(play);
  playRef.current = play;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  const reelsDataRef = useRef(reels);
  reelsDataRef.current = reels;
  const winningCellsRef = useRef(winningCells);
  winningCellsRef.current = winningCells;
  const bigWinRef = useRef(bigWin);
  bigWinRef.current = bigWin;
  const spinningRef = useRef(false);

  const killAllTweens = useCallback(() => {
    tweensRef.current.forEach((t) => {
      try {
        t?.kill();
      } catch {
        /* ignore */
      }
    });
    tweensRef.current = [];
    blurTweensRef.current.forEach((t) => {
      try {
        t?.kill();
      } catch {
        /* ignore */
      }
    });
    blurTweensRef.current = [];
    try {
      flashTweenRef.current?.kill();
    } catch {
      /* ignore */
    }
    flashTweenRef.current = null;
    try {
      winFadeTweenRef.current?.kill();
    } catch {
      /* ignore */
    }
    winFadeTweenRef.current = null;
  }, []);

  // Rebuild one reel strip's sprites for a fresh set of keys.
  const rebuildStrip = useCallback((reelIdx, keys) => {
    const s = sceneRef.current;
    const reel = s.reels[reelIdx];
    if (!reel) return;
    const cellSize = s.cellSize;

    // Tear down existing sprites.
    reel.strip.removeChildren().forEach((child) => {
      try {
        child.destroy({ children: true });
      } catch {
        /* ignore */
      }
    });
    const sprites = [];
    for (let i = 0; i < keys.length; i++) {
      const key = normalizeSymbolKey(keys[i]);
      // Pixi 7 → 8 changed when `Texture.valid` is populated; constructing a
      // Sprite against a not-yet-loaded SVG texture can throw. Swallow the
      // error so the scene graph still renders (empty texture fallback) and
      // the rest of the game UI stays mounted.
      let sprite;
      try {
        sprite = new PIXI.Sprite(getSymbolTexture(key));
      } catch {
        try {
          sprite = new PIXI.Sprite(PIXI.Texture.EMPTY);
        } catch {
          continue;
        }
      }
      if (!sprite) continue;
      sprite.width = cellSize * 0.84;
      sprite.height = cellSize * 0.84;
      sprite.anchor.set(0.5);
      sprite.x = cellSize / 2;
      sprite.y = i * cellSize + cellSize / 2;
      reel.strip.addChild(sprite);
      sprites.push(sprite);
    }
    reel.sprites = sprites;
    reel.keys = keys;
  }, []);

  // Render the win polylines + cell glows.
  const drawWinOverlay = useCallback(() => {
    const s = sceneRef.current;
    const overlay = s.winOverlay;
    if (!overlay) return;
    overlay.clear();
    overlay.alpha = 1;

    const cells = winningCellsRef.current;
    if (!cells || cells.size === 0) return;
    const cellSize = s.cellSize;
    const big = !!bigWinRef.current;
    const color = big ? 0xfbbf24 : 0xa3e635;

    // Per-cell highlight ring.
    cells.forEach((id) => {
      const [rStr, rowStr] = String(id).split(':');
      const r = Number(rStr);
      const row = Number(rowStr);
      if (!Number.isFinite(r) || !Number.isFinite(row)) return;
      const reel = s.reels[r];
      if (!reel) return;
      const x = reel.x;
      const y = row * cellSize;
      overlay.lineStyle({ width: 3, color, alpha: 0.95 });
      overlay.beginFill(color, 0.12);
      overlay.drawRoundedRect(x + 4, y + 4, cellSize - 8, cellSize - 8, 8);
      overlay.endFill();
      overlay.lineStyle();
    });

    // Polyline across reels in each row that has a hit.
    const rowsHit = new Map();
    cells.forEach((id) => {
      const [rStr, rowStr] = String(id).split(':');
      const row = Number(rowStr);
      const r = Number(rStr);
      if (!Number.isFinite(row) || !Number.isFinite(r)) return;
      if (!rowsHit.has(row)) rowsHit.set(row, []);
      rowsHit.get(row).push(r);
    });
    rowsHit.forEach((reelIdxs, row) => {
      if (reelIdxs.length < 2) return;
      reelIdxs.sort((a, b) => a - b);
      overlay.lineStyle({ width: 4, color, alpha: 0.85 });
      let started = false;
      for (const r of reelIdxs) {
        const reel = s.reels[r];
        if (!reel) continue;
        const cx = reel.x + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;
        if (!started) {
          overlay.moveTo(cx, cy);
          started = true;
        } else {
          overlay.lineTo(cx, cy);
        }
      }
      overlay.lineStyle();
    });
  }, []);

  // Layout helper — recomputes board geometry on resize.
  const layout = useCallback((width, height) => {
    const s = sceneRef.current;
    if (!s.app) return;
    const margin = Math.min(width, height) * 0.04;
    const usableW = Math.max(80, width - margin * 2);
    const usableH = Math.max(80, height - margin * 2);
    const cellSize = Math.min(usableW / REELS, usableH / ROWS);
    s.cellSize = cellSize;
    s.boardWidth = cellSize * REELS;
    s.boardHeight = cellSize * ROWS;

    const offsetX = (width - s.boardWidth) / 2;
    const offsetY = (height - s.boardHeight) / 2;

    // Reposition reel strips.
    s.reels.forEach((reel, i) => {
      reel.x = offsetX + i * cellSize;
      reel.strip.x = reel.x;
      // Visible window: rows 0..2 shown; strip.y placed so the bottom of the
      // strip aligns with the visible window when at rest.
      reel.strip.y = offsetY - (STRIP_LENGTH - ROWS) * cellSize;
      reel.restY = reel.strip.y;
      // Rebuild sprites at the new cell size.
      rebuildStrip(i, reel.keys || buildRandomStripKeys());
    });

    // Re-mask the reel area.
    if (s.reelMaskGfx) {
      s.reelMaskGfx.clear();
      s.reelMaskGfx.beginFill(0xffffff);
      s.reelMaskGfx.drawRoundedRect(offsetX, offsetY, s.boardWidth, s.boardHeight, 12);
      s.reelMaskGfx.endFill();
    }

    drawWinOverlay();

    // Resize flash overlay.
    if (s.flashOverlay) {
      s.flashOverlay.clear();
      s.flashOverlay.beginFill(0xffffff, 1);
      s.flashOverlay.drawRect(0, 0, width, height);
      s.flashOverlay.endFill();
    }
  }, [rebuildStrip, drawWinOverlay]);

  // Build the scene once.
  const handleReady = useCallback(
    (app, { width, height }) => {
      const s = sceneRef.current;
      s.app = app;

      // Background panel for the reel area.
      const bg = new PIXI.Graphics();
      bg.beginFill(0x0a0b14, 0.85);
      bg.lineStyle({ width: 2, color: 0xfbbf24, alpha: 0.25 });
      bg.drawRoundedRect(0, 0, width, height, 16);
      bg.endFill();
      app.stage.addChild(bg);

      // Reel mask — clips the strips to the visible 5×3 window.
      const mask = new PIXI.Graphics();
      s.reelMaskGfx = mask;
      app.stage.addChild(mask);

      // Per-reel container with its own strip + blur filter.
      s.reels = [];
      for (let i = 0; i < REELS; i++) {
        const strip = new PIXI.Container();
        strip.mask = mask;
        app.stage.addChild(strip);
        let blur = null;
        try {
          blur = new PIXI.BlurFilter(0, 4);
          blur.blurX = 0;
          blur.blurY = 0;
          blur.padding = 8;
          strip.filters = [blur];
        } catch {
          /* BlurFilter unavailable — skip */
        }
        s.reels.push({
          strip,
          sprites: [],
          keys: buildRandomStripKeys(),
          blur,
          x: 0,
          restY: 0,
        });
      }

      // Win overlay sits on top of the reels (also masked so glows don't bleed).
      const winOverlay = new PIXI.Graphics();
      winOverlay.mask = mask;
      app.stage.addChild(winOverlay);
      s.winOverlay = winOverlay;

      // Full-board flash overlay (above everything, alpha animated).
      const flash = new PIXI.Graphics();
      flash.alpha = 0;
      app.stage.addChild(flash);
      s.flashOverlay = flash;

      layout(width, height);

      return () => {
        killAllTweens();
      };
    },
    [layout, killAllTweens],
  );

  const handleResize = useCallback(
    (_app, { width, height }) => {
      layout(width, height);
    },
    [layout],
  );

  // Apply incoming resolved reels when not spinning (idle prop updates).
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.app || spinningRef.current) return;
    if (!Array.isArray(reels) || reels.length === 0) return;
    for (let i = 0; i < REELS; i++) {
      const col = Array.isArray(reels[i]) ? reels[i] : [];
      const visible = [0, 1, 2].map((row) => normalizeSymbolKey(col[row]));
      const stripKeys = buildResolvedStripKeys(visible);
      rebuildStrip(i, stripKeys);
      const reel = s.reels[i];
      if (reel) {
        reel.strip.y = reel.restY;
      }
    }
    drawWinOverlay();
  }, [reels, rebuildStrip, drawWinOverlay]);

  // Redraw the win overlay whenever the highlighted set changes.
  useEffect(() => {
    drawWinOverlay();
  }, [winningCells, bigWin, drawWinOverlay]);

  // Spin lifecycle: kicks off staggered reel tweens + blur ramps.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.app || s.reels.length === 0) return undefined;
    if (!spinning) {
      spinningRef.current = false;
      return undefined;
    }
    if (spinningRef.current) return undefined;
    spinningRef.current = true;

    killAllTweens();

    // Build resolved strips for each reel (final 3 rows = the server outcome).
    const resolved = Array.isArray(reelsDataRef.current) ? reelsDataRef.current : [];
    for (let i = 0; i < REELS; i++) {
      const col = Array.isArray(resolved[i]) ? resolved[i] : [];
      const visible = [0, 1, 2].map((row) => normalizeSymbolKey(col[row]));
      const stripKeys = buildResolvedStripKeys(visible);
      rebuildStrip(i, stripKeys);
      const reel = s.reels[i];
      if (!reel) continue;
      // Start the strip ABOVE its rest position so it falls into place.
      reel.strip.y = reel.restY - (STRIP_LENGTH - ROWS) * s.cellSize * 1.5;
    }

    // Reduced motion: snap to rest and finish.
    if (reducedRef.current) {
      for (let i = 0; i < REELS; i++) {
        const reel = s.reels[i];
        if (reel) reel.strip.y = reel.restY;
      }
      spinningRef.current = false;
      onSpinCompleteRef.current?.();
      return undefined;
    }

    // Reset blurs.
    for (let i = 0; i < REELS; i++) {
      const reel = s.reels[i];
      if (reel?.blur) {
        reel.blur.blurY = 0;
        reel.blur.blurX = 0;
      }
    }

    let finished = 0;
    const onReelDone = () => {
      finished += 1;
      if (finished >= REELS) {
        spinningRef.current = false;
        // Fade-in for the win overlay (drawn by the parent via prop update).
        if (s.winOverlay) {
          s.winOverlay.alpha = 0;
          drawWinOverlay();
          try {
            winFadeTweenRef.current?.kill();
          } catch {
            /* ignore */
          }
          winFadeTweenRef.current = gsap.to(s.winOverlay, {
            alpha: 1,
            duration: 0.4,
            ease: 'power2.out',
          });
        }
        // Big-win cinematic.
        if (bigWinRef.current && s.flashOverlay) {
          try {
            flashTweenRef.current?.kill();
          } catch {
            /* ignore */
          }
          s.flashOverlay.alpha = 0;
          flashTweenRef.current = gsap.timeline()
            .to(s.flashOverlay, { alpha: 0.55, duration: 0.18, ease: 'power2.out' })
            .to(s.flashOverlay, { alpha: 0, duration: 0.5, ease: 'power2.in' });
        }
        onSpinCompleteRef.current?.();
      }
    };

    for (let i = 0; i < REELS; i++) {
      const reel = s.reels[i];
      if (!reel) continue;
      const duration = STAGGER_BASE + i * STAGGER_STEP;
      // Stagger the tick sound.
      const tickDelay = i * 0.08;
      window.setTimeout(() => {
        playRef.current?.('spin-tick');
      }, Math.floor(tickDelay * 1000));

      // Blur ramp: 0 → 16 → 0 over the reel's spin window.
      if (reel.blur) {
        const blurTl = gsap.timeline()
          .to(reel.blur, { blurY: 16, duration: duration * 0.45, ease: 'power1.in' })
          .to(reel.blur, { blurY: 0, duration: duration * 0.55, ease: 'power3.out' });
        blurTweensRef.current.push(blurTl);
      }

      // Position tween — snap to restY with overshoot.
      const tween = gsap.to(reel.strip, {
        y: reel.restY,
        duration,
        ease: 'back.out(1.1)',
        onComplete: onReelDone,
      });
      tweensRef.current.push(tween);
    }

    return undefined;
  }, [spinning, killAllTweens, rebuildStrip, drawWinOverlay]);

  // Tear down everything on unmount.
  useEffect(
    () => () => {
      killAllTweens();
    },
    [killAllTweens],
  );

  return (
    <PixiStage
      onReady={handleReady}
      onResize={handleResize}
      aspectRatio={5 / 3}
      ariaLabel="Slots reels with 5 columns and 3 rows"
      className="mx-auto w-full max-w-3xl"
    />
  );
};

export default SlotsBoard;
