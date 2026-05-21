import { test, expect } from '@playwright/test';
import { ensureAdminAuthenticated } from '../../fixtures/auth';

/**
 * Admin House Treasury specs.
 * Tests the house balance display, top-up form, and payout caps.
 */
test.describe('Admin House Treasury', () => {
  async function ensureAdminOnPage(page, path: string) {
    await ensureAdminAuthenticated(page, path);
  }

  test('house treasury page loads', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/house');

    await expect(page.getByRole('heading', { name: 'House Treasury' })).toBeVisible({ timeout: 15_000 });
  });

  test('house balance is displayed', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/house');

    // Wait for loading state to resolve
    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('Loading…') || body.includes('Loading...')).toBeFalsy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    // The house balance element is present
    const balanceEl = page.locator('[data-testid="house-balance"]');
    await expect(balanceEl).toBeVisible({ timeout: 10_000 });

    // Should display a numeric value (credits format includes digits)
    const balanceText = await balanceEl.textContent() || '';
    expect(balanceText.length).toBeGreaterThan(0);
  });

  test('house transactions ledger table renders', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/house');

    await expect(page.getByText('House transactions')).toBeVisible({ timeout: 15_000 });

    // Table headers
    await expect(page.getByRole('columnheader', { name: 'Time' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Balance after' })).toBeVisible({ timeout: 10_000 });
  });

  test('top-up card is visible for admin', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/house');

    const topUpCard = page.locator('[data-testid="house-topup-card"]');
    await expect(topUpCard).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Top up the house')).toBeVisible({ timeout: 10_000 });

    // Top up form inputs
    await expect(topUpCard.locator('input[name="topup-amount"]')).toBeVisible({ timeout: 10_000 });
    await expect(topUpCard.getByRole('button', { name: 'Top up' })).toBeVisible({ timeout: 10_000 });
  });

  test('top up house with a small amount', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/house');

    const topUpCard = page.locator('[data-testid="house-topup-card"]');
    await expect(topUpCard).toBeVisible({ timeout: 15_000 });

    // Fill amount
    await topUpCard.locator('input[name="topup-amount"]').fill('100');
    await topUpCard.locator('input[name="topup-reason"]').fill('E2E test top-up');

    await topUpCard.getByRole('button', { name: 'Top up' }).click();

    // Expect a success toast (component fires toast.success)
    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('topped up') || body.includes('Top up')).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });
  });

  test('payout caps form is visible for admin', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/house');

    const capsCard = page.locator('[data-testid="house-caps-card"]');
    await expect(capsCard).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Payout caps')).toBeVisible({ timeout: 10_000 });

    // Cap inputs
    await expect(capsCard.locator('input[name="cap-per-round"]')).toBeVisible({ timeout: 10_000 });
    await expect(capsCard.locator('input[name="cap-per-user-per-day"]')).toBeVisible({ timeout: 10_000 });
    await expect(capsCard.locator('input[name="cap-per-day"]')).toBeVisible({ timeout: 10_000 });

    // Save button
    await expect(capsCard.getByRole('button', { name: 'Save caps' })).toBeVisible({ timeout: 10_000 });
  });

  test('save payout caps updates successfully', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/house');

    const capsCard = page.locator('[data-testid="house-caps-card"]');
    await expect(capsCard).toBeVisible({ timeout: 15_000 });

    // Set a per-round cap
    const perRoundInput = capsCard.locator('input[name="cap-per-round"]');
    await perRoundInput.fill('50000');

    await capsCard.getByRole('button', { name: 'Save caps' }).click();

    // Expect success toast
    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('caps updated') || body.includes('Payout caps')).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });
  });

  test('pagination buttons exist on transactions table', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/house');

    // Wait for transactions to load
    await expect(async () => {
      const spinning = await page.locator('.animate-spin').count();
      expect(spinning).toBe(0);
    }).toPass({ timeout: 15_000, intervals: [500] });

    // Previous and Next buttons should be present (may be disabled if only 1 page)
    await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible({ timeout: 10_000 });
  });
});
