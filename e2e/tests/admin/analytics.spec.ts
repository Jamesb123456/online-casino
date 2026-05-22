import { test, expect } from '@playwright/test';
import { ensureAdminAuthenticated } from '../../fixtures/auth';

/**
 * Admin Game Analytics specs.
 * Verifies the analytics page renders KPI cards, chart containers, and per-game cards.
 */
test.describe('Admin Game Analytics', () => {
  async function ensureAdminOnPage(page, path: string) {
    await ensureAdminAuthenticated(page, path);
  }

  test('game analytics page loads', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/analytics/games');

    await expect(page.getByRole('heading', { name: 'Game Analytics' })).toBeVisible({ timeout: 15_000 });
  });

  test('loading spinner resolves into content or empty state', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/analytics/games');

    // Wait for either the KPI cards or the empty state to appear
    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      const hasContent =
        body.includes('Total Sessions') ||
        body.includes('Total Wagered') ||
        body.includes('No game data available');
      expect(hasContent).toBeTruthy();
    }).toPass({ timeout: 20_000, intervals: [500] });
  });

  test('KPI stat cards are visible when data exists', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/analytics/games');

    // Wait for loading to finish
    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('Loading game analytics')).toBeFalsy();
    }).toPass({ timeout: 20_000, intervals: [500] });

    const body = await page.locator('body').textContent() || '';
    if (body.includes('No game data available')) {
      // Empty state is acceptable
      test.info().annotations.push({ type: 'info', description: 'No game data for the analytics period.' });
      return;
    }

    // With data, KPI cards should be visible
    await expect(page.getByTestId('kpi-total-sessions')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('kpi-total-wagered')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('kpi-house-profit')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('kpi-house-edge')).toBeVisible({ timeout: 10_000 });
  });

  test('chart sections are visible when data exists', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/analytics/games');

    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('Loading game analytics')).toBeFalsy();
    }).toPass({ timeout: 20_000, intervals: [500] });

    const body = await page.locator('body').textContent() || '';
    if (body.includes('No game data available')) {
      test.info().annotations.push({ type: 'info', description: 'No game data — charts not rendered.' });
      return;
    }

    // Chart headings
    await expect(page.getByTestId('chart-house-profit-by-game')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Revenue Distribution')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Games Overview')).toBeVisible({ timeout: 10_000 });
  });

  test('period selector is visible', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/analytics/games');

    // Wait for page to load
    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('Loading game analytics')).toBeFalsy();
    }).toPass({ timeout: 20_000, intervals: [500] });

    // PeriodSelector renders period buttons (7d, 30d, 90d, all-time etc)
    // Check for a common period option
    const periodButtons = page.getByRole('button').filter({ hasText: /7d|30d|90d|All/i });
    const cnt = await periodButtons.count();
    expect(cnt).toBeGreaterThanOrEqual(1);
  });

  test('per-game card links to detail page', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/analytics/games');

    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      expect(body.includes('Loading game analytics')).toBeFalsy();
    }).toPass({ timeout: 20_000, intervals: [500] });

    const body = await page.locator('body').textContent() || '';
    if (body.includes('No game data available')) {
      test.info().annotations.push({ type: 'info', description: 'No game cards to click.' });
      return;
    }

    // Click the first game card (they're <button> elements)
    const gameCard = page.getByRole('button').filter({ hasText: /View Details/i }).first();
    await expect(gameCard).toBeVisible({ timeout: 10_000 });
    await gameCard.click();

    // Should navigate to /admin/analytics/games/:gameType
    await expect(page).toHaveURL(/\/admin\/analytics\/games\/\w+/, { timeout: 15_000 });
  });

  test('no error boundary on analytics load', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/analytics/games');

    await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 20_000 });
  });
});
