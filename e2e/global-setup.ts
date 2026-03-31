import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Login with seeded player credentials
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Wait for the login form to be interactive
  await page.locator('#username').waitFor({ state: 'visible', timeout: 15_000 });

  await page.locator('#username').fill('player1');
  await page.locator('#password').fill('password123');
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from login page — use polling to handle SPA navigation
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

  // Ensure the page is fully loaded
  await page.waitForLoadState('domcontentloaded');

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
