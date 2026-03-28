# Component Library

## Overview

The Platinum Casino UI is built from a set of reusable React components located in `client/src/components/`. Components fall into three categories:

| Category    | Location                          | Purpose                                    |
|-------------|-----------------------------------|--------------------------------------------|
| **UI primitives** | `components/ui/`            | Generic building blocks (Button, Card, Input, etc.) |
| **Layout**  | `components/` and `layouts/`      | Page structure (Header, Footer, SidebarNav, MainLayout) |
| **Guards**  | `components/guards/`             | Route protection (AuthGuard, AdminGuard)    |
| **Game**    | `components/`                     | Game-specific wrappers (GameErrorBoundary)      |
| **Mobile**  | `components/`                     | Mobile-specific navigation (MobileBottomNav)    |
| **Utility** | `components/`                     | Error handling and status display (ErrorBoundary, Loading, ApiStatus) |

### Styling approach

All components use **Tailwind CSS** utility classes applied inline. Variants and sizes are implemented as JavaScript objects that map prop values to class strings. The project defines design tokens in `styles/theme.js` and `styles/styleGuide.js`; some Tailwind classes reference custom theme extensions (e.g., `bg-bg-card`, `text-accent`, `shadow-glow`).

---

## UI Primitive Components

### Button

**File:** `client/src/components/ui/Button.jsx`

A versatile button with multiple visual variants, sizes, and border-radius options.

#### Props

| Prop        | Type       | Default     | Required | Description                          |
|-------------|------------|-------------|----------|--------------------------------------|
| `children`  | `node`     | --          | Yes      | Button content                       |
| `variant`   | `string`   | `'primary'` | No       | Visual style (see variants below)    |
| `size`      | `string`   | `'md'`      | No       | Size: `xs`, `sm`, `md`, `lg`, `xl`   |
| `fullWidth` | `boolean`  | `false`     | No       | Stretch to fill container width      |
| `disabled`  | `boolean`  | `false`     | No       | Disabled state (50% opacity)         |
| `onClick`   | `function` | --          | No       | Click handler                        |
| `type`      | `string`   | `'button'`  | No       | HTML button type                     |
| `className` | `string`   | `''`        | No       | Additional CSS classes               |
| `rounded`   | `string`   | `'md'`      | No       | Border radius: `none`, `sm`, `md`, `lg`, `xl`, `full` |
| `glow`      | `boolean`  | `false`     | No       | Apply golden glow shadow             |

#### Variants

`primary`, `secondary`, `accent`, `danger`, `success`, `outline`, `outlineAccent`, `gradient`, `gradientAccent`, `subtle`, `glass`

#### Usage

```jsx
import Button from '../components/ui/Button';

<Button variant="accent" size="lg" glow>
  Place Bet
</Button>

<Button variant="outline" fullWidth>
  Cancel
</Button>

<Button variant="glass" rounded="full" size="sm">
  Info
</Button>
```

---

### Card

**File:** `client/src/components/ui/Card.jsx`

A container component with optional header, body, and footer sections.

#### Props

| Prop              | Type      | Default     | Required | Description                              |
|-------------------|-----------|-------------|----------|------------------------------------------|
| `children`        | `node`    | --          | Yes      | Card body content                        |
| `title`           | `string`  | --          | No       | Header title text                        |
| `subtitle`        | `string`  | --          | No       | Header subtitle text                     |
| `className`       | `string`  | `''`        | No       | Additional classes on the card wrapper   |
| `headerClassName` | `string`  | `''`        | No       | Additional classes on the header section |
| `bodyClassName`   | `string`  | `''`        | No       | Additional classes on the body section   |
| `footerContent`   | `node`    | --          | No       | Footer content (renders footer section)  |
| `variant`         | `string`  | `'default'` | No       | Visual style variant                     |
| `hoverable`       | `boolean` | `false`     | No       | Enable lift-on-hover animation           |
| `accent`          | `boolean` | `false`     | No       | Apply golden glow shadow                 |

#### Variants

`default` (gray border), `primary` (blue border), `accent` (gold border), `outlined` (transparent bg), `elevated` (gradient + shadow), `dark` (subtle background)

#### Usage

```jsx
import Card from '../components/ui/Card';

<Card title="Game Stats" subtitle="Last 24 hours" variant="elevated" hoverable>
  <p>Win rate: 52%</p>
</Card>

<Card
  variant="accent"
  accent
  footerContent={<Button variant="accent">Play Now</Button>}
>
  <p>Crash game is live!</p>
</Card>
```

---

### Modal

**File:** `client/src/components/ui/Modal.jsx`

A portal-based modal dialog with animations, keyboard support, and overlay click handling.

#### Props

| Prop                 | Type       | Default     | Required | Description                                  |
|----------------------|------------|-------------|----------|----------------------------------------------|
| `isOpen`             | `boolean`  | --          | Yes      | Controls visibility                          |
| `onClose`            | `function` | --          | Yes      | Called when the modal should close            |
| `title`              | `string`   | --          | No       | Modal header title                           |
| `children`           | `node`     | --          | No       | Modal body content                           |
| `footer`             | `node`     | --          | No       | Footer content (typically action buttons)    |
| `size`               | `string`   | `'md'`      | No       | Width: `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `full` |
| `closeOnEsc`         | `boolean`  | `true`      | No       | Close when Escape key is pressed             |
| `closeOnOverlayClick`| `boolean`  | `true`      | No       | Close when clicking the backdrop             |
| `showCloseButton`    | `boolean`  | `true`      | No       | Show the X button in the header              |
| `variant`            | `string`   | `'default'` | No       | Visual style variant                         |
| `centered`           | `boolean`  | `true`      | No       | Vertically center the modal                  |

#### Variants

`default`, `primary`, `accent`, `dark`, `glass`

#### Behavior

- Rendered via `createPortal` to `document.body`.
- Animate in/out with 300ms opacity and translate transitions.
- Body scroll is locked while the modal is open.
- Accessible: uses `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.

#### Usage

```jsx
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const [showModal, setShowModal] = useState(false);

<Modal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  title="Confirm Bet"
  size="sm"
  footer={
    <>
      <Button variant="subtle" onClick={() => setShowModal(false)}>Cancel</Button>
      <Button variant="accent" onClick={handleConfirm}>Confirm</Button>
    </>
  }
>
  <p>Are you sure you want to place this bet?</p>
</Modal>
```

---

### Table

**File:** `client/src/components/ui/Table.jsx`

A data table with striping, hover effects, and custom cell rendering.

#### Props

| Prop              | Type       | Default     | Required | Description                                   |
|-------------------|------------|-------------|----------|-----------------------------------------------|
| `columns`         | `array`    | `[]`        | No       | Column definitions (see below)                |
| `data`            | `array`    | `[]`        | No       | Row data objects                              |
| `striped`         | `boolean`  | `true`      | No       | Alternate row coloring                        |
| `hoverable`       | `boolean`  | `true`      | No       | Highlight rows on hover                       |
| `bordered`        | `boolean`  | `false`     | No       | Add outer border                              |
| `compact`         | `boolean`  | `false`     | No       | Reduced padding and smaller font              |
| `className`       | `string`   | `''`        | No       | Additional table classes                      |
| `headerClassName` | `string`   | `''`        | No       | Additional header classes                     |
| `bodyClassName`   | `string`   | `''`        | No       | Additional body classes                       |
| `rowClassName`    | `string`   | `''`        | No       | Additional row classes                        |
| `variant`         | `string`   | `'default'` | No       | Visual style: `default`, `primary`, `accent`  |

#### Column definition

```js
{
  header: 'Player',        // Display text for the column header
  accessor: 'username',    // Key to read from data objects
  render: (row) => <Badge>{row.status}</Badge>,  // Optional custom renderer
  className: 'text-right'  // Optional cell class
}
```

#### Usage

```jsx
import Table from '../components/ui/Table';

const columns = [
  { header: 'Player', accessor: 'username' },
  { header: 'Bet', accessor: 'amount', className: 'text-right' },
  { header: 'Result', render: (row) => <Badge variant={row.won ? 'success' : 'danger'}>{row.won ? 'Won' : 'Lost'}</Badge> }
];

<Table columns={columns} data={bets} variant="accent" compact />
```

Displays "No data available" when `data` is empty.

---

### Input

**File:** `client/src/components/ui/Input.jsx`

A form input with label, error state, and visual variants.

#### Props

| Prop             | Type       | Default     | Required | Description                              |
|------------------|------------|-------------|----------|------------------------------------------|
| `type`           | `string`   | `'text'`    | No       | HTML input type                          |
| `name`           | `string`   | --          | No       | Input name attribute                     |
| `value`          | `string`   | --          | No       | Controlled value                         |
| `onChange`       | `function` | --          | No       | Change handler                           |
| `label`          | `string`   | --          | No       | Label text (renders `<label>` above input) |
| `placeholder`    | `string`   | --          | No       | Placeholder text                         |
| `required`       | `boolean`  | `false`     | No       | Marks field as required (adds red asterisk to label) |
| `disabled`       | `boolean`  | `false`     | No       | Disabled state                           |
| `error`          | `string`   | `''`        | No       | Error message (displayed below input, turns border red) |
| `className`      | `string`   | `''`        | No       | Wrapper classes                          |
| `inputClassName` | `string`   | `''`        | No       | Classes on the `<input>` element         |
| `labelClassName` | `string`   | `''`        | No       | Classes on the `<label>` element         |
| `id`             | `string`   | --          | No       | Custom id (defaults to `name`)           |
| `autoFocus`      | `boolean`  | `false`     | No       | Auto-focus on mount                      |
| `min`            | `number`   | --          | No       | Minimum value (for number inputs)        |
| `max`            | `number`   | --          | No       | Maximum value (for number inputs)        |
| `step`           | `number`   | --          | No       | Step increment (for number inputs)       |
| `variant`        | `string`   | `'default'` | No       | Visual style variant                     |

#### Variants

`default`, `primary`, `accent`, `dark`, `glass`

#### Usage

```jsx
import Input from '../components/ui/Input';

<Input
  label="Username"
  name="username"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  required
  error={errors.username}
  variant="accent"
/>

<Input
  type="number"
  label="Bet Amount"
  name="bet"
  min={1}
  max={10000}
  step={1}
  value={betAmount}
  onChange={(e) => setBetAmount(e.target.value)}
/>
```

---

### Badge

**File:** `client/src/components/ui/Badge.jsx`

An inline label/tag component with extensive variant and size options.

#### Props

| Prop        | Type      | Default     | Required | Description                                |
|-------------|-----------|-------------|----------|--------------------------------------------|
| `children`  | `node`    | --          | Yes      | Badge text/content                         |
| `variant`   | `string`  | `'primary'` | No       | Visual style (see variants below)          |
| `size`      | `string`  | `'md'`      | No       | Size: `xs`, `sm`, `md`, `lg`               |
| `pill`      | `boolean` | `true`      | No       | Fully rounded (`rounded-full`) vs. `rounded-md` |
| `className` | `string`  | `''`        | No       | Additional classes                         |
| `glow`      | `boolean` | `false`     | No       | Apply golden glow shadow                   |
| `dot`       | `boolean` | `false`     | No       | Show a small white dot indicator           |
| `bordered`  | `boolean` | `false`     | No       | Add subtle white border                    |

#### Variants

`primary`, `secondary`, `accent`, `success`, `danger`, `warning`, `info`, `purple`, `dark`, `light`, `outline`, `outlineAccent`, `ghost`, `gradient`, `gradientAccent`, `subtle`

#### Usage

```jsx
import Badge from '../components/ui/Badge';

<Badge variant="success" dot>Online</Badge>
<Badge variant="danger" size="xs">-$50</Badge>
<Badge variant="gradientAccent" glow>VIP</Badge>
<Badge variant="outline" pill={false}>New</Badge>
```

---

### Toast

**File:** `client/src/components/ui/Toast.jsx`

An individual toast notification with auto-dismiss and slide-in animation. Typically managed by `ToastContext` rather than used directly.

#### Props

| Prop       | Type       | Default  | Required | Description                        |
|------------|------------|----------|----------|------------------------------------|
| `message`  | `string`   | --       | Yes      | Toast message text                 |
| `type`     | `string`   | `'info'` | No       | Type: `success`, `error`, `warning`, `info` |
| `duration` | `number`   | `5000`   | No       | Auto-dismiss duration in milliseconds |
| `onClose`  | `function` | --       | No       | Called when the toast is dismissed  |

#### Type styles

| Type      | Visual treatment                                 |
|-----------|--------------------------------------------------|
| `success` | Green background, green border, green text       |
| `error`   | Red background, red border, red text             |
| `warning` | Yellow background, yellow border, yellow text    |
| `info`    | Blue background, blue border, blue text          |

#### Usage

Prefer using `useToast()` from `ToastContext` rather than rendering `Toast` directly:

```jsx
import { useToast } from '../context/ToastContext';

const { success, error } = useToast();
success('Bet placed successfully!');
error('Insufficient balance.');
```

---

### Loading

**File:** `client/src/components/ui/Loading.jsx`

A centered spinner with an optional text message.

#### Props

| Prop      | Type     | Default       | Required | Description                     |
|-----------|----------|---------------|----------|---------------------------------|
| `size`    | `string` | `'md'`        | No       | Spinner size: `sm`, `md`, `lg`  |
| `message` | `string` | `'Loading...'`| No       | Text displayed below the spinner|

#### Size mappings

| Size | Dimensions | Border width |
|------|-----------|--------------|
| `sm` | 24x24px   | 2px          |
| `md` | 40x40px   | 3px          |
| `lg` | 64x64px   | 4px          |

#### Usage

```jsx
import Loading from '../components/ui/Loading';

<Loading size="lg" message="Loading game data..." />
<Loading />  {/* Default md spinner with "Loading..." */}
```

---

### ApiStatus

**File:** `client/src/components/ui/ApiStatus.jsx`

A wrapper component that handles loading, error, and empty-data states for API-driven content. Renders `children` only when data is available.

#### Props

| Prop             | Type      | Default                               | Required | Description                                 |
|------------------|-----------|---------------------------------------|----------|---------------------------------------------|
| `status`         | `string`  | --                                    | No       | State string: `'loading'`, `'error'`, `'empty'` |
| `loading`        | `boolean` | --                                    | No       | Alternative loading flag                    |
| `error`          | `string \| boolean` | --                           | No       | Error message or flag                       |
| `isEmpty`        | `boolean` | --                                    | No       | Empty data flag                             |
| `loadingMessage` | `string`  | `'Loading...'`                        | No       | Loading state text                          |
| `errorMessage`   | `string`  | `'An error occurred. Please try again.'` | No   | Error state text                            |
| `emptyMessage`   | `string`  | `'No data available.'`                | No       | Empty state text                            |
| `children`       | `node`    | --                                    | No       | Content to render when data is ready        |

#### Usage

```jsx
import ApiStatus from '../components/ui/ApiStatus';

<ApiStatus loading={isLoading} error={error} isEmpty={data.length === 0}>
  <Table columns={columns} data={data} />
</ApiStatus>
```

---

## Layout Components

### MainLayout

**File:** `client/src/layouts/MainLayout.jsx`

The primary page wrapper that provides the standard page structure.

#### Structure

```
+--------------------------------------------------+
| Header (fixed, transparent -> opaque on scroll)   |
+--------------------------------------------------+
| Decorative background blurs (gold + green)        |
|   +------------------------------------------+   |
|   | <main> - container, padded, z-10          |   |
|   |   {children}                              |   |
|   +------------------------------------------+   |
| Footer                                           |
| ChatBox (floating)                                |
+--------------------------------------------------+
```

#### Props

| Prop       | Type   | Required | Description         |
|------------|--------|----------|---------------------|
| `children` | `node` | Yes      | Page content        |

#### Usage

```jsx
import MainLayout from '../layouts/MainLayout';

<MainLayout>
  <h1>Welcome to Platinum Casino</h1>
</MainLayout>
```

---

### Header

**File:** `client/src/components/Header.jsx`

The top navigation bar. Fixed-position, transparent by default, becomes opaque with backdrop blur on scroll.

#### Features

- **Brand logo** -- "Virtual Casino" gradient text linking to `/`.
- **Balance indicator** -- Displays user balance in virtual currency with an "add funds" button (visible when authenticated, desktop only).
- **Desktop navigation** -- Links to Home, Games, Rewards; conditional Profile, Admin, and Logout links.
- **Mobile navigation** -- Hamburger menu with the same links plus a mobile balance display.
- **Active state** -- Current route link is highlighted with the primary color.
- **Auth-aware** -- Consumes `AuthContext` to conditionally render login/register or profile/logout.

#### Internal sub-components

- `NavLink` -- Desktop nav link with active-route detection.
- `MobileNavLink` -- Mobile nav link with active-route detection.

---

### Footer

**File:** `client/src/components/Footer.jsx`

Site-wide footer with branding, link columns, and legal information.

#### Sections

| Column     | Links                                         |
|------------|-----------------------------------------------|
| Brand      | Logo, description, social media buttons       |
| Games      | Crash, Plinko, Wheel, Roulette, Blackjack     |
| Support    | Help Center, FAQs, Contact Us, Responsible Gaming |
| Legal      | Terms, Privacy, Cookies, About Us             |

#### Internal sub-components

- `FooterLink` -- A styled `<Link>` with hover-to-accent transition.
- `SocialButton` -- Social media icon button (Facebook, Twitter, Instagram, Discord) with SVG icons.

---

### SidebarNav

**File:** `client/src/components/SidebarNav.jsx`

A 256px-wide vertical sidebar navigation used in admin and game layouts.

#### Features

- **Fixed height** -- Full viewport height with gradient background (`#0f1923` to `#1a2c3d`).
- **Collapsible categories** -- `NavCategory` groups with expand/collapse toggle.
- **Active route highlighting** -- Gold text and left border on the current route.
- **Default categories:**
  - Casino Games (Crash, Roulette, Blackjack, Plinko, Wheel) -- open by default.
  - Single items (All Games, Leaderboard, Promotions).
  - Support & Admin (Support, Admin Dashboard, Player Management, Game Statistics, Transactions).

#### Internal sub-components

- `NavCategory` -- Collapsible group with title and array of `{ path, label }` items.
- `NavItem` -- Single navigation link with active state styling.

---

## Guard Components

### AuthGuard

**File:** `client/src/components/guards/AuthGuard.jsx`

Protects routes that require authentication.

#### Behavior

1. While `loading` is `true` -- renders a full-screen `Loading` spinner with "Verifying authentication..." message.
2. If `isAuthenticated` is `false` -- redirects to `/login` via `<Navigate>`, preserving the original location in `state.from` for post-login redirect.
3. If authenticated -- renders `children`.

#### Props

| Prop       | Type   | Required | Description               |
|------------|--------|----------|---------------------------|
| `children` | `node` | Yes      | Protected route content   |

#### Usage

```jsx
import AuthGuard from '../components/guards/AuthGuard';

<Route path="/profile" element={
  <AuthGuard>
    <ProfilePage />
  </AuthGuard>
} />
```

---

### AdminGuard

**File:** `client/src/components/guards/AdminGuard.jsx`

Protects admin routes. Extends AuthGuard behavior with a role check.

#### Behavior

1. While `loading` -- renders full-screen `Loading` with "Verifying admin access..." message.
2. If not authenticated -- redirects to `/login` with location state.
3. If authenticated but `user.role !== 'admin'` -- redirects to `/` (home).
4. If admin -- renders `children`.

#### Props

| Prop       | Type   | Required | Description               |
|------------|--------|----------|---------------------------|
| `children` | `node` | Yes      | Protected admin content   |

#### Usage

```jsx
import AdminGuard from '../components/guards/AdminGuard';

<Route path="/admin/dashboard" element={
  <AdminGuard>
    <AdminDashboard />
  </AdminGuard>
} />
```

---

## Utility Components

### ErrorBoundary

**File:** `client/src/components/ErrorBoundary.jsx`

A React class component that catches JavaScript errors in its child tree and displays a fallback UI.

#### Behavior

- Uses `getDerivedStateFromError` and `componentDidCatch` lifecycle methods.
- Logs errors to the console (with a placeholder for error reporting services).
- Fallback UI displays the error message in a `Card` with two action buttons:
  - **Return to Home** -- navigates to `/`.
  - **Refresh Page** -- reloads the window.

#### Props

| Prop       | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| `children` | `node` | Yes      | Component tree to wrap with error handling |

#### Usage

```jsx
import ErrorBoundary from '../components/ErrorBoundary';

<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## Game-Specific Components

### GameErrorBoundary

**File:** `client/src/components/GameErrorBoundary.jsx`

A React Error Boundary designed specifically for individual game pages. It catches JavaScript errors within a game component tree without crashing the entire application, allowing users to recover gracefully.

#### Props

| Prop       | Type     | Default     | Required | Description                                      |
|------------|----------|-------------|----------|--------------------------------------------------|
| `children` | `node`   | --          | Yes      | Game component tree to wrap with error handling  |
| `gameName` | `string` | `'Game'`    | No       | Name of the game, used in the error heading      |

#### Behavior

- Uses `getDerivedStateFromError` and `componentDidCatch` lifecycle methods.
- Logs errors to the console with the game name for debugging (e.g., `Game error in Crash: ...`).
- Fallback UI displays a centered card with:
  - A warning icon and `"{gameName} Error"` heading.
  - A descriptive message: "Something went wrong while loading this game. Please try again."
  - **Try Again** button -- resets the error state and re-renders the child tree.
  - **Back to Games** button -- navigates to `/games`.

#### Usage

```jsx
import GameErrorBoundary from '../components/GameErrorBoundary';

<GameErrorBoundary gameName="Crash">
  <CrashGame />
</GameErrorBoundary>

<GameErrorBoundary gameName="Blackjack">
  <BlackjackGame />
</GameErrorBoundary>
```

#### Difference from ErrorBoundary

The root `ErrorBoundary` wraps the entire application and offers "Return to Home" / "Refresh Page" actions. `GameErrorBoundary` is scoped to a single game and offers "Try Again" (in-place reset) / "Back to Games" actions, keeping the rest of the application functional.

---

### MobileBottomNav

**File:** `client/src/components/MobileBottomNav.jsx`

A fixed bottom navigation bar designed for mobile screens. Provides quick access to the five primary sections of the application.

#### Navigation Items

| Icon     | Label       | Path           | Notes                        |
|----------|-------------|----------------|------------------------------|
| Home     | Home        | `/`            | Uses `end` match for exact route |
| Games    | Games       | `/games`       | Matches `/games` and sub-routes  |
| Rewards  | Rewards     | `/rewards`     | --                           |
| Trophy   | Leaderboard | `/leaderboard` | --                           |
| User     | Profile     | `/profile`     | --                           |

#### Features

- **Fixed positioning** -- Anchored to the bottom of the viewport with `z-50` stacking.
- **Active state indicators** -- The active route link uses gold text (`text-accent-gold`) and displays a small gold dot above the icon; inactive links use muted text (`text-text-muted`).
- **Safe area support** -- Respects `env(safe-area-inset-bottom)` for devices with notches or home indicators.
- **Responsive visibility** -- Only visible on small screens (`lg:hidden`); hidden on large viewports where the desktop Header navigation is shown.
- **Glass morphism** -- Uses the `glass` utility class with a subtle top border for visual separation.
- **Inline SVG icons** -- Each nav item uses a dedicated SVG icon component (`HomeIcon`, `GamesIcon`, `RewardsIcon`, `TrophyIcon`, `UserIcon`) rendered inline for optimal performance.
- **Accessibility** -- The `<nav>` element includes `aria-label="Mobile navigation"` and all icons have `aria-hidden="true"`.

#### Usage

`MobileBottomNav` is rendered inside `MainLayout` and requires no props:

```jsx
import MobileBottomNav from '../components/MobileBottomNav';

// Inside MainLayout
<>
  <Header />
  <main>{children}</main>
  <Footer />
  <MobileBottomNav />
</>
```

When this component is present, page content should account for the 64px bottom navigation height to prevent content from being obscured. This is typically handled by adding bottom padding to the main content area on small screens.

---

## Component Hierarchy Summary

```
ErrorBoundary
  AuthProvider
    ToastProvider
      MainLayout
        Header (uses AuthContext)
        {page content}
          AuthGuard / AdminGuard (uses AuthContext)
            GameErrorBoundary (wraps individual game pages)
              Card, Table, Button, Input, Badge, Modal...
                Loading, ApiStatus (utility wrappers)
        Footer
        MobileBottomNav (visible on small screens only)
        ChatBox
      Toast container (rendered by ToastProvider)
```

---

## Related Documents

- [Client State Management](./client-state-management.md) -- AuthContext, ToastContext, hooks, and services
- [Authentication](./authentication.md) -- login/register flow details
- [Games Overview](./games-overview.md) -- game-specific components and pages
- [Admin Panel](./admin-panel.md) -- admin layout using SidebarNav and AdminGuard
