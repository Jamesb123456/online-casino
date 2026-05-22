import { test, expect, request } from '@playwright/test';

/**
 * Register Spec
 *
 * There is no dedicated sign-up UI page — registration is handled by the
 * Better Auth REST API at /api/auth/sign-up/username.  These tests:
 *  1. Verify a new user can register via the API and then log in through the UI.
 *  2. Verify duplicate username returns an error.
 *  3. Verify validation errors (missing fields) are surfaced.
 *
 * All tests use fresh browser contexts with no stored session so they
 * don't contaminate the auth-setup session saved by global-setup.
 */

// Generate a unique username per test run to avoid conflicts across re-runs.
const uniqueUser = () => `testuser_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
const API_BASE = process.env.API_URL || 'http://localhost:5000';

test.describe('User Registration', () => {
  test.setTimeout(60_000);

  test('can register a new account via API and log in via UI', async ({ browser }) => {
    const username = uniqueUser();
    const password = 'Test1234!';

    // Step 1: Register via Better Auth REST API
    const apiContext = await request.newContext({ baseURL: API_BASE });
    const registerRes = await apiContext.post('/api/auth/sign-up/username', {
      data: { username, password, name: username },
    });

    // Better Auth returns 200 on success
    expect(registerRes.status()).toBe(200);
    const body = await registerRes.json();
    expect(body).toHaveProperty('user');
    expect(body.user.username).toBe(username);
    await apiContext.dispose();

    // Step 2: Log in via the UI with the new credentials
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#username').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('button[type="submit"]').click();

    // Should redirect away from /login after successful sign-in
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    // Home page should be rendered (not an error page)
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    await context.close();
  });

  test('duplicate username registration returns error', async () => {
    const username = uniqueUser();
    const password = 'Test1234!';

    const apiContext = await request.newContext({ baseURL: API_BASE });

    // First registration — should succeed
    const first = await apiContext.post('/api/auth/sign-up/username', {
      data: { username, password, name: username },
    });
    expect(first.status()).toBe(200);

    // Second registration with same username — should fail
    const second = await apiContext.post('/api/auth/sign-up/username', {
      data: { username, password, name: username },
    });
    // Better Auth returns 422 or 400 for duplicate usernames
    expect(second.status()).toBeGreaterThanOrEqual(400);

    await apiContext.dispose();
  });

  test('registration with missing password returns validation error', async () => {
    const apiContext = await request.newContext({ baseURL: API_BASE });

    const res = await apiContext.post('/api/auth/sign-up/username', {
      data: { username: uniqueUser(), name: 'test' },
      // password intentionally omitted
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
    await apiContext.dispose();
  });

  test('login page accessible and shows form for unauthenticated visitors', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // The login form must be rendered
    await expect(page.locator('#username')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#password')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Page should indicate it is the sign-in page
    await expect(page.getByText(/Sign in/i)).toBeVisible();

    await context.close();
  });
});
