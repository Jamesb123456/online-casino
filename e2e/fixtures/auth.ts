import { Page, expect } from '@playwright/test';

/**
 * Ensure the page is authenticated.
 *
 * Navigates to the game URL. If the AuthGuard redirects to /login
 * (because the session cookie cache has expired), performs a fresh
 * login and then retries the navigation. The session_token cookie
 * (24 h TTL) is always present from storageState, so getSession()
 * usually works on the first attempt; but under parallel load the
 * client-side cookie cache (5 min) can cause spurious redirects.
 */
export async function ensureAuthenticated(page: Page, targetUrl: string) {
  await page.goto(targetUrl);
  await page.waitForLoadState('domcontentloaded');

  // Wait for the SPA to finish its auth resolution. The AuthGuard shows
  // "Verifying authentication..." while loading, then either renders the
  // game (auth ok) or redirects to /login (auth failed). We need to wait
  // for the URL to stabilise into one of those two states.
  //
  // Strategy: poll until either (a) we are on the game page with content,
  // or (b) we have been redirected to /login.
  await page.waitForFunction(
    (target: string) => {
      const path = window.location.pathname;
      const body = document.body.textContent || '';
      const isLoading = body.includes('Verifying authentication');
      // Settled = not loading, and either on target page or on login
      return !isLoading && (path.includes('/login') || path === target || path.startsWith(target));
    },
    targetUrl,
    { timeout: 20_000 }
  );

  // Check if we were redirected to login
  const currentUrl = page.url();
  const isOnLogin = currentUrl.includes('/login');

  if (isOnLogin) {
    // Session expired — log in fresh using the UI.
    // Add a small delay to avoid rate limiting from Better Auth
    // when multiple tests run in sequence.
    await page.waitForTimeout(1000);

    await page.locator('#username').waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('#username').fill('player1');
    await page.locator('#password').fill('password123');
    await page.locator('button[type="submit"]').click();

    // Wait for redirect away from login — use Playwright assertion with auto-retry
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    // Now navigate to the target game page
    await page.goto(targetUrl);
    await page.waitForLoadState('domcontentloaded');

    // Wait for auth context to settle on the game page
    await page.waitForFunction(
      (target: string) => {
        const path = window.location.pathname;
        const body = document.body.textContent || '';
        const isLoading = body.includes('Verifying authentication');
        return !isLoading && (path.includes('/login') || path === target || path.startsWith(target));
      },
      targetUrl,
      { timeout: 20_000 }
    );
  }
}
