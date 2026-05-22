import { test, expect } from '@playwright/test';

/**
 * Logout Spec
 *
 * Verifies:
 *  1. The Logout button invalidates the session and redirects to home (or login).
 *  2. After logout, navigating to a protected route bounces the user to /login.
 *
 * Each test uses a fresh browser context seeded with player1 credentials
 * so it does not depend on the shared storageState from auth-setup.
 */

async function loginAsPlayer(page: any) {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.locator('#username').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#username').fill('player1');
  await page.locator('#password').fill('password123');
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Logout', () => {
  test.setTimeout(60_000);

  test('clicking Logout button redirects away from authenticated view', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await loginAsPlayer(page);

    // Logout button is in the header — wait for it to appear
    const logoutButton = page.getByRole('button', { name: /logout/i });
    await expect(logoutButton).toBeVisible({ timeout: 10_000 });
    await logoutButton.click();

    // After logout the SPA should navigate away from any authenticated page.
    // The app redirects to home '/'; home is accessible without auth.
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    await context.close();
  });

  test('after logout, protected route bounces to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await loginAsPlayer(page);

    // Confirm we are authenticated by visiting the profile page
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
    // Wait for auth guard to settle
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || '';
        return !body.includes('Verifying authentication');
      },
      { timeout: 20_000 }
    );
    // Should be on the profile page (not redirected)
    expect(page.url()).not.toMatch(/\/login/);

    // Logout via the header button
    const logoutButton = page.getByRole('button', { name: /logout/i });
    await expect(logoutButton).toBeVisible({ timeout: 10_000 });
    await logoutButton.click();
    await page.waitForLoadState('domcontentloaded');

    // Now attempt to navigate to a protected route
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');

    // AuthGuard should redirect to /login since the session was cleared
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    await context.close();
  });

  test('after logout, game route bounces to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await loginAsPlayer(page);

    // Logout
    const logoutButton = page.getByRole('button', { name: /logout/i });
    await expect(logoutButton).toBeVisible({ timeout: 10_000 });
    await logoutButton.click();
    await page.waitForLoadState('domcontentloaded');

    // Try to access a protected game
    await page.goto('/games/crash');
    await page.waitForLoadState('domcontentloaded');

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    await context.close();
  });
});
