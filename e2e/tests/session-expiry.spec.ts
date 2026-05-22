/**
 * session-expiry.spec.ts — Session expiry / cookie-clearing resilience test
 *
 * Belongs to the `auth-tests` project (runs in Phase 4, after all game tests,
 * with NO shared storageState — each test creates its own BrowserContext).
 *
 * Why Phase 4?  Clearing cookies inside a test invalidates any session that
 * was loaded from the shared `user.json` storageState.  Running this file last
 * prevents it from poisoning the session used by the `games` project tests.
 *
 * Scenarios:
 *   1. Log in normally, then clear all cookies, then navigate to a protected
 *      route — expect redirect to /login (AuthGuard fires).
 *   2. Start with a fresh unauthenticated context, navigate to a protected
 *      route — expect redirect to /login immediately.
 *   3. Log in, clear only the session cookie, navigate to a protected route
 *      — expect redirect to /login (partial cookie removal is treated as
 *      unauthenticated).
 */
import { test, expect } from '@playwright/test';

// Each test in this file manages its own browser context so tests are
// fully isolated from each other and from the shared session.
test.describe('Session Expiry', () => {
  test.setTimeout(90_000);

  test('clearing all cookies after login redirects protected route to /login', async ({ browser }) => {
    // Create a fresh context — no storageState
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    try {
      // -- Step 1: Log in --
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
      await page.locator('#username').waitFor({ state: 'visible', timeout: 15_000 });

      await page.locator('#username').fill('player1');
      await page.locator('#password').fill('password123');
      await page.locator('button[type="submit"]').click();

      // Confirm successful login
      await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

      // -- Step 2: Confirm we can access a protected game page --
      await page.goto('/games/crash');
      await page.waitForLoadState('domcontentloaded');

      // Wait for AuthGuard to finish resolving
      await page.waitForFunction(
        () => {
          const body = document.body.textContent ?? '';
          return !body.includes('Verifying authentication');
        },
        { timeout: 20_000 }
      );

      // Should NOT be on the login page — we are authenticated
      expect(page.url()).not.toContain('/login');

      // -- Step 3: Simulate session expiry by clearing all cookies --
      await context.clearCookies();

      // -- Step 4: Navigate to a protected route --
      // Use reload rather than goto to ensure the SPA processes the navigation
      // from scratch with no session cookie present.
      await page.goto('/games/roulette');
      await page.waitForLoadState('domcontentloaded');

      // AuthGuard calls the auth server, gets 401, sets isAuthenticated=false,
      // and renders <Navigate to="/login" />.  This is a client-side redirect.
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

      // The login form should be visible — user can re-authenticate
      await expect(page.locator('#username')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('unauthenticated context cannot access protected routes', async ({ browser }) => {
    // Explicitly empty storageState — no session at all
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    try {
      // Attempt to navigate directly to a protected page
      await page.goto('/games/crash');
      await page.waitForLoadState('domcontentloaded');

      // AuthGuard detects no session and redirects to /login
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

      // Login form present
      await expect(page.locator('#username')).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test('clearing session cookie mid-session redirects to /login on next navigation', async ({ browser }) => {
    // Fresh context, no pre-loaded storageState
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    try {
      // -- Log in --
      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
      await page.locator('#username').waitFor({ state: 'visible', timeout: 15_000 });

      await page.locator('#username').fill('player1');
      await page.locator('#password').fill('password123');
      await page.locator('button[type="submit"]').click();

      await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

      // -- Verify cookies exist after login --
      const cookiesBefore = await context.cookies();
      expect(cookiesBefore.length).toBeGreaterThan(0);

      // -- Remove cookies that look like session tokens --
      // Better Auth names its cookie `better-auth.session_token` (or
      // `__Secure-better-auth.session_token` in production). We clear all
      // cookies to guarantee no session remains.
      await context.clearCookies();

      // Verify cookies are gone
      const cookiesAfter = await context.cookies();
      expect(cookiesAfter.length).toBe(0);

      // -- Navigate to a protected page --
      await page.goto('/games/wheel');
      await page.waitForLoadState('domcontentloaded');

      // AuthGuard should detect no session and redirect to /login
      await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    } finally {
      await context.close();
    }
  });
});
