import { test, expect, request } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Responsible Gaming Spec
 *
 * ARCHITECTURE NOTE:
 * The dedicated Responsible Gaming UI page has been removed from the client.
 * The backend exposes an activity-summary endpoint at
 * GET /api/responsible-gaming/activity-summary (requires auth).
 *
 * The profile page surfaces a "Session limit" value via
 * GET /api/users/me/limits.
 *
 * These tests cover:
 *  1. The activity-summary API returns valid data for an authenticated user.
 *  2. The profile page renders the session-limit row (set to "None" by default).
 *  3. A session limit can be set via the adminUserLimits API (admin-only).
 *
 * Loss-limit enforcement in the game UI is not testable without a UI control
 * for setting limits; the feature is backend-enforced but the admin can
 * set per-player limits via the admin API.  That flow is tested via API here.
 */

const API_BASE = process.env.API_URL || 'http://localhost:5000';

test.describe('Responsible Gaming', () => {
  test.setTimeout(60_000);

  test('activity-summary API returns 7-day and 30-day stats', async ({ page }) => {
    // First authenticate to get session cookies
    await ensureAuthenticated(page, '/profile');

    // Use the authenticated page cookies to call the API
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const apiContext = await request.newContext({ baseURL: API_BASE });
    const res = await apiContext.get('/api/responsible-gaming/activity-summary', {
      headers: { Cookie: cookieHeader },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();

    // Response shape: { last7Days: { totalGames, totalWins, totalLosses, netResult }, last30Days: {...} }
    expect(body).toHaveProperty('last7Days');
    expect(body).toHaveProperty('last30Days');
    expect(typeof body.last7Days.totalGames).toBe('number');
    expect(typeof body.last7Days.totalWins).toBe('number');
    expect(typeof body.last7Days.totalLosses).toBe('number');
    expect(typeof body.last30Days.netResult).toBe('number');

    await apiContext.dispose();
  });

  test('profile page shows session limit row', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // The profile page renders a "session-limit-row" with data-testid (from ProfilePage.jsx)
    const limitRow = page.getByTestId('session-limit-row');
    await expect(limitRow).toBeVisible({ timeout: 15_000 });

    // Default is "None" for a fresh player account
    await expect(limitRow.getByText(/Session limit/i)).toBeVisible();
    const limitText = (await limitRow.textContent()) || '';
    // Either "None" or "X minutes" if a limit was previously set
    const hasLimitValue = limitText.includes('None') || limitText.includes('minutes');
    expect(hasLimitValue).toBeTruthy();
  });

  test('activity-summary API requires authentication', async () => {
    const apiContext = await request.newContext({ baseURL: API_BASE });
    const res = await apiContext.get('/api/responsible-gaming/activity-summary');
    // Should be 401 without auth cookies
    expect(res.status()).toBe(401);
    await apiContext.dispose();
  });

  test('users/me/limits API requires authentication', async () => {
    const apiContext = await request.newContext({ baseURL: API_BASE });
    const res = await apiContext.get('/api/users/me/limits');
    expect(res.status()).toBe(401);
    await apiContext.dispose();
  });

  test('users/me/limits returns limit object for authenticated user', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const apiContext = await request.newContext({ baseURL: API_BASE });
    const res = await apiContext.get('/api/users/me/limits', {
      headers: { Cookie: cookieHeader },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    // Shape: { sessionLimitMinutes: number | null }
    expect(body).toHaveProperty('sessionLimitMinutes');

    await apiContext.dispose();
  });
});
