import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

test.describe('Wheel Game', () => {
  test.setTimeout(60_000);

  test('can place a bet, spin the wheel, and see result', async ({ page }) => {
    await ensureAuthenticated(page, '/games/wheel');

    // If error boundary triggered on load, try again
    const tryAgainButton = page.getByRole('button', { name: 'Try Again' });
    if (await tryAgainButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tryAgainButton.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
    }

    // Verify no error boundary
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for bet input (game loaded and socket connected)
    const betInput = page.locator('#wheel-bet-amount');
    await expect(betInput).toBeVisible({ timeout: 15_000 });

    // Set bet amount
    await betInput.clear();
    await betInput.fill('10');

    // Select easy difficulty
    await page.getByRole('button', { name: /easy/i }).click();

    // Verify Spin button is ready
    const spinButton = page.getByRole('button', { name: /spin the wheel/i });
    await expect(spinButton).toBeVisible({ timeout: 5_000 });
    await expect(spinButton).toBeEnabled({ timeout: 5_000 });

    // Place the bet by spinning
    await spinButton.click();

    // Verify no error boundary after bet placement
    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for spin to complete — button re-enables
    await expect(spinButton).toBeEnabled({ timeout: 30_000 });

    // Verify game result appeared — profit/loss text or game history
    await expect(async () => {
      const pageText = await page.textContent('body') || '';
      const hasResult =
        pageText.includes('+$') ||
        pageText.includes('-$') ||
        pageText.includes('Game History') ||
        pageText.includes('Total Wagered');
      expect(hasResult).toBeTruthy();
    }).toPass({ timeout: 10_000, intervals: [500] });

    // Verify no error boundary after result
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('can place a second consecutive bet with different difficulty', async ({ page }) => {
    await ensureAuthenticated(page, '/games/wheel');

    const tryAgainButton = page.getByRole('button', { name: 'Try Again' });
    if (await tryAgainButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tryAgainButton.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
    }

    const betInput = page.locator('#wheel-bet-amount');
    await expect(betInput).toBeVisible({ timeout: 15_000 });
    const spinButton = page.getByRole('button', { name: /spin the wheel/i });

    // --- First bet: easy ---
    await betInput.clear();
    await betInput.fill('10');
    await page.getByRole('button', { name: /easy/i }).click();
    await expect(spinButton).toBeEnabled({ timeout: 5_000 });
    await spinButton.click();
    await expect(spinButton).toBeEnabled({ timeout: 30_000 });

    // Verify no crash after first spin
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // --- Second bet: medium, different amount ---
    await betInput.clear();
    await betInput.fill('25');
    await page.getByRole('button', { name: /medium/i }).click();
    await expect(spinButton).toBeEnabled({ timeout: 5_000 });
    await spinButton.click();

    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    await expect(spinButton).toBeEnabled({ timeout: 30_000 });

    // Verify no error boundary after second spin
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Verify spin history shows entries
    await expect(async () => {
      const pageText = await page.textContent('body') || '';
      expect(pageText).toContain('Spin History');
    }).toPass({ timeout: 5_000, intervals: [500] });
  });
});
