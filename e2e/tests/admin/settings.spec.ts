import { test, expect } from '@playwright/test';
import { ensureAdminAuthenticated } from '../../fixtures/auth';

/**
 * Admin Settings specs.
 * Tests all five settings cards, saves a value, and verifies persistence.
 */
test.describe('Admin Settings', () => {
  async function ensureAdminOnPage(page, path: string) {
    await ensureAdminAuthenticated(page, path);
  }

  test('settings page loads', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 15_000 });
  });

  test('currency and defaults card is visible', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    const card = page.locator('[data-testid="settings-defaults-card"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Currency & defaults')).toBeVisible({ timeout: 10_000 });

    // Currency name display
    await expect(page.locator('[data-testid="currency-name"]')).toBeVisible({ timeout: 10_000 });
  });

  test('payout caps card is visible', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    const card = page.locator('[data-testid="settings-caps-card"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Payout caps')).toBeVisible({ timeout: 10_000 });

    // Wait for loading to finish (capsLoading state)
    await expect(async () => {
      const cardText = await card.textContent() || '';
      expect(cardText.includes('Loading...')).toBeFalsy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    await expect(card.locator('input[name="cap-per-round"]')).toBeVisible({ timeout: 10_000 });
    await expect(card.locator('input[name="cap-per-user-per-day"]')).toBeVisible({ timeout: 10_000 });
    await expect(card.locator('input[name="cap-per-day"]')).toBeVisible({ timeout: 10_000 });
  });

  test('alert thresholds card is visible', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    const card = page.locator('[data-testid="settings-alerts-card"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Alert thresholds')).toBeVisible({ timeout: 10_000 });

    await expect(async () => {
      const cardText = await card.textContent() || '';
      expect(cardText.includes('Loading...')).toBeFalsy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    await expect(card.locator('input[name="alert-big-win"]')).toBeVisible({ timeout: 10_000 });
    await expect(card.locator('input[name="alert-house-low"]')).toBeVisible({ timeout: 10_000 });
    await expect(card.locator('input[name="alert-rapid-bets"]')).toBeVisible({ timeout: 10_000 });
  });

  test('login reward config card is visible', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    const card = page.locator('[data-testid="settings-login-rewards-card"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Login reward config')).toBeVisible({ timeout: 10_000 });

    await expect(async () => {
      const cardText = await card.textContent() || '';
      expect(cardText.includes('Loading...')).toBeFalsy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    await expect(card.locator('input[name="reward-min"]')).toBeVisible({ timeout: 10_000 });
    await expect(card.locator('input[name="reward-max"]')).toBeVisible({ timeout: 10_000 });
  });

  test('min house edge floor card is visible', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    const card = page.locator('[data-testid="settings-house-edge-floor-card"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Min house edge floor')).toBeVisible({ timeout: 10_000 });

    await expect(async () => {
      const cardText = await card.textContent() || '';
      expect(cardText.includes('Loading...')).toBeFalsy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    await expect(card.locator('input[name="house-edge-floor"]')).toBeVisible({ timeout: 10_000 });
  });

  test('save default new-user balance and verify it persists', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    const card = page.locator('[data-testid="settings-defaults-card"]');
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Wait for loading
    await expect(async () => {
      const cardText = await card.textContent() || '';
      expect(cardText.includes('Loading...')).toBeFalsy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    const input = card.locator('input[name="default-new-user-balance"]');
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Set a distinctive value
    await input.fill('12345');

    await card.getByRole('button', { name: 'Save defaults' }).click();

    // Success toast expected
    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('updated') || body.includes('balance updated')).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    // Reload the page and verify the value persisted
    await page.goto('/admin/settings');
    await page.waitForLoadState('domcontentloaded');

    await expect(async () => {
      const cardText = await page.locator('[data-testid="settings-defaults-card"]').textContent() || '';
      expect(cardText.includes('Loading...')).toBeFalsy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    // The saved value should be in the input
    const persistedInput = page.locator('input[name="default-new-user-balance"]');
    await expect(persistedInput).toHaveValue('12345', { timeout: 10_000 });
  });

  test('save alert threshold', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    const card = page.locator('[data-testid="settings-alerts-card"]');
    await expect(card).toBeVisible({ timeout: 15_000 });

    await expect(async () => {
      const cardText = await card.textContent() || '';
      expect(cardText.includes('Loading...')).toBeFalsy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    // Fill the big win threshold
    const bigWinInput = card.locator('input[name="alert-big-win"]');
    await bigWinInput.fill('50000');

    await card.getByRole('button', { name: 'Save thresholds' }).click();

    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('Alert thresholds updated') || body.includes('updated')).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });
  });

  test('no error boundary on settings load', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/settings');

    await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 15_000 });
  });
});
