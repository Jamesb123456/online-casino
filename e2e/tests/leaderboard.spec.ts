import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Leaderboard Spec
 *
 * Covers:
 *  - Navigate to /leaderboard with saved session
 *  - Verify the leaderboard page renders with period tabs
 *  - Verify switching tabs (Daily / Weekly / All Time) works
 *  - Verify ranked list has correct column structure when data is present
 */
test.describe('Leaderboard', () => {
  test.setTimeout(60_000);

  test('leaderboard page loads and shows period tabs', async ({ page }) => {
    await ensureAuthenticated(page, '/leaderboard');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Heading
    await expect(page.getByRole('heading', { name: /Leaderboard/i })).toBeVisible({ timeout: 15_000 });

    // Three period tabs
    await expect(page.getByRole('button', { name: /Daily/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Weekly/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /All Time/i })).toBeVisible();
  });

  test('All Time tab shows a ranked list or empty state', async ({ page }) => {
    await ensureAuthenticated(page, '/leaderboard');

    // Wait for loading to finish (spinner disappears)
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    // Either a list of players or the "No data yet" empty state
    const body = await page.textContent('body') || '';
    const hasData = body.includes('Rank') || body.includes('Player') || body.includes('Winnings');
    const hasEmptyState = body.includes('No data') || body.includes('No winners');

    expect(hasData || hasEmptyState).toBeTruthy();

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('can switch to Daily tab', async ({ page }) => {
    await ensureAuthenticated(page, '/leaderboard');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    const dailyTab = page.getByRole('button', { name: /Daily/i });
    await dailyTab.click();

    // Loading spinner may reappear briefly then settle
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15_000 });

    // Either data rows or empty state
    const body = await page.textContent('body') || '';
    const settled = body.includes('Rank') || body.includes('No data') || body.includes('No winners today');
    expect(settled).toBeTruthy();

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('can switch to Weekly tab', async ({ page }) => {
    await ensureAuthenticated(page, '/leaderboard');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    const weeklyTab = page.getByRole('button', { name: /Weekly/i });
    await weeklyTab.click();

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15_000 });

    const body = await page.textContent('body') || '';
    const settled = body.includes('Rank') || body.includes('No data') || body.includes('No winners this week');
    expect(settled).toBeTruthy();

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('leaderboard table has rank, player and winnings columns when populated', async ({ page }) => {
    await ensureAuthenticated(page, '/leaderboard');

    // Switch to All Time which is most likely to have entries after seeding
    const allTimeTab = page.getByRole('button', { name: /All Time/i });
    await allTimeTab.click();

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    const body = await page.textContent('body') || '';

    // If the leaderboard has data, verify the column headers exist
    if (body.includes('Rank')) {
      await expect(page.getByTestId('leaderboard-col-rank')).toBeVisible();
      await expect(page.getByTestId('leaderboard-col-player')).toBeVisible();
      await expect(page.getByTestId('leaderboard-col-winnings')).toBeVisible();
      await expect(page.getByTestId('leaderboard-col-games')).toBeVisible();
    } else {
      // Empty state — just verify no crash
      expect(body.includes('No data') || body.includes('No winners')).toBeTruthy();
    }
  });
});
