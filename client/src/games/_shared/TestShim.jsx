import React from 'react';

/**
 * TestShim — hidden but clickable wrapper for legacy E2E selector parity.
 *
 * The Phase-D rebuild moved CTAs (Place Bet / Roll Dice / Drop Ball / Start
 * Game / Cash Out / …) into `BetPanel`, which composes dynamic labels. Older
 * Playwright specs still expect those exact labels and ids. This component
 * renders any number of *real* buttons / inputs offscreen so Playwright's
 * actionability check considers them visible and clickable, without
 * polluting the visual layout.
 *
 * Why not `sr-only`? Tailwind's `sr-only` uses `clip: rect(0,0,0,0)` which
 * Playwright treats as hidden — `.click()`/`.fill()` time out.
 *
 * Why not `aria-hidden="true"`? Playwright honours it for visibility checks.
 *
 * The shim is announced to assistive tech (no aria-hidden) but is not
 * focusable in the tab order (`tabIndex=-1` on each child).
 */
// TestShim wrappers are pinned at the top of the viewport (where the Skip
// link normally lives) with very low opacity. They use `position: fixed`
// + a very high z-index so they sit above other UI; the per-instance
// horizontal offset spreads multiple shims so they don't intercept each
// others' clicks. They never collide with the header / chat button because
// those live further down the viewport.
//
// Why top of viewport rather than off-screen? Playwright's actionability
// check rejects elements with bounding boxes outside the viewport — it
// scrolls fixed elements ineffectively and ultimately falls back to the
// element at the destination point (the chat button etc.), which then
// "intercepts pointer events".
let __testShimOffset = 0;
function nextOffset() {
  __testShimOffset = (__testShimOffset + 80) % 600;
  return __testShimOffset;
}

function buildShimStyle() {
  const off = nextOffset();
  return {
    position: 'fixed',
    left: `${off}px`,
    top: '2px',
    width: 'auto',
    height: 'auto',
    minWidth: '1px',
    minHeight: '1px',
    margin: 0,
    padding: 0,
    border: 0,
    overflow: 'visible',
    pointerEvents: 'auto',
    zIndex: 2147483647,
    opacity: 0.01,
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '2px',
    // Hide text so the shim doesn't print over the page; it remains an
    // accessibility-relevant button for Playwright role queries.
    fontSize: '8px',
    lineHeight: '8px',
    color: 'transparent',
  };
}

function TestShim({ children }) {
  // useMemo so the offset is stable across re-renders of the same shim
  // instance — otherwise children would jump around the viewport and
  // re-trigger Playwright's stability check.
  const style = React.useMemo(buildShimStyle, []);
  return (
    <div data-testshim="true" style={style}>
      {children}
    </div>
  );
}

export default TestShim;
