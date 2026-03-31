import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

test.describe('Blackjack Game', () => {
  test.setTimeout(90_000);

  test('can place a bet, play a hand, and see result', async ({ page }) => {
    await ensureAuthenticated(page, '/games/blackjack');

    // Wait for socket connection — balance text appears when connected
    const balanceText = page.locator('text=Balance:');
    await expect(balanceText).toBeVisible({ timeout: 15_000 });

    // Read starting balance
    const balanceEl = page.locator('.text-status-success').first();
    const startBalanceText = await balanceEl.textContent();
    const startBalance = parseFloat(startBalanceText!.replace(/[$,]/g, ''));
    expect(startBalance).toBeGreaterThan(0);

    // Verify no error boundary
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for Place Bet button to be ready
    const placeBetButton = page.getByRole('button', { name: 'Place Bet' });
    await expect(placeBetButton).toBeVisible({ timeout: 15_000 });
    await expect(placeBetButton).toBeEnabled({ timeout: 10_000 });

    // Select $10 bet preset
    const tenButton = page.getByRole('button', { name: '$10', exact: true });
    await expect(tenButton).toBeVisible({ timeout: 5_000 });
    await tenButton.click();

    // Place the bet
    await placeBetButton.click();

    // Verify no error boundary after bet placement
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for game to respond — either action buttons or auto-completed
    await expect(async () => {
      const standVisible = await page.getByRole('button', { name: 'Stand' }).isVisible().catch(() => false);
      const hitVisible = await page.getByRole('button', { name: 'Hit' }).isVisible().catch(() => false);
      const placeBetBack = await placeBetButton.isVisible().catch(() => false);
      expect(standVisible || hitVisible || placeBetBack).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    // If we have action buttons, play the hand
    const standButton = page.getByRole('button', { name: 'Stand' });
    if (await standButton.isVisible().catch(() => false)) {
      await standButton.click();
    }

    // Wait for game to complete — Place Bet reappears after auto-reset
    await expect(placeBetButton).toBeVisible({ timeout: 20_000 });

    // Verify no error boundary after game completion
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Verify balance is still displayed (game completed without error)
    // Note: Balance may stay the same on a push (tie), so we just verify it's valid
    const endBalanceText = await balanceEl.textContent();
    const endBalance = parseFloat(endBalanceText!.replace(/[$,]/g, ''));
    expect(endBalance).toBeGreaterThanOrEqual(0);
  });

  test('can place a second consecutive bet', async ({ page }) => {
    await ensureAuthenticated(page, '/games/blackjack');

    const placeBetButton = page.getByRole('button', { name: 'Place Bet' });
    await expect(placeBetButton).toBeVisible({ timeout: 15_000 });
    await expect(placeBetButton).toBeEnabled({ timeout: 10_000 });

    // --- First hand ---
    await page.getByRole('button', { name: '$25', exact: true }).click();
    await placeBetButton.click();

    await expect(async () => {
      const standVisible = await page.getByRole('button', { name: 'Stand' }).isVisible().catch(() => false);
      const hitVisible = await page.getByRole('button', { name: 'Hit' }).isVisible().catch(() => false);
      const placeBetBack = await placeBetButton.isVisible().catch(() => false);
      expect(standVisible || hitVisible || placeBetBack).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    if (await page.getByRole('button', { name: 'Stand' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Stand' }).click();
    }

    await expect(placeBetButton).toBeVisible({ timeout: 20_000 });
    await expect(placeBetButton).toBeEnabled({ timeout: 10_000 });

    // --- Second hand ---
    await page.getByRole('button', { name: '$10', exact: true }).click();
    await placeBetButton.click();

    await expect(async () => {
      const standVisible = await page.getByRole('button', { name: 'Stand' }).isVisible().catch(() => false);
      const hitVisible = await page.getByRole('button', { name: 'Hit' }).isVisible().catch(() => false);
      const placeBetBack = await placeBetButton.isVisible().catch(() => false);
      expect(standVisible || hitVisible || placeBetBack).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    if (await page.getByRole('button', { name: 'Stand' }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Stand' }).click();
    }

    await expect(placeBetButton).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });
});
