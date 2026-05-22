import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Slots Game Spec
 *
 * Covers:
 *  - Navigate to /games/slots with saved session
 *  - Verify 5 reels are rendered
 *  - Place a bet and spin; verify result appears
 *  - Verify total-bet display updates with lines slider
 */
test.describe('Slots Game', () => {
  test.setTimeout(60_000);

  test('game UI loads with 5 reels and bet controls', async ({ page }) => {
    await ensureAuthenticated(page, '/games/slots');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // The reels grid (data-testid from SlotsGame.jsx)
    const reelsGrid = page.getByTestId('slots-reels');
    await expect(reelsGrid).toBeVisible({ timeout: 15_000 });

    // 5 individual reel columns
    for (let i = 0; i < 5; i++) {
      await expect(page.getByTestId(`slots-reel-${i}`)).toBeVisible();
    }

    // Bet controls
    const betInput = page.locator('#slots-bet-per-line');
    await expect(betInput).toBeVisible({ timeout: 10_000 });

    const spinButton = page.getByTestId('slots-spin-button');
    await expect(spinButton).toBeVisible();
    await expect(spinButton).toBeEnabled();

    // Total bet display
    await expect(page.getByTestId('slots-total-bet')).toBeVisible();
  });

  test('can place a bet and spin, result appears', async ({ page }) => {
    await ensureAuthenticated(page, '/games/slots');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    const betInput = page.locator('#slots-bet-per-line');
    await expect(betInput).toBeVisible({ timeout: 15_000 });

    // Set small bet per line
    await betInput.clear();
    await betInput.fill('1');

    const spinButton = page.getByTestId('slots-spin-button');
    await expect(spinButton).toBeEnabled({ timeout: 10_000 });
    await spinButton.click();

    // While spinning the button label changes to "Spinning…"
    // After completion it reverts to "Spin" and a result appears
    await expect(spinButton).toHaveText('Spin', { timeout: 20_000 });

    // The slots-result element appears after every spin
    const resultEl = page.getByTestId('slots-result');
    await expect(resultEl).toBeVisible({ timeout: 15_000 });

    // Result shows either a win message or "No win this spin"
    await expect(async () => {
      const text = (await resultEl.textContent()) || '';
      const hasResult = text.includes('Won') || text.includes('No win this spin');
      expect(hasResult).toBeTruthy();
    }).toPass({ timeout: 5_000, intervals: [200] });

    // Reels should now show actual symbols (not '?')
    const reel0 = page.getByTestId('slots-reel-0');
    const reel0Text = await reel0.textContent();
    expect(reel0Text).not.toContain('?');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('can spin a second time', async ({ page }) => {
    await ensureAuthenticated(page, '/games/slots');

    const betInput = page.locator('#slots-bet-per-line');
    await expect(betInput).toBeVisible({ timeout: 15_000 });
    await betInput.clear();
    await betInput.fill('1');

    const spinButton = page.getByTestId('slots-spin-button');

    // First spin
    await spinButton.click();
    await expect(spinButton).toHaveText('Spin', { timeout: 20_000 });

    // Second spin
    await spinButton.click();
    await expect(spinButton).toHaveText('Spin', { timeout: 20_000 });

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('total bet updates when lines slider changes', async ({ page }) => {
    await ensureAuthenticated(page, '/games/slots');

    const betInput = page.locator('#slots-bet-per-line');
    await expect(betInput).toBeVisible({ timeout: 15_000 });

    // Set bet per line to 2
    await betInput.clear();
    await betInput.fill('2');
    await betInput.dispatchEvent('input');

    // Set lines to 3
    const linesSlider = page.locator('#slots-lines');
    await linesSlider.fill('3');
    await linesSlider.dispatchEvent('input');

    // Total bet should reflect 2 * 3 = 6.00
    const totalBetEl = page.getByTestId('slots-total-bet');
    await expect(async () => {
      const text = (await totalBetEl.textContent()) || '';
      expect(text).toContain('6');
    }).toPass({ timeout: 5_000, intervals: [100] });
  });
});
