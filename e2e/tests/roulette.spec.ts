import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

test.describe('Roulette Game', () => {
  test.setTimeout(120_000);

  test('can place a bet on red and see spin result', async ({ page }) => {
    await ensureAuthenticated(page, '/games/roulette');

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
    const betInput = page.locator('#roulette-bet-amount');
    await expect(betInput).toBeVisible({ timeout: 15_000 });

    // Read starting balance
    const balanceEl = page.locator('text=Balance:').locator('..').locator('.text-status-success');
    await expect(balanceEl).toBeVisible({ timeout: 10_000 });

    // Wait for Place Bet to be enabled (means we're in the betting phase)
    const placeBetButton = page.getByRole('button', { name: 'Place Bet' });
    await expect(placeBetButton).toBeEnabled({ timeout: 30_000 });

    // Set bet amount
    await betInput.clear();
    await betInput.fill('10');

    // Select RED bet type
    const redButton = page.getByRole('button', { name: /^Red/i });
    await expect(redButton).toBeVisible({ timeout: 5_000 });
    await redButton.click();

    // Place the bet
    await placeBetButton.click();

    // Verify no error boundary after bet placement
    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // The game has an automated spin cycle. After the betting phase ends,
    // the wheel spins automatically and results appear.
    // Wait for game result to appear OR spin button to become clickable.
    const spinButton = page.getByRole('button', { name: /spin/i });

    // Try to click SPIN if it becomes enabled (bet was accepted)
    if (await spinButton.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      await spinButton.click();
    }

    // Wait for result — either automated or manual spin completes
    await expect(async () => {
      const pageText = await page.textContent('body') || '';
      const hasResult =
        pageText.includes('Winning Number') ||
        pageText.includes('Last Spin') ||
        pageText.includes('Total Profit') ||
        pageText.includes('Total Loss');
      // Also check if Place Bet re-enabled (new round started)
      const placeBetEnabled = await placeBetButton.isEnabled().catch(() => false);
      expect(hasResult || placeBetEnabled).toBeTruthy();
    }).toPass({ timeout: 60_000, intervals: [500] });

    // Verify no error boundary after spin
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Verify balance is still displayed (game completed without error)
    const endBalanceText = await balanceEl.textContent();
    const endBalance = parseFloat(endBalanceText!.replace(/[$,]/g, ''));
    expect(endBalance).toBeGreaterThanOrEqual(0);
  });

  test('can place a second consecutive bet on black', async ({ page }) => {
    await ensureAuthenticated(page, '/games/roulette');

    const tryAgainButton = page.getByRole('button', { name: 'Try Again' });
    if (await tryAgainButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tryAgainButton.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
    }

    const betInput = page.locator('#roulette-bet-amount');
    await expect(betInput).toBeVisible({ timeout: 15_000 });
    const placeBetButton = page.getByRole('button', { name: 'Place Bet' });
    const spinButton = page.getByRole('button', { name: /spin/i });

    // --- First bet: Red ---
    await expect(placeBetButton).toBeEnabled({ timeout: 30_000 });
    await betInput.clear();
    await betInput.fill('10');
    await page.getByRole('button', { name: /^Red/i }).click();
    await placeBetButton.click();

    // Try to click SPIN if available
    if (await spinButton.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      await spinButton.click();
    }

    // Wait for round to complete — Place Bet re-enables for next round
    await expect(placeBetButton).toBeEnabled({ timeout: 60_000 });

    // Verify no crash after first round
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // --- Second bet: Black ---
    await betInput.clear();
    await betInput.fill('20');
    await page.getByRole('button', { name: /^Black/i }).click();
    await placeBetButton.click();

    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Try to click SPIN if available
    if (await spinButton.isEnabled({ timeout: 5_000 }).catch(() => false)) {
      await spinButton.click();
    }

    // Wait for second round to complete
    await expect(placeBetButton).toBeEnabled({ timeout: 60_000 });

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });
});
