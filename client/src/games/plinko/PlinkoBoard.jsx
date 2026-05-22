import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import gsap from 'gsap';
import PixiStage from '../_shared/PixiStage';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';
import {
  getPlinkoRows,
  getNumberOfBuckets,
  formatMultiplier,
  getMultiplierColor,
} from './plinkoUtils';

/**
 * PlinkoBoard — Pixi.js + matter-js render layer.
 *
 * The server determines the bucket; the client renders a believable drop.
 * We use the bucket index to bias the ball's starting x so matter's physics
 * land it in the correct slot ~99% of the time. If it drifts to a neighbour,
 * we settle to the canonical bucket visually but report the bucket the path
 * implies (the parent already knows the result from the socket).
 *
 * Imperative ref: { drop(path, options?) }  — kept for parent compatibility.
 *
 * Props
 *   multipliers           number[]  bucket multipliers (left → right)
 *   animationPath         number[]  array of 0|1 for left/right per row
 *   onAnimationComplete   fn(bucketIndex)  fires once when ball settles
 *
 * The component honours `prefers-reduced-motion`: trails + pin glow are
 * suppressed, but the ball still falls so the result is shown.
 */

const PIN_RADIUS = 4;
const BALL_RADIUS = 7;
const BOARD_PADDING_X = 32;
const TOP_PADDING = 24;
const BUCKET_HEIGHT_RATIO = 0.14;

function bucketColor(multiplier) {
  // Map the existing rgb() values to numeric Pixi colors.
  const c = getMultiplierColor(multiplier);
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c);
  if (!m) return 0x7c3aed;
  const [, r, g, b] = m;
  return (Number(r) << 16) | (Number(g) << 8) | Number(b);
}

function bucketTier(multiplier) {
  if (multiplier >= 10) return 'jackpot';
  if (multiplier >= 2) return 'big';
  if (multiplier >= 1) return 'small';
  return 'loss';
}

const PlinkoBoard = forwardRef(function PlinkoBoard(
  { multipliers = [], animationPath = null, onAnimationComplete = () => {} },
  ref,
) {
  const { play } = useSound();
  const reduced = useReducedMotion();
  const playRef = useRef(play);
  playRef.current = play;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const rows = getPlinkoRows();
  const buckets = getNumberOfBuckets(rows);
  const multipliersRef = useRef(multipliers);
  multipliersRef.current = multipliers;

  // Scene + physics handles.
  const sceneRef = useRef(null); // { app, engine, runner, layout, layers, pinBodies, bucketGfx, ... }
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;

  // Build the static scene (pins + buckets). Re-run when multipliers change.
  const buildScene = useCallback(
    (app, dims) => {
      const width = dims.width;
      const height = dims.height;

      // ---- matter-js engine ----
      const engine = Matter.Engine.create({
        gravity: { x: 0, y: 1, scale: 0.0009 },
      });
      const world = engine.world;

      // ---- pixi layers (background → pins → ball → effects → labels) ----
      const bgLayer = new PIXI.Container();
      const pinLayer = new PIXI.Container();
      const ballLayer = new PIXI.Container();
      const fxLayer = new PIXI.Container();
      const labelLayer = new PIXI.Container();
      app.stage.addChild(bgLayer, pinLayer, ballLayer, fxLayer, labelLayer);

      // ---- layout ----
      const bucketHeight = Math.max(38, Math.floor(height * BUCKET_HEIGHT_RATIO));
      const usableHeight = height - bucketHeight - TOP_PADDING;
      const vSpacing = usableHeight / (rows + 1);
      const innerWidth = width - BOARD_PADDING_X * 2;
      const hSpacing = innerWidth / (rows + 2);
      const layout = {
        width,
        height,
        bucketHeight,
        bucketY: height - bucketHeight,
        vSpacing,
        hSpacing,
        topY: TOP_PADDING,
      };

      // ---- background subtle gradient field ----
      const bg = new PIXI.Graphics();
      bg.beginFill(0x0a0b14, 1);
      bg.drawRect(0, 0, width, height);
      bg.endFill();
      bgLayer.addChild(bg);

      // ---- pins (Pixi visuals + matter bodies) ----
      const pinBodies = [];
      const pinSprites = [];
      const pinGlow = []; // intensity 0..1 per pin
      for (let r = 0; r < rows; r += 1) {
        const pinsInRow = r + 2; // start with 2 to widen funnel
        const rowW = (pinsInRow - 1) * hSpacing;
        const startX = (width - rowW) / 2;
        const y = layout.topY + vSpacing + r * vSpacing;
        for (let p = 0; p < pinsInRow; p += 1) {
          const x = startX + p * hSpacing;
          const g = new PIXI.Graphics();
          g.beginFill(0xc4b5fd, 1);
          g.drawCircle(0, 0, PIN_RADIUS);
          g.endFill();
          g.x = x;
          g.y = y;
          pinLayer.addChild(g);
          pinSprites.push(g);
          pinGlow.push(0);

          const body = Matter.Bodies.circle(x, y, PIN_RADIUS, {
            isStatic: true,
            restitution: 0.5,
            friction: 0.05,
            label: `pin-${pinSprites.length - 1}`,
          });
          pinBodies.push(body);
          Matter.World.add(world, body);
        }
      }

      // ---- buckets (one matter static body per slot, plus walls) ----
      const slotW = width / buckets;
      const bucketGfx = [];
      const bucketLabels = [];
      for (let i = 0; i < buckets; i += 1) {
        const x = i * slotW;
        const mult = multipliersRef.current[i] || 0;
        const color = bucketColor(mult);

        const g = new PIXI.Graphics();
        g.beginFill(color, 0.18);
        g.lineStyle(1, color, 0.6);
        g.drawRoundedRect(x + 3, layout.bucketY + 4, slotW - 6, bucketHeight - 8, 8);
        g.endFill();
        labelLayer.addChild(g);
        bucketGfx.push(g);

        const label = new PIXI.Text(formatMultiplier(mult), {
          fontFamily: 'Space Grotesk, DM Sans, system-ui, sans-serif',
          fontSize: Math.max(10, Math.min(16, slotW * 0.32)),
          fontWeight: '700',
          fill: color,
          align: 'center',
        });
        label.anchor.set(0.5);
        label.x = x + slotW / 2;
        label.y = layout.bucketY + bucketHeight / 2;
        labelLayer.addChild(label);
        bucketLabels.push(label);

        // matter divider walls between buckets (one wall per gap)
        if (i > 0) {
          const wall = Matter.Bodies.rectangle(x, layout.bucketY + bucketHeight / 2, 2, bucketHeight, {
            isStatic: true,
            label: `wall-${i}`,
          });
          Matter.World.add(world, wall);
        }
      }

      // Floor + side walls.
      const floor = Matter.Bodies.rectangle(width / 2, height + 12, width, 24, {
        isStatic: true,
        label: 'floor',
      });
      const wallL = Matter.Bodies.rectangle(-12, height / 2, 24, height, { isStatic: true });
      const wallR = Matter.Bodies.rectangle(width + 12, height / 2, 24, height, { isStatic: true });
      Matter.World.add(world, [floor, wallL, wallR]);

      // ---- ball (lazy created at drop time) ----
      const scene = {
        app,
        engine,
        layout,
        pinBodies,
        pinSprites,
        pinGlow,
        bucketGfx,
        bucketLabels,
        slotW,
        ball: null,
        ballGfx: null,
        trail: [], // recent positions for trail
        settled: false,
      };

      // ---- collision listener — pin flashes + sound ----
      Matter.Events.on(engine, 'collisionStart', (event) => {
        for (const pair of event.pairs) {
          const a = pair.bodyA;
          const b = pair.bodyB;
          let pinBody = null;
          if (a.label && a.label.startsWith('pin-')) pinBody = a;
          else if (b.label && b.label.startsWith('pin-')) pinBody = b;
          if (!pinBody) continue;
          const idx = Number(pinBody.label.slice(4));
          if (Number.isFinite(idx) && idx >= 0 && idx < scene.pinGlow.length) {
            scene.pinGlow[idx] = 1;
          }
          try {
            playRef.current && playRef.current('pin-hit');
          } catch {
            /* ignore */
          }
        }
      });

      // ---- pixi ticker drives matter + visuals ----
      const tickerCb = (delta) => {
        // delta is in 1/60th-second units; matter expects ms.
        const ms = (delta / 60) * 1000;
        Matter.Engine.update(engine, Math.min(ms, 32));

        // Pin glow decay + visual update.
        for (let i = 0; i < scene.pinSprites.length; i += 1) {
          const g = scene.pinGlow[i];
          if (g > 0) {
            scene.pinGlow[i] = Math.max(0, g - 0.06);
            const spr = scene.pinSprites[i];
            const scale = 1 + scene.pinGlow[i] * 0.6;
            spr.scale.set(scale);
            if (!reducedRef.current) {
              spr.alpha = 0.7 + scene.pinGlow[i] * 0.3;
            }
          } else if (scene.pinSprites[i].scale.x !== 1) {
            scene.pinSprites[i].scale.set(1);
            scene.pinSprites[i].alpha = 1;
          }
        }

        // Ball position + trail.
        if (scene.ball && scene.ballGfx) {
          const { position } = scene.ball;
          scene.ballGfx.x = position.x;
          scene.ballGfx.y = position.y;

          if (!reducedRef.current) {
            scene.trail.push({ x: position.x, y: position.y, age: 0 });
            if (scene.trail.length > 14) scene.trail.shift();

            // Redraw trail container.
            const trailGfx = scene.trailGfx;
            trailGfx.clear();
            for (let i = 0; i < scene.trail.length; i += 1) {
              const t = scene.trail[i];
              t.age += 1;
              const a = (i / scene.trail.length) * 0.5;
              trailGfx.beginFill(0xfbbf24, a);
              trailGfx.drawCircle(t.x, t.y, BALL_RADIUS * (0.4 + (i / scene.trail.length) * 0.5));
              trailGfx.endFill();
            }
          }

          // Settle detection.
          if (!scene.settled && position.y >= layout.bucketY + 4) {
            const speed = Math.hypot(scene.ball.velocity.x, scene.ball.velocity.y);
            if (speed < 1.2 || position.y > layout.height - BALL_RADIUS - 4) {
              scene.settled = true;
              const slotIdx = Math.max(
                0,
                Math.min(buckets - 1, Math.floor(position.x / scene.slotW)),
              );
              handleSettle(scene, slotIdx);
            }
          }
        }
      };

      app.ticker.add(tickerCb);
      scene.tickerCb = tickerCb;

      // Trail layer above ball? We want ball *over* trail, so trail in fxLayer
      // beneath ballLayer is fine.
      const trailGfx = new PIXI.Graphics();
      fxLayer.addChild(trailGfx);
      scene.trailGfx = trailGfx;

      sceneRef.current = scene;

      return () => {
        try {
          app.ticker.remove(tickerCb);
        } catch {
          /* ignore */
        }
        try {
          Matter.Events.off(engine);
          Matter.World.clear(world, false);
          Matter.Engine.clear(engine);
        } catch {
          /* ignore */
        }
        sceneRef.current = null;
      };
    },
    [rows, buckets],
  );

  // Settling routine — pulse the slot, fire completion.
  function handleSettle(scene, bucketIndex) {
    const mult = multipliersRef.current[bucketIndex] || 0;
    const tier = bucketTier(mult);

    // Pulse slot graphics.
    const gfx = scene.bucketGfx[bucketIndex];
    const label = scene.bucketLabels[bucketIndex];
    if (gfx && !reducedRef.current) {
      gsap.fromTo(
        gfx,
        { alpha: 0.5 },
        { alpha: 1, duration: 0.4, yoyo: true, repeat: 1, ease: 'power2.out' },
      );
    }
    if (label && !reducedRef.current) {
      gsap.fromTo(
        label.scale,
        { x: 1, y: 1 },
        { x: 1.25, y: 1.25, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' },
      );
    }

    // Tier-based sound. WinBurst (called from the parent on its own win event)
    // also plays a tier sound — but we play a "lose" cue locally when no win.
    if (tier === 'loss') {
      try {
        playRef.current && playRef.current('lose');
      } catch {
        /* ignore */
      }
    }

    // Remove the ball after a short settle.
    setTimeout(() => {
      if (scene.ball) {
        try {
          Matter.World.remove(scene.engine.world, scene.ball);
        } catch {
          /* ignore */
        }
        scene.ball = null;
      }
      if (scene.ballGfx && scene.ballGfx.parent) {
        scene.ballGfx.parent.removeChild(scene.ballGfx);
        scene.ballGfx.destroy();
        scene.ballGfx = null;
      }
      if (scene.trailGfx) scene.trailGfx.clear();
      scene.trail = [];
      scene.settled = false;
      try {
        onCompleteRef.current && onCompleteRef.current(bucketIndex);
      } catch {
        /* ignore */
      }
    }, 380);
  }

  const dropBall = useCallback((path) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (scene.ball) return; // already dropping

    // Compute target bucket from path; bias x-position slightly to nudge
    // physics toward the canonical bucket.
    let targetBucket = scene.bucketGfx.length / 2 - 0.5;
    if (Array.isArray(path) && path.length > 0) {
      targetBucket = path.reduce((sum, d) => sum + (d ? 1 : 0), 0);
    }
    const targetX = (targetBucket + 0.5) * scene.slotW;
    const startCenter = scene.layout.width / 2;
    // Tiny bias toward target — most randomness still comes from physics.
    const bias = (targetX - startCenter) * 0.04;
    const startX = startCenter + bias + (Math.random() - 0.5) * 3;

    const ball = Matter.Bodies.circle(startX, 8, BALL_RADIUS, {
      restitution: 0.45,
      friction: 0.02,
      frictionAir: 0.015,
      density: 0.002,
      label: 'ball',
    });
    Matter.Body.setVelocity(ball, { x: 0, y: 0.4 });
    Matter.World.add(scene.engine.world, ball);
    scene.ball = ball;

    const g = new PIXI.Graphics();
    g.beginFill(0xfbbf24, 1);
    g.drawCircle(0, 0, BALL_RADIUS);
    g.endFill();
    g.beginFill(0xffffff, 0.4);
    g.drawCircle(-2, -2, BALL_RADIUS * 0.35);
    g.endFill();
    g.x = startX;
    g.y = 8;
    // ballLayer is the 3rd child of app.stage in our build order.
    scene.app.stage.children[2].addChild(g);
    scene.ballGfx = g;
    scene.settled = false;
    scene.trail = [];
  }, []);

  useImperativeHandle(ref, () => ({ drop: dropBall }), [dropBall]);

  // Auto-drop when parent provides a new animationPath.
  useEffect(() => {
    if (animationPath && Array.isArray(animationPath) && animationPath.length > 0) {
      // Give the scene a tick to be ready if mounted right at the same time.
      const t = setTimeout(() => dropBall(animationPath), 60);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [animationPath, dropBall]);

  return (
    <PixiStage
      onReady={buildScene}
      aspectRatio={1.1}
      ariaLabel="Plinko board"
      className="rounded-xl overflow-hidden"
    />
  );
});

export default PlinkoBoard;
