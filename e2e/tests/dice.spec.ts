import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Dice Game Spec
 *
 * Covers:
 *  - Navigate to /games/dice with saved session
 *  - Verify game UI loads (bet input, roll button, direction toggles)
 *  - Place a bet and roll; verify a result is displayed
 *  - Win-chance and multiplier stats update with target slider
 */
test.describe('Dice Game', () => {
  test.setTimeout(60_000);

  test('game UI loads and shows bet controls', async ({ page }) => {
    await ensureAuthenticated(page, '/games/dice');

    // Verify no error boundary
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Bet input
    const betInput = page.locator('#dice-bet');
    await expect(betInput).toBeVisible({ timeout: 15_000 });

    // Direction toggles
    await expect(page.getByRole('button', { name: /Roll Under/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Roll Over/i })).toBeVisible();

    // Roll button (data-testid from DiceGame.jsx)
    const rollButton = page.getByTestId('dice-roll-button');
    await expect(rollButton).toBeVisible({ timeout: 10_000 });
    await expect(rollButton).toBeEnabled();

    // Stats panel
    await expect(page.getByTestId('dice-win-chance')).toBeVisible();
    await expect(page.getByTestId('dice-multiplier')).toBeVisible();
  });

  test('can place a bet and see a roll result', async ({ page }) => {
    await ensureAuthenticated(page, '/games/dice');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    const betInput = page.locator('#dice-bet');
    await expect(betInput).toBeVisible({ timeout: 15_000 });

    // Set bet amount
    await betInput.clear();
    await betInput.fill('5');

    // Select "Roll Under" direction
    await page.getByRole('button', { name: /Roll Under/i }).click();

    const rollButton = page.getByTestId('dice-roll-button');
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });
    await rollButton.click();

    // After clicking Roll, the button shows "Rolling…" while the request is in-flight
    // Then it returns to "Roll" and a result is shown in data-testid="dice-result"
    const resultEl = page.getByTestId('dice-result');
    await expect(async () => {
      const text = (await resultEl.textContent()) || '';
      // The result changes from "—" to a numeric value like "47.32"
      expect(text.trim()).not.toBe('—');
    }).toPass({ timeout: 20_000, intervals: [300] });

    // Button should re-enable after roll
    await expect(rollButton).toBeEnabled({ timeout: 10_000 });

    // No error boundary
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('can place a second consecutive roll', async ({ page }) => {
    await ensureAuthenticated(page, '/games/dice');

    const betInput = page.locator('#dice-bet');
    await expect(betInput).toBeVisible({ timeout: 15_000 });

    const rollButton = page.getByTestId('dice-roll-button');
    const resultEl = page.getByTestId('dice-result');

    // First roll
    await betInput.clear();
    await betInput.fill('5');
    await rollButton.click();
    await expect(async () => {
      const text = (await resultEl.textContent()) || '';
      expect(text.trim()).not.toBe('—');
    }).toPass({ timeout: 20_000, intervals: [300] });

    // Second roll with different direction
    await page.getByRole('button', { name: /Roll Over/i }).click();
    await betInput.clear();
    await betInput.fill('10');
    await rollButton.click();

    // Wait for new result (non-idle)
    await expect(rollButton).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('win-chance stat updates when target slider changes', async ({ page }) => {
    await ensureAuthenticated(page, '/games/dice');

    const winChanceEl = page.getByTestId('dice-win-chance');
    await expect(winChanceEl).toBeVisible({ timeout: 15_000 });

    // Read initial value
    const initialText = (await winChanceEl.textContent()) || '';

    // Move the target slider to max (99) — win-chance for "under" should be ~99%
    const targetSlider = page.locator('#dice-target');
    await targetSlider.fill('99');

    // Trigger change
    await targetSlider.dispatchEvent('input');

    // Win-chance should now differ from initial (near 99.00%)
    await expect(async () => {
      const text = (await winChanceEl.textContent()) || '';
      expect(text).not.toBe(initialText);
    }).toPass({ timeout: 5_000, intervals: [100] });
  });
});
