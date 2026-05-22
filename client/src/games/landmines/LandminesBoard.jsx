import React, { useCallback, useEffect, useRef } from 'react';
import { motion, useAnimate } from 'framer-motion';
import confetti from 'canvas-confetti';
import { BsGem } from 'react-icons/bs';
import { FaBomb } from 'react-icons/fa';
import { useSound } from '../../components/casino/SoundProvider';
import { useReducedMotion } from '../../components/casino/MotionSafe';

const GRID_SIZE = 5;
const CELL_HIDDEN = 'hidden';
const CELL_SAFE = 'safe';
const CELL_MINE = 'mine';

const GEM_COLORS = ['#A3E635', '#84CC16', '#BEF264', '#22D3EE'];
const MINE_COLORS = ['#F43F5E', '#FB7185', '#FBBF24', '#F59E0B'];

function originFromTile(node) {
  if (!node || typeof node.getBoundingClientRect !== 'function') {
    return { x: 0.5, y: 0.5 };
  }
  try {
    const rect = node.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2) / Math.max(1, window.innerWidth),
      y: (rect.top + rect.height / 2) / Math.max(1, window.innerHeight),
    };
  } catch {
    return { x: 0.5, y: 0.5 };
  }
}

/**
 * LandminesBoard — Framer-Motion grid with 3D tile flips. On reveal:
 *   - gem tile flips and emits a tiny confetti sparkle anchored at the tile
 *   - mine tile flips, fires an explosion confetti burst, triggers screen
 *     shake on the board container, and pulses a red flash overlay
 *
 * Pure render layer. The parent owns all socket / game state. Animations are
 * disposed on unmount via the Framer hooks; confetti instances clean up
 * themselves.
 */
function LandminesBoard({
  board,
  isGameActive,
  isPending,
  focusedCell,
  onFocusCell,
  onReveal,
  onCellKeyDown,
  setCellRef,
  ariaLabel = 'Landmines board, 5 by 5',
}) {
  const { play } = useSound();
  const reduced = useReducedMotion();
  const [scope, animate] = useAnimate();
  const flashRef = useRef(null);
  const lastBoomRef = useRef(0);
  const cellNodes = useRef({});

  // Mine boom FX — fires the first time a mine flips in.
  const triggerBoom = useCallback(
    (node) => {
      const now = Date.now();
      if (now - lastBoomRef.current < 200) return;
      lastBoomRef.current = now;

      play('mine-boom');
      play('lose');

      if (reduced) return;

      // Confetti explosion at the tile.
      try {
        const origin = originFromTile(node);
        confetti({
          particleCount: 90,
          spread: 100,
          startVelocity: 38,
          ticks: 140,
          origin,
          colors: MINE_COLORS,
          shapes: ['circle'],
          scalar: 0.9,
        });
      } catch {
        /* jsdom — ignore */
      }

      // Screen shake.
      try {
        animate(
          scope.current,
          { x: [0, -6, 6, -4, 4, 0], y: [0, 4, -3, 3, -2, 0] },
          { duration: 0.45, ease: 'easeOut' },
        );
      } catch {
        /* no scope yet */
      }

      // Red flash overlay.
      const flash = flashRef.current;
      if (flash) {
        flash.style.opacity = '0';
        // Sequence the flash with rAF so the transition picks up the change.
        requestAnimationFrame(() => {
          flash.style.transition = 'opacity 90ms ease-out';
          flash.style.opacity = '0.6';
          window.setTimeout(() => {
            flash.style.transition = 'opacity 220ms ease-in';
            flash.style.opacity = '0';
          }, 110);
        });
      }
    },
    [animate, scope, play, reduced],
  );

  // Gem sparkle FX — fires when a tile transitions to safe.
  const triggerSparkle = useCallback(
    (node) => {
      play('gem-reveal');
      if (reduced) return;
      try {
        const origin = originFromTile(node);
        confetti({
          particleCount: 18,
          spread: 36,
          startVelocity: 22,
          ticks: 90,
          origin,
          colors: GEM_COLORS,
          scalar: 0.55,
          gravity: 0.9,
        });
      } catch {
        /* jsdom — ignore */
      }
    },
    [play, reduced],
  );

  // Tear-down: stop any in-flight confetti on unmount.
  useEffect(
    () => () => {
      try {
        confetti.reset?.();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return (
    <div ref={scope} className="relative">
      <div
        ref={flashRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-rose-500/30"
        style={{ opacity: 0 }}
      />

      <div
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={GRID_SIZE}
        aria-colcount={GRID_SIZE}
        className="grid grid-cols-5 gap-2 max-w-md mx-auto w-full"
      >
        {board.map((row, rIdx) => (
          <div key={`row-${rIdx}`} role="row" className="contents">
            {row.map((cell, cIdx) => {
              const isFocused =
                focusedCell.row === rIdx && focusedCell.col === cIdx;
              const isHidden = cell.state === CELL_HIDDEN;
              const isSafe = cell.state === CELL_SAFE;
              const isMine = cell.state === CELL_MINE;
              const disabled = !isGameActive || isPending || !isHidden;

              let label = `Row ${rIdx + 1}, column ${cIdx + 1}, hidden`;
              if (isSafe) {
                label = `Row ${rIdx + 1}, column ${cIdx + 1}, safe${
                  cell.multiplier
                    ? `, multiplier ${cell.multiplier.toFixed(2)}x`
                    : ''
                }`;
              } else if (isMine) {
                label = `Row ${rIdx + 1}, column ${cIdx + 1}, mine`;
              }

              return (
                <motion.button
                  key={`${rIdx}-${cIdx}`}
                  type="button"
                  role="gridcell"
                  tabIndex={isFocused ? 0 : -1}
                  aria-label={label}
                  aria-disabled={disabled || undefined}
                  disabled={disabled}
                  ref={(el) => {
                    cellNodes.current[`${rIdx},${cIdx}`] = el;
                    if (typeof setCellRef === 'function') {
                      setCellRef(rIdx, cIdx, el);
                    }
                  }}
                  onClick={() => {
                    if (disabled) return;
                    onReveal(rIdx, cIdx);
                  }}
                  onKeyDown={(e) => onCellKeyDown(e, rIdx, cIdx)}
                  onFocus={() => onFocusCell(rIdx, cIdx)}
                  // Run FX as soon as the tile transitions into a revealed state.
                  onAnimationStart={(definition) => {
                    if (!definition || typeof definition !== 'object') return;
                    if (definition.rotateY === 180) {
                      const node = cellNodes.current[`${rIdx},${cIdx}`];
                      if (isMine) triggerBoom(node);
                      else if (isSafe) triggerSparkle(node);
                    }
                  }}
                  animate={{
                    rotateY: isHidden ? 0 : 180,
                    scale: isHidden ? 1 : [1, 1.06, 1],
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          rotateY: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                          scale: { duration: 0.45, times: [0, 0.55, 1] },
                        }
                  }
                  whileHover={
                    disabled || reduced
                      ? undefined
                      : { y: -2, scale: 1.03 }
                  }
                  whileTap={
                    disabled || reduced ? undefined : { scale: 0.97 }
                  }
                  className={[
                    'relative aspect-square min-h-[44px] rounded-xl select-none',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                  style={{
                    transformStyle: 'preserve-3d',
                    perspective: 800,
                  }}
                >
                  {/* Front face — hidden tile */}
                  <span
                    aria-hidden="true"
                    className={[
                      'absolute inset-0 flex items-center justify-center rounded-xl',
                      'border border-white/10 bg-gradient-to-br from-white/10 to-white/5',
                      'text-text-secondary font-mono text-lg shadow-inner',
                      isHidden ? 'hover:border-accent-gold/60' : '',
                    ].join(' ')}
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    ?
                  </span>

                  {/* Back face — revealed (safe / mine) */}
                  <span
                    aria-hidden="true"
                    className={[
                      'absolute inset-0 flex flex-col items-center justify-center rounded-xl border',
                      isMine
                        ? 'bg-rose-500/15 border-rose-500/60 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.45)]'
                        : 'bg-lime-400/10 border-lime-400/50 text-lime-300 shadow-[0_0_18px_rgba(163,230,53,0.35)]',
                    ].join(' ')}
                    style={{
                      transform: 'rotateY(180deg)',
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    {isMine ? (
                      <FaBomb className="text-2xl" />
                    ) : (
                      <>
                        <BsGem className="text-2xl" />
                        {cell.multiplier ? (
                          <span className="mt-0.5 font-mono text-[10px] opacity-90">
                            {cell.multiplier.toFixed(2)}x
                          </span>
                        ) : null}
                      </>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default LandminesBoard;
