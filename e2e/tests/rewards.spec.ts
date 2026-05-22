import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Daily Rewards Spec
 *
 * Covers:
 *  1. Rewards page loads with correct heading.
 *  2. Either a "Claim Reward" button is shown (if eligible) or the next-reward
 *     countdown is displayed (already claimed today).
 *  3. If eligible, clicking Claim Reward shows a success message with the
 *     credited amount and new balance.
 *  4. Reward history table is rendered.
 */
test.describe('Daily Rewards', () => {
  test.setTimeout(60_000);

  test('rewards page loads and shows heading', async ({ page }) => {
    await ensureAuthenticated(page, '/rewards');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    await expect(page.getByRole('heading', { name: /Daily Rewards/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('shows claim button or already-claimed countdown', async ({ page }) => {
    await ensureAuthenticated(page, '/rewards');

    // Wait for the loading spinner to disappear
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    const body = await page.textContent('body') || '';

    const canClaim = body.includes('Claim Reward') || body.includes('You have a daily reward');
    const alreadyClaimed =
      body.includes("You've already claimed") ||
      body.includes('Next reward available') ||
      body.includes('hours') ||
      body.includes('minutes');

    expect(canClaim || alreadyClaimed).toBeTruthy();
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('claiming reward shows success message with amount', async ({ page }) => {
    await ensureAuthenticated(page, '/rewards');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    const claimButton = page.getByRole('button', { name: /Claim Reward/i });
    const claimButtonVisible = await claimButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (!claimButtonVisible) {
      // Reward already claimed today — skip the claim step
      test.info().annotations.push({
        type: 'info',
        description: 'Daily reward already claimed for player1 today — skipping claim step.',
      });
      // Just verify the "already claimed" state is shown properly
      const body = await page.textContent('body') || '';
      expect(
        body.includes("You've already claimed") ||
        body.includes('Next reward available') ||
        body.includes('hours')
      ).toBeTruthy();
      return;
    }

    // Click Claim Reward
    await claimButton.click();

    // Wait for success result panel to appear
    await expect(page.getByText(/Congratulations/i)).toBeVisible({ timeout: 15_000 });

    // Amount shown (e.g. "50 Credits")
    const body = await page.textContent('body') || '';
    expect(body.includes('Credits') || body.includes('added to your account')).toBeTruthy();

    // "New balance" line
    expect(body.includes('New balance')).toBeTruthy();

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('reward history table is rendered', async ({ page }) => {
    await ensureAuthenticated(page, '/rewards');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    // History card heading
    await expect(page.getByText('Reward History')).toBeVisible({ timeout: 10_000 });

    // Table headers
    await expect(page.getByRole('columnheader', { name: /Date/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Amount/i })).toBeVisible();

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('total rewards earned is displayed', async ({ page }) => {
    await ensureAuthenticated(page, '/rewards');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    await expect(page.getByText('Total Rewards Earned:')).toBeVisible({ timeout: 10_000 });
  });
});
