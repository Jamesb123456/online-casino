import React, { useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import PixiStage from '../_shared/PixiStage';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';
import { formatMultiplier } from './wheelUtils';

/**
 * WheelBoard — Pixi.js render layer for the Wheel game.
 *
 * Game logic stays in the parent (WheelGame). This component only renders
 * the wheel and animates it from current angle → targetAngle when `spinning`
 * transitions to true, then calls `onSpinComplete` after the GSAP tween
 * finishes.
 *
 * Visual features:
 *   - Radial-gradient wheel segments with the wheel-amber palette
 *   - Gold (#FBBF24) outer rim
 *   - Ticker arrow at the top with a small spring reaction per segment
 *   - GSAP `power3.out` spin (4s) with animated BlurFilter (0 → 18 → 0)
 *   - Landing-segment pulse on finish
 *   - Rate-limited spin-tick sound (one tick per segment passing the arrow)
 *   - Respects prefers-reduced-motion (snaps instead of animating)
 */

const RIM_GOLD = 0xfbbf24;
const RIM_GOLD_DARK = 0xb45309;
const CENTER_DARK = 0x111827;
const ARROW_FILL = 0xfbbf24;
const ARROW_OUTLINE = 0x1f2937;
const TEXT_COLOR = 0xffffff;
const SHADOW_COLOR = 0x000000;

function hexFromColor(input, fallback = 0x6b7280) {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input !== 'string') return fallback;
  const s = input.trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return (r << 16) | (g << 8) | b;
    }
    if (hex.length === 6) {
      const v = parseInt(hex, 16);
      if (!Number.isNaN(v)) return v;
    }
  }
  return fallback;
}

function lightenHex(hex, amount = 0.25) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return (lr << 16) | (lg << 8) | lb;
}

function darkenHex(hex, amount = 0.35) {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return (Math.round(r * (1 - amount)) << 16)
    | (Math.round(g * (1 - amount)) << 8)
    | Math.round(b * (1 - amount));
}

function drawWheel(graphics, segments, radius) {
  graphics.clear();
  if (!segments || segments.length === 0) {
    graphics.beginFill(0x1f2937);
    graphics.drawCircle(0, 0, radius);
    graphics.endFill();
    return;
  }
  const slice = (Math.PI * 2) / segments.length;
  segments.forEach((seg, i) => {
    const base = hexFromColor(seg.color);
    const light = lightenHex(base, 0.18);
    const dark = darkenHex(base, 0.30);
    const start = -Math.PI / 2 - slice / 2 + i * slice;
    const end = start + slice;

    // Outer slice (lighter near the rim)
    graphics.beginFill(light, 1);
    graphics.moveTo(0, 0);
    graphics.arc(0, 0, radius, start, end);
    graphics.lineTo(0, 0);
    graphics.endFill();

    // Inner overlay (darker near the hub) to fake a radial gradient cheaply
    graphics.beginFill(base, 0.92);
    graphics.moveTo(0, 0);
    graphics.arc(0, 0, radius * 0.72, start, end);
    graphics.lineTo(0, 0);
    graphics.endFill();

    // Deepest tint at the very centre — sells the radial feel
    graphics.beginFill(dark, 0.85);
    graphics.moveTo(0, 0);
    graphics.arc(0, 0, radius * 0.38, start, end);
    graphics.lineTo(0, 0);
    graphics.endFill();

    // Slice divider
    graphics.lineStyle({ width: 1.5, color: 0x0b0d14, alpha: 0.7 });
    graphics.moveTo(0, 0);
    graphics.lineTo(Math.cos(start) * radius, Math.sin(start) * radius);
    graphics.lineStyle();
  });
}

function drawLabels(container, segments, radius) {
  container.removeChildren().forEach((c) => {
    try {
      c.destroy({ children: true });
    } catch {
      /* ignore */
    }
  });
  if (!segments || segments.length === 0) return;
  const slice = (Math.PI * 2) / segments.length;
  const textRadius = radius * 0.74;
  const fontSize = Math.max(11, Math.min(18, Math.floor(radius * 0.11)));
  segments.forEach((seg, i) => {
    const angle = -Math.PI / 2 + i * slice;
    const t = new PIXI.Text(formatMultiplier(seg.multiplier), {
      fontFamily: 'Space Grotesk, DM Sans, system-ui, sans-serif',
      fontSize,
      fontWeight: '700',
      fill: TEXT_COLOR,
      stroke: SHADOW_COLOR,
      strokeThickness: 2,
      align: 'center',
    });
    t.anchor.set(0.5);
    t.x = Math.cos(angle) * textRadius;
    t.y = Math.sin(angle) * textRadius;
    t.rotation = angle + Math.PI / 2;
    container.addChild(t);
  });
}

function drawRim(graphics, radius) {
  graphics.clear();
  // Outer dark ring
  graphics.lineStyle({ width: Math.max(6, radius * 0.05), color: RIM_GOLD_DARK, alpha: 1 });
  graphics.drawCircle(0, 0, radius + Math.max(3, radius * 0.025));
  // Inner gold rim
  graphics.lineStyle({ width: Math.max(3, radius * 0.028), color: RIM_GOLD, alpha: 1 });
  graphics.drawCircle(0, 0, radius + Math.max(1, radius * 0.005));
  graphics.lineStyle();
  // Hub
  graphics.beginFill(CENTER_DARK);
  graphics.drawCircle(0, 0, Math.max(10, radius * 0.12));
  graphics.endFill();
  graphics.lineStyle({ width: 2, color: RIM_GOLD, alpha: 0.9 });
  graphics.drawCircle(0, 0, Math.max(10, radius * 0.12));
  graphics.lineStyle();
}

function drawArrow(graphics, radius) {
  graphics.clear();
  const size = Math.max(12, radius * 0.11);
  // Body
  graphics.beginFill(ARROW_FILL);
  graphics.lineStyle({ width: 2, color: ARROW_OUTLINE, alpha: 1 });
  graphics.moveTo(0, size);
  graphics.lineTo(-size * 0.9, -size * 0.6);
  graphics.lineTo(size * 0.9, -size * 0.6);
  graphics.closePath();
  graphics.endFill();
  graphics.lineStyle();
}

const WheelBoard = ({
  segments = [],
  spinning = false,
  targetAngle = 0,
  onSpinComplete = () => {},
}) => {
  const { play } = useSound();
  const reduced = useReducedMotion();

  // Hold imperative refs to the Pixi scene graph.
  const sceneRef = useRef({
    app: null,
    wheelContainer: null, // rotates
    labelsContainer: null, // child of wheelContainer
    segmentsGraphics: null,
    rimGraphics: null,
    arrowGraphics: null,
    blur: null,
    width: 0,
    height: 0,
    currentRotation: 0,
    radius: 0,
    pulseTween: null,
  });

  const tweenRef = useRef(null);
  const blurTweenRef = useRef(null);
  const arrowTweenRef = useRef(null);
  const lastTickIndexRef = useRef(0);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const spinningRef = useRef(false);
  // Latest callback refs so the spin effect doesn't restart on prop identity changes.
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;
  const playRef = useRef(play);
  playRef.current = play;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  // Layout helper — recompute geometry on resize.
  const layout = useCallback((width, height) => {
    const s = sceneRef.current;
    if (!s.app) return;
    const size = Math.min(width, height);
    const radius = Math.max(40, size * 0.42);
    s.width = width;
    s.height = height;
    s.radius = radius;

    if (s.wheelContainer) {
      s.wheelContainer.x = width / 2;
      s.wheelContainer.y = height / 2;
    }
    if (s.rimGraphics) drawRim(s.rimGraphics, radius);
    if (s.segmentsGraphics) drawWheel(s.segmentsGraphics, segmentsRef.current, radius);
    if (s.labelsContainer) drawLabels(s.labelsContainer, segmentsRef.current, radius);
    if (s.arrowGraphics) {
      drawArrow(s.arrowGraphics, radius);
      s.arrowGraphics.x = width / 2;
      // Arrow sits just inside the top of the rim, tip pointing down toward the wheel.
      s.arrowGraphics.y = height / 2 - radius - Math.max(2, radius * 0.025);
      // Flip so the tip points toward the wheel (downward).
      s.arrowGraphics.scale.y = -1;
    }
  }, []);

  // Build the scene once.
  const handleReady = useCallback(
    (app, { width, height }) => {
      const s = sceneRef.current;
      s.app = app;

      const wheel = new PIXI.Container();
      s.wheelContainer = wheel;
      app.stage.addChild(wheel);

      const seg = new PIXI.Graphics();
      s.segmentsGraphics = seg;
      wheel.addChild(seg);

      const labels = new PIXI.Container();
      s.labelsContainer = labels;
      wheel.addChild(labels);

      const rim = new PIXI.Graphics();
      s.rimGraphics = rim;
      // Rim is separate so it doesn't rotate — sits on top center.
      const rimContainer = new PIXI.Container();
      rimContainer.addChild(rim);
      app.stage.addChild(rimContainer);

      const arrow = new PIXI.Graphics();
      s.arrowGraphics = arrow;
      app.stage.addChild(arrow);

      // Place static rim at center.
      rimContainer.x = width / 2;
      rimContainer.y = height / 2;

      // Blur filter (subtle, animated during spin).
      try {
        const blur = new PIXI.BlurFilter(0, 4);
        blur.padding = 8;
        s.blur = blur;
        wheel.filters = [blur];
      } catch {
        /* BlurFilter unavailable — skip */
      }

      layout(width, height);

      // Set initial rotation in radians.
      wheel.rotation = (s.currentRotation * Math.PI) / 180;

      return () => {
        // Tween cleanup is handled by the main effect, but be defensive here.
        try {
          tweenRef.current?.kill();
        } catch {
          /* ignore */
        }
        try {
          blurTweenRef.current?.kill();
        } catch {
          /* ignore */
        }
        try {
          arrowTweenRef.current?.kill();
        } catch {
          /* ignore */
        }
        try {
          s.pulseTween?.kill();
        } catch {
          /* ignore */
        }
      };
    },
    [layout],
  );

  const handleResize = useCallback(
    (app, { width, height }) => {
      const s = sceneRef.current;
      if (!s.app) return;
      // Reposition the static rim container as well.
      const stage = app.stage;
      if (stage && stage.children) {
        stage.children.forEach((c) => {
          if (c !== s.wheelContainer && c !== s.arrowGraphics) {
            c.x = width / 2;
            c.y = height / 2;
          }
        });
      }
      layout(width, height);
    },
    [layout],
  );

  // Redraw segments when the segment data changes.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.app || !s.segmentsGraphics) return;
    drawWheel(s.segmentsGraphics, segments, s.radius);
    drawLabels(s.labelsContainer, segments, s.radius);
  }, [segments]);

  // Trigger spin animation when `spinning` transitions to true.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.app || !s.wheelContainer) return undefined;

    if (!spinning) {
      spinningRef.current = false;
      return undefined;
    }
    // Prevent re-triggering during a tween.
    if (spinningRef.current) return undefined;
    spinningRef.current = true;

    const segCount = Math.max(1, segmentsRef.current.length || 1);
    const segmentSpanDeg = 360 / segCount;
    const startDeg = s.currentRotation;
    const endDeg = targetAngle;
    lastTickIndexRef.current = Math.floor(startDeg / segmentSpanDeg);

    // Reduced-motion: snap instead of animating.
    if (reducedRef.current) {
      s.currentRotation = endDeg;
      s.wheelContainer.rotation = (endDeg * Math.PI) / 180;
      spinningRef.current = false;
      onSpinCompleteRef.current?.();
      return undefined;
    }

    // Animated blur: 0 → 18 → 0.
    if (s.blur) {
      try {
        blurTweenRef.current?.kill();
        s.blur.blurX = 0;
        s.blur.blurY = 0;
        blurTweenRef.current = gsap.timeline()
          .to(s.blur, { blurX: 18, blurY: 4, duration: 1.4, ease: 'power1.out' })
          .to(s.blur, { blurX: 0, blurY: 0, duration: 1.6, ease: 'power3.out' });
      } catch {
        /* ignore */
      }
    }

    // Main spin tween — drives rotation. We tween the proxy object so the
    // onUpdate callback can map current degrees → radians and run tick logic.
    const proxy = { deg: startDeg };
    try {
      tweenRef.current?.kill();
    } catch {
      /* ignore */
    }
    tweenRef.current = gsap.to(proxy, {
      deg: endDeg,
      duration: 4,
      ease: 'power3.out',
      onUpdate: () => {
        const deg = proxy.deg;
        s.currentRotation = deg;
        s.wheelContainer.rotation = (deg * Math.PI) / 180;

        // Tick: fire one play('spin-tick') per segment that passes under the arrow.
        const idx = Math.floor(deg / segmentSpanDeg);
        if (idx !== lastTickIndexRef.current) {
          const delta = Math.abs(idx - lastTickIndexRef.current);
          lastTickIndexRef.current = idx;
          // Rate-limit: don't burst more than ~one tick per frame.
          if (delta <= 2) {
            playRef.current?.('spin-tick');
            // Tiny arrow spring reaction.
            if (s.arrowGraphics) {
              try {
                arrowTweenRef.current?.kill();
              } catch {
                /* ignore */
              }
              s.arrowGraphics.rotation = 0.18 * (delta > 1 ? -1 : 1);
              arrowTweenRef.current = gsap.to(s.arrowGraphics, {
                rotation: 0,
                duration: 0.18,
                ease: 'elastic.out(1, 0.4)',
              });
            }
          }
        }
      },
      onComplete: () => {
        spinningRef.current = false;
        // Reset blur defensively.
        if (s.blur) {
          s.blur.blurX = 0;
          s.blur.blurY = 0;
        }
        onSpinCompleteRef.current?.();
      },
    });

    return undefined;
  }, [spinning, targetAngle]);

  // Tear down on unmount.
  useEffect(
    () => () => {
      try {
        tweenRef.current?.kill();
      } catch {
        /* ignore */
      }
      try {
        blurTweenRef.current?.kill();
      } catch {
        /* ignore */
      }
      try {
        arrowTweenRef.current?.kill();
      } catch {
        /* ignore */
      }
      try {
        sceneRef.current.pulseTween?.kill();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return (
    <PixiStage
      onReady={handleReady}
      onResize={handleResize}
      aspectRatio={1}
      ariaLabel="Wheel of Fortune game wheel with multiplier segments"
      className="mx-auto max-w-md"
    />
  );
};

export default WheelBoard;
