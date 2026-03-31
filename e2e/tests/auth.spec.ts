import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login with valid credentials redirects to home', async ({ browser }) => {
    // Use a fresh context with explicitly empty storageState (unauthenticated)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the login form to be interactive
    await page.locator('#username').waitFor({ state: 'visible', timeout: 15_000 });

    // Fill in credentials
    await page.locator('#username').fill('player1');
    await page.locator('#password').fill('password123');

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // Wait for redirect away from login page (SPA client-side navigation).
    // Use Playwright's auto-retrying assertion instead of waitForFunction
    // which is more reliable for SPA navigations.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    await context.close();
  });

  test('login with invalid credentials shows error message', async ({ browser }) => {
    // Use a fresh context with explicitly empty storageState (unauthenticated)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the login form to be interactive
    await page.locator('#username').waitFor({ state: 'visible', timeout: 15_000 });

    // Fill in bad credentials
    await page.locator('#username').fill('wronguser');
    await page.locator('#password').fill('wrongpassword');

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // Wait for the error alert to appear
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });

    // The error message should contain some text indicating failure
    await expect(errorAlert).not.toBeEmpty();

    // Should remain on the login page
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  test('accessing protected route without auth redirects to login', async ({ browser }) => {
    // Use a fresh context with explicitly empty storageState (unauthenticated)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // Try to access a protected game page directly
    await page.goto('/games/crash');
    await page.waitForLoadState('domcontentloaded');

    // AuthGuard first shows "Verifying authentication..." while loading,
    // then performs a client-side redirect via React Router <Navigate>.
    // Use Playwright's auto-retrying assertion which handles SPA navigations.
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    await context.close();
  });
});
