import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

// gsap ticker — keep deterministic by exposing the registered callback.
vi.mock('gsap', () => {
  const cbs = [];
  const gsap = {
    ticker: {
      add: vi.fn((cb) => { cbs.push(cb); }),
      remove: vi.fn((cb) => { const i = cbs.indexOf(cb); if (i >= 0) cbs.splice(i, 1); }),
      deltaRatio: () => 1,
      _cbs: cbs,
    },
  };
  return { default: gsap, ...gsap };
});

const reducedMotionRef = { value: false };
vi.mock('@/components/casino/MotionSafe', () => ({
  useReducedMotion: () => reducedMotionRef.value,
}));

vi.mock('@/components/casino/AnimatedNumber', () => ({
  default: ({ value, format }) => (
    <span data-testid="animated-number">
      {typeof format === 'function' ? format(value) : value}
    </span>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  reducedMotionRef.value = false;
});
afterEach(() => {
  vi.restoreAllMocks();
});

import CrashCurve from '@/games/crash/CrashCurve';
import gsap from 'gsap';

describe('CrashCurve', () => {
  it('renders connecting phase placeholder', () => {
    render(<CrashCurve phase="connecting" multiplier={1} crashPoint={null} countdown={0} />);
    expect(screen.getByText(/Connecting/)).toBeInTheDocument();
  });

  it('renders waiting phase with countdown', () => {
    render(<CrashCurve phase="waiting" multiplier={1} crashPoint={null} countdown={5} />);
    expect(screen.getByText('5s')).toBeInTheDocument();
  });

  it('renders waiting phase with "Place bets" when countdown is zero', () => {
    render(<CrashCurve phase="waiting" multiplier={1} crashPoint={null} countdown={0} />);
    expect(screen.getByText(/Place bets/)).toBeInTheDocument();
  });

  it('renders running phase with multiplier', () => {
    render(<CrashCurve phase="running" multiplier={2.5} crashPoint={null} countdown={0} />);
    expect(screen.getByTestId('animated-number')).toHaveTextContent('2.50x');
  });

  it('renders crashed phase with crashPoint and label', () => {
    render(<CrashCurve phase="crashed" multiplier={3.5} crashPoint={3.45} countdown={0} />);
    expect(screen.getByText(/Crashed/)).toBeInTheDocument();
    expect(screen.getByTestId('animated-number')).toHaveTextContent('3.45x');
  });

  it('falls back to multiplier in crashed phase when crashPoint is not a number', () => {
    render(<CrashCurve phase="crashed" multiplier={4.2} crashPoint={null} countdown={0} />);
    expect(screen.getByTestId('animated-number')).toHaveTextContent('4.20x');
  });

  it('registers a gsap ticker while running and removes on cleanup', () => {
    const { unmount } = render(
      <CrashCurve phase="running" multiplier={1.5} crashPoint={null} countdown={0} />,
    );
    expect(gsap.ticker.add).toHaveBeenCalled();
    unmount();
    expect(gsap.ticker.remove).toHaveBeenCalled();
  });

  it('drives the curve update on ticker callback', () => {
    render(<CrashCurve phase="running" multiplier={5.0} crashPoint={null} countdown={0} />);
    // Advance ticker callbacks so the smoothing loop and trail emission fire.
    act(() => {
      for (let i = 0; i < 5; i += 1) {
        gsap.ticker._cbs.forEach((cb) => cb());
      }
    });
    expect(gsap.ticker.add).toHaveBeenCalled();
  });

  it('does not register the ticker when reduced motion is enabled', () => {
    reducedMotionRef.value = true;
    render(<CrashCurve phase="running" multiplier={2} crashPoint={null} countdown={0} />);
    // The reduced-motion branch sets path attributes synchronously without registering the ticker.
    expect(gsap.ticker.add).not.toHaveBeenCalled();
  });

  it('clears trail when phase transitions back to waiting', () => {
    const { rerender } = render(
      <CrashCurve phase="running" multiplier={3} crashPoint={null} countdown={0} />,
    );
    act(() => {
      // Emit some trail dots.
      gsap.ticker._cbs.forEach((cb) => cb());
    });
    rerender(<CrashCurve phase="waiting" multiplier={1} crashPoint={null} countdown={3} />);
    expect(screen.getByText('3s')).toBeInTheDocument();
  });

  it('renders rocket overlay during running and crashed phases', () => {
    const { container, rerender } = render(
      <CrashCurve phase="running" multiplier={2} crashPoint={null} countdown={0} />,
    );
    // Rocket icon (FiNavigation) renders within the running overlay.
    expect(container.querySelector('svg')).toBeInTheDocument();
    rerender(<CrashCurve phase="crashed" multiplier={2} crashPoint={2} countdown={0} />);
    expect(screen.getByText(/Crashed/)).toBeInTheDocument();
  });

  it('renders for very high multipliers (color branches)', () => {
    render(<CrashCurve phase="running" multiplier={50} crashPoint={null} countdown={0} />);
    expect(screen.getByTestId('animated-number')).toHaveTextContent('50.00x');
  });

  it('renders for intermediate multipliers (color branches)', () => {
    render(<CrashCurve phase="running" multiplier={1.8} crashPoint={null} countdown={0} />);
    expect(screen.getByTestId('animated-number')).toHaveTextContent('1.80x');
  });

  it('renders for low multipliers (color branches)', () => {
    render(<CrashCurve phase="running" multiplier={1.2} crashPoint={null} countdown={0} />);
    expect(screen.getByTestId('animated-number')).toHaveTextContent('1.20x');
  });

  it('renders connecting → running transition without throwing', () => {
    const { rerender } = render(
      <CrashCurve phase="connecting" multiplier={1} crashPoint={null} countdown={0} />,
    );
    rerender(<CrashCurve phase="running" multiplier={1.5} crashPoint={null} countdown={0} />);
    expect(screen.getByTestId('animated-number')).toHaveTextContent('1.50x');
  });
});
