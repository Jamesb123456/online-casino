import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  // Login with seeded admin credentials
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Wait for the login form to be interactive
  await page.locator('#username').waitFor({ state: 'visible', timeout: 15_000 });

  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin123');
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from login page — admin is redirected to home or dashboard
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

  // Ensure the page is fully loaded
  await page.waitForLoadState('domcontentloaded');

  // Verify the admin has access to admin routes
  await page.goto('/admin/dashboard');
  await page.waitForLoadState('domcontentloaded');

  // Wait for AdminGuard to settle — should NOT be on login page
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

  // Save admin authentication state
  await page.context().storageState({ path: authFile });
});
