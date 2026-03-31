import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

test.describe('Plinko Game', () => {
  test.setTimeout(120_000);

  test('can place a bet, drop ball, and see result', async ({ page }) => {
    await ensureAuthenticated(page, '/games/plinko');

    // Verify no error boundary on initial load
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for bet input to appear (game loaded and socket connected)
    const betInput = page.locator('#plinko-bet-amount');
    await expect(betInput).toBeVisible({ timeout: 10_000 });

    // Set bet amount
    await betInput.clear();
    await betInput.fill('10');

    // Select low risk
    await page.getByRole('button', { name: /low/i }).click();

    // Verify Drop Ball button is ready
    const dropBallButton = page.getByRole('button', { name: 'Drop Ball' });
    await expect(dropBallButton).toBeVisible();
    await expect(dropBallButton).toBeEnabled();

    // Place the bet by dropping the ball
    await dropBallButton.click();

    // Verify no error boundary after bet placement
    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Button should show "Ball Dropping..." while animating
    // Then re-enable when animation completes
    await expect(dropBallButton).toBeEnabled({ timeout: 60_000 });

    // Verify game result appeared (profit/loss text)
    // Plinko shows a result popup with profit amount like "+$X.XX" or "-$X.XX"
    await expect(async () => {
      const pageText = await page.textContent('body') || '';
      // Result popup shows formatted profit, or game history shows bet entry
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

  test('can place a second consecutive bet with different risk', async ({ page }) => {
    await ensureAuthenticated(page, '/games/plinko');

    const betInput = page.locator('#plinko-bet-amount');
    await expect(betInput).toBeVisible({ timeout: 10_000 });
    const dropBallButton = page.getByRole('button', { name: 'Drop Ball' });

    // --- First bet: low risk ---
    await betInput.clear();
    await betInput.fill('10');
    await page.getByRole('button', { name: /low/i }).click();
    await dropBallButton.click();
    await expect(dropBallButton).toBeEnabled({ timeout: 60_000 });

    // Verify no crash after first bet
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // --- Second bet: medium risk, different amount ---
    await betInput.clear();
    await betInput.fill('25');
    await page.getByRole('button', { name: /medium/i }).click();
    await dropBallButton.click();

    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    await expect(dropBallButton).toBeEnabled({ timeout: 60_000 });

    // Verify no error boundary after second bet
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });
});
