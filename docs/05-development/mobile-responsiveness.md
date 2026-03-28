# Mobile Responsiveness

Current state, patterns, and future plans for mobile support in Platinum Casino.

---

## Current State

The client uses **Tailwind CSS v4** with the `@tailwindcss/vite` plugin. The CSS entry point (`client/src/index.css`) contains only `@import "tailwindcss";` -- all styling is done through utility classes in JSX. There is no custom CSS, no media queries written by hand, and no separate mobile stylesheet.

Responsive behavior is handled entirely through Tailwind's responsive utility prefixes applied directly in component markup.

---

## Tailwind v4 Breakpoint System

Tailwind CSS v4 ships with the following default breakpoints. All breakpoints are **mobile-first** -- unprefixed utilities apply to all screen widths, and prefixed utilities apply at that breakpoint *and above*.

| Prefix | Min Width | Typical Devices |
|---|---|---|
| *(none)* | 0px | All devices (mobile-first baseline) |
| `sm` | 640px | Large phones in landscape, small tablets |
| `md` | 768px | Tablets in portrait |
| `lg` | 1024px | Tablets in landscape, small laptops |
| `xl` | 1280px | Laptops, desktops |
| `2xl` | 1536px | Large desktops |

### How the Project Uses Breakpoints

The game components follow a consistent two-column layout pattern that stacks on mobile and goes side-by-side on desktop:

```jsx
// Pattern used in CrashGame, PlinkoGame, WheelGame, LandminesGame
<div className="flex flex-col lg:flex-row gap-6">
  {/* Game board: full width on mobile, 8/12 on desktop */}
  <div className="lg:w-8/12 space-y-4">
    {/* Canvas / game board */}
    {/* History / player list in sub-grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* ... */}
    </div>
  </div>

  {/* Betting panel: full width on mobile, 4/12 on desktop */}
  <div className="lg:w-4/12">
    {/* Betting controls */}
  </div>
</div>
```

**Key patterns observed:**
- `flex-col` at mobile, `lg:flex-row` at 1024px+
- Game board takes full width on mobile, `lg:w-8/12` on desktop
- Betting panel stacks below on mobile, sits beside on desktop at `lg:w-4/12`
- Sub-grids use `grid-cols-1` on mobile, `md:grid-cols-2` at 768px+
- Game stats use `grid-cols-2` at all sizes (small cards that fit side-by-side even on mobile)

---

## Mobile-First Design Approach

Tailwind CSS enforces a mobile-first methodology: you write the mobile layout as the base, then layer on overrides for larger screens. This means:

1. **Start with the smallest screen** -- unprefixed classes define the mobile experience.
2. **Add breakpoint prefixes for larger screens** -- `md:`, `lg:`, `xl:` override the base.
3. **Never use `max-width` media queries** unless absolutely necessary. Tailwind v4 does not include `max-*` variants by default.

### Recommended Workflow

When building a new component or modifying an existing one:

1. Shrink the browser to ~375px wide (iPhone SE width).
2. Style the component so it looks correct at that width.
3. Widen the browser and add `sm:`, `md:`, `lg:` overrides as needed.
4. Test at each breakpoint threshold (640, 768, 1024, 1280).

---

## Game-Specific Responsive Considerations

### Canvas-Based Games (Crash)

The Crash game uses an HTML `<canvas>` element with fixed pixel dimensions:

```jsx
<canvas
  ref={canvasRef}
  width={800}
  height={400}
  className="w-full bg-gray-900"
/>
```

The canvas has `width={800} height={400}` as its internal resolution but `className="w-full"` to fill its container. This means:

- The canvas scales down visually on small screens via CSS.
- The internal drawing coordinates remain 800x400 regardless of display size.
- **Known issue:** Text rendered on the canvas (multiplier display, countdown) is sized for the 800x400 coordinate space and may appear proportionally smaller on mobile because the canvas is scaled down.

**Recommendations:**
- Detect the canvas container width and adjust the internal canvas resolution dynamically using `ResizeObserver`.
- Scale font sizes in canvas drawing calls relative to the actual rendered size.
- Consider a minimum readable canvas height on mobile (e.g., `min-h-[200px]`).

### Animation-Based Games (Plinko, Wheel)

Plinko and Wheel use component-based rendering (not raw canvas). They inherit Tailwind's responsive utilities more naturally. Key concerns:

- **Plinko board density:** The peg grid may become too dense to see individual pegs on small screens. Consider reducing the number of visible rows on mobile or allowing horizontal scroll.
- **Wheel segment labels:** Text on wheel segments may become unreadable below a certain size. Consider hiding labels and showing only colors on small screens.

### Touch Controls

All games currently use click-based interactions. On mobile devices:

- **Tap targets:** Buttons should be at least 44x44px (Apple's minimum) or 48x48px (Google's recommendation). The betting panels use standard button components that generally meet this.
- **Landmines grid:** Each cell in the grid needs to be large enough to tap accurately. On small screens, a 5x5 grid of small cells may be difficult. Consider:
  - Allowing pinch-to-zoom on the game board.
  - Increasing cell padding on mobile.
  - Adding a confirmation step for cell selection.
- **Canvas tap events:** The Crash game canvas uses mouse events for rendering only (no click interaction on the canvas itself), so touch compatibility is not an issue there.
- **Double-tap zoom:** Add `touch-action: manipulation` to game containers to prevent the browser's double-tap-to-zoom gesture from interfering with rapid button presses.

```jsx
<div className="touch-manipulation">
  {/* Game content */}
</div>
```

Tailwind v4 provides the `touch-manipulation` utility class for this purpose.

---

## Navigation on Mobile

### Sidebar Collapse

The `SidebarNav` component renders a 256px (`w-64`) fixed sidebar. On mobile, this consumes too much horizontal space. Current observations:

- The sidebar has `minHeight: '100vh'` and `position: 'relative'` set via inline styles.
- There is no hamburger menu or collapse mechanism.
- On narrow screens, the sidebar pushes the main content area to the right, potentially causing horizontal overflow.

**Recommended implementation:**

1. **Hide sidebar on mobile by default:** Use `hidden lg:block` on the sidebar container.
2. **Add a hamburger toggle:** Place a menu button in a mobile top bar that toggles sidebar visibility.
3. **Overlay pattern:** On mobile, render the sidebar as a full-screen overlay (`fixed inset-0 z-50`) with a backdrop, rather than pushing content.
4. **Close on navigation:** Automatically close the sidebar when a link is clicked on mobile.

```jsx
// Conceptual structure
<div className="lg:flex">
  {/* Mobile top bar */}
  <div className="lg:hidden flex items-center justify-between p-4 bg-[#0f1923]">
    <span className="text-[#ffc107] font-bold text-xl">Platinum Casino</span>
    <button onClick={toggleSidebar} className="text-white p-2">
      {/* Hamburger icon */}
    </button>
  </div>

  {/* Sidebar: hidden on mobile unless toggled */}
  <div className={`
    fixed inset-0 z-50 lg:relative lg:z-auto
    ${isSidebarOpen ? 'block' : 'hidden lg:block'}
  `}>
    <SidebarNav onClose={() => setIsSidebarOpen(false)} />
  </div>

  {/* Main content */}
  <main className="flex-1">
    {/* Page content */}
  </main>
</div>
```

---

## Testing on Mobile Devices

### Browser DevTools

1. Open Chrome DevTools (F12).
2. Toggle the device toolbar (Ctrl+Shift+M).
3. Test with preset devices: iPhone SE (375x667), iPhone 12 Pro (390x844), iPad (768x1024), iPad Pro (1024x1366).
4. Test with network throttling enabled (Slow 3G, Fast 3G) to catch performance issues on mobile networks.

### Physical Device Testing

- Use `vite --host` (already configured with `host: true` in `vite.config.js`) to expose the dev server on the local network.
- Access `http://<your-ip>:5173` from a physical phone or tablet on the same network.
- Test touch interactions, scroll behavior, and orientation changes.

### Key Test Scenarios

| Scenario | What to Verify |
|---|---|
| Portrait phone (375px) | Game board is visible and playable, betting panel is below the game board, sidebar is hidden or collapsed |
| Landscape phone (667px) | Game board has adequate height, no horizontal overflow |
| Tablet portrait (768px) | Sub-grids switch to 2 columns, layout is comfortable |
| Tablet landscape (1024px) | Sidebar appears, game board and betting panel go side-by-side |
| Orientation change | Layout adapts without requiring a page reload, canvas re-renders correctly |
| Touch betting | All buttons are easily tappable, no accidental double-taps |
| Touch game play | Landmines cells are selectable, no pinch-zoom interference on game boards |

---

## Known Issues and Limitations

| Issue | Severity | Description |
|---|---|---|
| No sidebar collapse | High | The 256px sidebar does not hide on mobile, causing content to be pushed offscreen or cramped |
| Canvas text scaling | Medium | Crash game canvas text (multiplier, countdown) does not scale with the viewport -- it stays at 24px in the 800x400 coordinate space |
| Hardcoded canvas dimensions | Medium | Canvas uses `width={800} height={400}` which does not adapt to the container size dynamically |
| No touch-action optimization | Low | Game containers do not set `touch-action: manipulation`, which can cause double-tap zoom delays |
| Horizontal scroll in tables | Low | Game history tables use `overflow-x-auto` which works but is not ideal on narrow screens -- consider a card-based layout for mobile |
| No orientation lock | Low | No guidance for users that certain games work better in landscape |

---

## PWA Potential

The application could be enhanced as a Progressive Web App for an app-like mobile experience. Neither a service worker nor a web app manifest exists currently.

### Web App Manifest

Create `client/public/manifest.json`:

```json
{
  "name": "Platinum Casino",
  "short_name": "Platinum",
  "description": "Online casino with crash, plinko, wheel, roulette, and blackjack games",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f1923",
  "theme_color": "#ffc107",
  "orientation": "any",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add the link tag to `client/index.html`:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#ffc107" />
```

### Service Worker

A service worker can provide:

- **Offline shell:** Cache the application shell (HTML, CSS, JS) so the app loads even without a network connection. Game play still requires a server connection, but the UI loads instantly.
- **Asset caching:** Cache static assets (images, fonts) for faster repeat visits.
- **Push notifications:** Notify users about promotions or daily login rewards.

Use [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) for Vite-native service worker generation:

```bash
npm install -D vite-plugin-pwa
```

```javascript
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Platinum Casino',
        short_name: 'Platinum',
        theme_color: '#ffc107',
        background_color: '#0f1923',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
});
```

### PWA Caveats for Casino Applications

- **Do not cache game state or bet responses** -- stale API data could cause incorrect balance displays.
- **Use `NetworkFirst` for API calls** -- fall back to cache only for read-only, non-financial data.
- **Socket.IO requires a live connection** -- the service worker cannot intercept WebSocket traffic; games will not function offline.
- **App store policies:** Apple and Google have restrictions on real-money gambling apps. If Platinum Casino handles real currency, PWA distribution may be simpler than app store submission, but check local regulations.

---

## Related Documents

- [Coding Standards](./coding-standards.md) -- Tailwind CSS usage patterns and component conventions
- [Project Structure](./project-structure.md) -- where game components and styles live
- [Technology Stack](../01-overview/technology-stack.md) -- Tailwind CSS v4, Vite, React
- [Games Overview](../03-features/games-overview.md) -- feature descriptions for each game
- [Internationalization](./internationalization.md) -- RTL language support overlaps with responsive layout
- [Current Status](../11-roadmap/current-status.md) -- what works and what is in progress
- [Roadmap](../11-roadmap/roadmap.md) -- planned feature timeline including mobile improvements
