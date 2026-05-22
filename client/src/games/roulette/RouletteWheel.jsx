import React, { useCallback, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import PixiStage from '../_shared/PixiStage';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';
import { ROULETTE_NUMBERS } from './rouletteUtils';

/**
 * RouletteWheel — Pixi.js faux-3D render layer for the Roulette game.
 *
 * Visual contract (matches old Canvas2D version so RouletteGame consumes it
 * with the same prop names):
 *   - isSpinning  bool   when true, animation runs
 *   - spinData    obj    legacy phase metadata (ignored by new impl)
 *   - winningNumber int  pocket number to land on
 *   - showResult  bool   final landing flag (overlay shown when true & not spinning)
 *   - onSpinComplete fn  called once the GSAP timeline finishes
 *
 * Design notes:
 *   - Wheel rendered on a TILTED ellipse (sx:1, sy:0.62) to fake perspective.
 *   - Outer gold rim + inner pockets coloured per European wheel layout.
 *   - Ball orbits with a decaying radius and bounces into the final pocket via
 *     a bounce.out tail. Rotates OPPOSITE to wheel direction.
 *   - Total spin duration ~5.5s. Reduced motion → snap to result.
 */

const WHEEL_NUMBERS = ROULETTE_NUMBERS.map((n) => n.number);
const POCKET_COUNT = ROULETTE_NUMBERS.length || 37;

const RIM_GOLD = 0xfbbf24;
const RIM_GOLD_DARK = 0xb45309;
const RIM_VIOLET = 0x7c3aed;
const POCKET_RED = 0xdc2626;
const POCKET_BLACK = 0x1f2937;
const POCKET_GREEN = 0x059669;
const DIVIDER = 0xfde68a;
const HUB_DARK = 0x0b0d14;
const TEXT_COLOR = 0xffffff;
const SHADOW_COLOR = 0x000000;

function colorFor(color) {
  if (color === 'red') return POCKET_RED;
  if (color === 'black') return POCKET_BLACK;
  return POCKET_GREEN;
}

function drawWheel(graphics, radius) {
  graphics.clear();
  const slice = (Math.PI * 2) / POCKET_COUNT;

  // Outer rim background (radial — light gold to dark gold).
  graphics.beginFill(RIM_GOLD_DARK, 1);
  graphics.drawCircle(0, 0, radius + radius * 0.08);
  graphics.endFill();

  graphics.beginFill(RIM_GOLD, 1);
  graphics.drawCircle(0, 0, radius + radius * 0.04);
  graphics.endFill();

  // Violet shimmer ring just inside the rim.
  graphics.lineStyle({ width: Math.max(1.5, radius * 0.012), color: RIM_VIOLET, alpha: 0.55 });
  graphics.drawCircle(0, 0, radius + radius * 0.015);
  graphics.lineStyle();

  // Outer dark backdrop for pockets.
  graphics.beginFill(HUB_DARK, 1);
  graphics.drawCircle(0, 0, radius);
  graphics.endFill();

  // Pockets.
  for (let i = 0; i < POCKET_COUNT; i += 1) {
    const seg = ROULETTE_NUMBERS[i];
    const startAngle = -Math.PI / 2 + i * slice - slice / 2;
    const endAngle = startAngle + slice;
    graphics.beginFill(colorFor(seg.color), 1);
    graphics.moveTo(0, 0);
    graphics.arc(0, 0, radius * 0.96, startAngle, endAngle);
    graphics.lineTo(0, 0);
    graphics.endFill();
    // Divider line
    graphics.lineStyle({ width: 1, color: DIVIDER, alpha: 0.55 });
    graphics.moveTo(0, 0);
    graphics.lineTo(
      Math.cos(startAngle) * radius * 0.96,
      Math.sin(startAngle) * radius * 0.96,
    );
    graphics.lineStyle();
  }

  // Inner hub.
  graphics.beginFill(HUB_DARK, 1);
  graphics.drawCircle(0, 0, radius * 0.34);
  graphics.endFill();
  graphics.lineStyle({ width: Math.max(1.5, radius * 0.012), color: RIM_GOLD, alpha: 0.8 });
  graphics.drawCircle(0, 0, radius * 0.34);
  graphics.lineStyle();
}

function drawLabels(container, radius) {
  container.removeChildren().forEach((c) => {
    try {
      c.destroy({ children: true });
    } catch {
      /* ignore */
    }
  });
  const slice = (Math.PI * 2) / POCKET_COUNT;
  const textRadius = radius * 0.78;
  const fontSize = Math.max(9, Math.min(14, Math.floor(radius * 0.08)));
  for (let i = 0; i < POCKET_COUNT; i += 1) {
    const seg = ROULETTE_NUMBERS[i];
    const angle = -Math.PI / 2 + i * slice;
    const t = new PIXI.Text(String(seg.number), {
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
  }
}

function drawBall(graphics, ballRadius) {
  graphics.clear();
  // Soft glow under-circle.
  graphics.beginFill(0xffffff, 0.18);
  graphics.drawCircle(0, 0, ballRadius * 2.2);
  graphics.endFill();
  graphics.beginFill(0xffffff, 0.32);
  graphics.drawCircle(0, 0, ballRadius * 1.5);
  graphics.endFill();
  // Body
  graphics.beginFill(0xffffff, 1);
  graphics.drawCircle(0, 0, ballRadius);
  graphics.endFill();
  // Highlight
  graphics.beginFill(0xffffff, 1);
  graphics.drawCircle(-ballRadius * 0.35, -ballRadius * 0.35, ballRadius * 0.35);
  graphics.endFill();
}

function indexOfNumber(number) {
  if (number == null) return -1;
  const idx = WHEEL_NUMBERS.indexOf(Number(number));
  return idx;
}

const RouletteWheel = ({
  isSpinning = false,
  // eslint-disable-next-line no-unused-vars
  spinData = null,
  winningNumber = null,
  showResult = false,
  onSpinComplete = () => {},
}) => {
  const { play } = useSound();
  const reduced = useReducedMotion();

  const sceneRef = useRef({
    app: null,
    wheelContainer: null, // rotates (wheel + labels)
    wheelGraphics: null,
    labelsContainer: null,
    rimContainer: null, // static rim glow
    ballPivot: null, // rotates ball around centre
    ball: null,
    radius: 0,
    width: 0,
    height: 0,
    currentWheelRotation: 0,
  });

  const spinTimelineRef = useRef(null);
  const tickTimerRef = useRef(null);
  const spinningRef = useRef(false);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;
  const playRef = useRef(play);
  playRef.current = play;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const winningNumberRef = useRef(winningNumber);
  winningNumberRef.current = winningNumber;

  // Layout & redraw geometry.
  const layout = useCallback((width, height) => {
    const s = sceneRef.current;
    if (!s.app) return;
    // Faux-3D tilt: container.scale.y < 1.
    const size = Math.min(width, height);
    const radius = Math.max(60, size * 0.42);
    s.width = width;
    s.height = height;
    s.radius = radius;

    if (s.wheelContainer) {
      s.wheelContainer.x = width / 2;
      s.wheelContainer.y = height / 2;
      // Ellipse tilt: vertical squash to 0.62.
      s.wheelContainer.scale.x = 1;
      s.wheelContainer.scale.y = 0.62;
    }
    if (s.ballPivot) {
      s.ballPivot.x = width / 2;
      s.ballPivot.y = height / 2;
      s.ballPivot.scale.x = 1;
      s.ballPivot.scale.y = 0.62;
    }
    if (s.wheelGraphics) drawWheel(s.wheelGraphics, radius);
    if (s.labelsContainer) drawLabels(s.labelsContainer, radius);
    if (s.ball) drawBall(s.ball, Math.max(4, radius * 0.045));
  }, []);

  const handleReady = useCallback(
    (app, { width, height }) => {
      const s = sceneRef.current;
      s.app = app;

      // Wheel container (rotates).
      const wheel = new PIXI.Container();
      s.wheelContainer = wheel;
      app.stage.addChild(wheel);

      const wg = new PIXI.Graphics();
      s.wheelGraphics = wg;
      wheel.addChild(wg);

      const labels = new PIXI.Container();
      s.labelsContainer = labels;
      wheel.addChild(labels);

      // Ball pivot (rotates ball around centre, independent of wheel).
      const ballPivot = new PIXI.Container();
      s.ballPivot = ballPivot;
      app.stage.addChild(ballPivot);

      const ball = new PIXI.Graphics();
      s.ball = ball;
      ballPivot.addChild(ball);

      layout(width, height);

      // Initial ball position: hidden (offscreen radius 0) until first spin.
      if (s.ball) {
        s.ball.x = s.radius * 0.78;
        s.ball.y = 0;
        s.ball.alpha = 0;
      }

      return () => {
        try {
          spinTimelineRef.current?.kill();
        } catch {
          /* ignore */
        }
        if (tickTimerRef.current) {
          clearInterval(tickTimerRef.current);
          tickTimerRef.current = null;
        }
      };
    },
    [layout],
  );

  const handleResize = useCallback(
    (_app, { width, height }) => {
      layout(width, height);
    },
    [layout],
  );

  // Show ball at landing position when showResult flips on (and not spinning).
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.ball || !s.ballPivot) return;
    if (showResult && !isSpinning) {
      const idx = indexOfNumber(winningNumber);
      if (idx >= 0 && s.radius > 0) {
        const slice = (Math.PI * 2) / POCKET_COUNT;
        const targetAngle = -Math.PI / 2 + idx * slice;
        // Place ball at the pocket on the inner track.
        s.ball.alpha = 1;
        s.ball.x = Math.cos(targetAngle) * s.radius * 0.74;
        s.ball.y = Math.sin(targetAngle) * s.radius * 0.74;
      }
    }
  }, [showResult, isSpinning, winningNumber]);

  // Spin animation: triggered when `isSpinning` transitions to true.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s.app || !s.wheelContainer || !s.ball) return undefined;

    if (!isSpinning) {
      spinningRef.current = false;
      return undefined;
    }
    if (spinningRef.current) return undefined;
    spinningRef.current = true;

    const radius = s.radius || 100;
    const outerR = radius * 0.92; // outer rim track
    const innerR = radius * 0.74; // pocket track (final)

    // Reduced motion: snap to result.
    if (reducedRef.current) {
      const idx = indexOfNumber(winningNumberRef.current);
      const slice = (Math.PI * 2) / POCKET_COUNT;
      if (idx >= 0) {
        const targetAngle = -Math.PI / 2 + idx * slice;
        s.ball.alpha = 1;
        s.ball.x = Math.cos(targetAngle) * innerR;
        s.ball.y = Math.sin(targetAngle) * innerR;
      }
      // Settle a small wheel rotation for visual change.
      s.currentWheelRotation += Math.PI;
      s.wheelContainer.rotation = s.currentWheelRotation;
      spinningRef.current = false;
      try {
        onSpinCompleteRef.current?.();
      } catch {
        /* ignore */
      }
      return undefined;
    }

    // Determine final ball angle. If we don't know the winningNumber yet,
    // pick a random index — animation will still look correct; the parent
    // overlay shows the real number when showResult flips on.
    const knownIdx = indexOfNumber(winningNumberRef.current);
    const idx = knownIdx >= 0 ? knownIdx : Math.floor(Math.random() * POCKET_COUNT);
    const slice = (Math.PI * 2) / POCKET_COUNT;
    const finalAngle = -Math.PI / 2 + idx * slice;

    // Ball: orbits clockwise (positive). Multiple revolutions + final settle.
    const startBallAngle = -Math.PI / 2 + Math.random() * Math.PI * 0.4;
    const ballRevolutions = 5; // five full loops
    const endBallAngle = finalAngle + Math.PI * 2 * ballRevolutions;

    // Wheel: spins opposite direction (negative).
    const wheelRevolutions = 3;
    const wheelStart = s.currentWheelRotation;
    const wheelEnd = wheelStart - Math.PI * 2 * wheelRevolutions;

    // Reset ball alpha + initial pose.
    s.ball.alpha = 1;
    s.ball.x = Math.cos(startBallAngle) * outerR;
    s.ball.y = Math.sin(startBallAngle) * outerR;

    // Kill any previous timeline.
    try {
      spinTimelineRef.current?.kill();
    } catch {
      /* ignore */
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }

    // Rate-limited tick sound while the ball is on the outer track.
    tickTimerRef.current = setInterval(() => {
      try {
        playRef.current?.('spin-tick');
      } catch {
        /* ignore */
      }
    }, 180);

    const ballProxy = { angle: startBallAngle, r: outerR };

    const tl = gsap.timeline({
      onComplete: () => {
        spinningRef.current = false;
        if (tickTimerRef.current) {
          clearInterval(tickTimerRef.current);
          tickTimerRef.current = null;
        }
        // Final pulse on the landed pocket.
        const target = { scale: 1 };
        gsap.to(target, {
          scale: 1.12,
          duration: 0.18,
          yoyo: true,
          repeat: 1,
          ease: 'power2.out',
          onUpdate: () => {
            if (s.ball) {
              s.ball.scale.set(target.scale);
            }
          },
          onComplete: () => {
            if (s.ball) s.ball.scale.set(1);
          },
        });
        try {
          onSpinCompleteRef.current?.();
        } catch {
          /* ignore */
        }
      },
    });
    spinTimelineRef.current = tl;

    // Phase 1 — accelerate + steady high speed on outer track (~2.5s linear-ish).
    tl.to(ballProxy, {
      angle: startBallAngle + Math.PI * 2 * 2.5,
      duration: 2.2,
      ease: 'power1.in',
      onUpdate: () => {
        if (!s.ball) return;
        s.ball.x = Math.cos(ballProxy.angle) * ballProxy.r;
        s.ball.y = Math.sin(ballProxy.angle) * ballProxy.r;
      },
    }, 0);

    // Phase 2 — radius decays from outer → inner (~2s) while still rotating.
    tl.to(ballProxy, {
      r: innerR + (outerR - innerR) * 0.25,
      duration: 2.0,
      ease: 'power2.in',
      onUpdate: () => {
        if (!s.ball) return;
        s.ball.x = Math.cos(ballProxy.angle) * ballProxy.r;
        s.ball.y = Math.sin(ballProxy.angle) * ballProxy.r;
      },
    }, 1.0);

    // Phase 3 — settle into final pocket with bounce (~1.3s).
    tl.to(ballProxy, {
      angle: endBallAngle,
      r: innerR,
      duration: 1.3,
      ease: 'bounce.out',
      onUpdate: () => {
        if (!s.ball) return;
        s.ball.x = Math.cos(ballProxy.angle) * ballProxy.r;
        s.ball.y = Math.sin(ballProxy.angle) * ballProxy.r;
      },
    }, 2.2);

    // Wheel rotation runs in parallel.
    const wheelProxy = { rot: wheelStart };
    tl.to(wheelProxy, {
      rot: wheelEnd,
      duration: 5.0,
      ease: 'power2.out',
      onUpdate: () => {
        if (!s.wheelContainer) return;
        s.wheelContainer.rotation = wheelProxy.rot;
        s.currentWheelRotation = wheelProxy.rot;
      },
    }, 0);

    return undefined;
  }, [isSpinning]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      try {
        spinTimelineRef.current?.kill();
      } catch {
        /* ignore */
      }
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    },
    [],
  );

  const winningEntry = winningNumber != null
    ? ROULETTE_NUMBERS.find((n) => n.number === Number(winningNumber))
    : null;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <PixiStage
        onReady={handleReady}
        onResize={handleResize}
        aspectRatio={1}
        ariaLabel="Roulette wheel with numbered pockets"
      />
      {winningNumber !== null && winningEntry && showResult && !isSpinning && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-bg-card/90 px-6 py-4 backdrop-blur-md shadow-card">
          <div className="text-center">
            <span className="text-xs uppercase tracking-wider text-text-muted">Result</span>
            <div
              className={[
                'font-heading text-4xl font-bold tabular-nums',
                winningEntry.color === 'red'
                  ? 'text-red-400'
                  : winningEntry.color === 'black'
                  ? 'text-text-primary'
                  : 'text-emerald-300',
              ].join(' ')}
            >
              {winningNumber}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouletteWheel;
