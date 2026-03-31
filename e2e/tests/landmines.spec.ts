import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

test.describe('Landmines Game', () => {
  test.setTimeout(60_000);

  test('can place a bet, reveal cells, and see result', async ({ page }) => {
    await ensureAuthenticated(page, '/games/landmines');

    // Verify no error boundary on initial load
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for Start Game button (socket connected)
    const startGameButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startGameButton).toBeVisible({ timeout: 15_000 });
    await expect(startGameButton).toBeEnabled({ timeout: 5_000 });

    // Set bet amount
    const betInput = page.locator('#landmines-bet-amount');
    await expect(betInput).toBeVisible({ timeout: 5_000 });
    await betInput.clear();
    await betInput.fill('10');

    // Select Easy difficulty (3 mines)
    await page.getByRole('button', { name: /easy/i }).click();

    // Place the bet by starting the game
    await startGameButton.click();

    // Verify no error boundary after bet
    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for game to become active — Cash Out button appears
    await expect(async () => {
      const cashOutVisible = await page.getByRole('button', { name: /cash out/i }).isVisible().catch(() => false);
      const processingVisible = await page.getByRole('button', { name: /processing/i }).isVisible().catch(() => false);
      expect(cashOutVisible || processingVisible).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    await page.waitForTimeout(1000);

    // Verify the grid appeared — 5x5 grid with clickable cells
    const cells = page.locator('.grid-cols-5 button:not([disabled])');
    const cellCount = await cells.count();
    expect(cellCount).toBeGreaterThan(0);

    // Click a cell to reveal it
    await cells.first().click();
    await page.waitForTimeout(2000);

    // Verify no error boundary after revealing a cell
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Either cash out (if alive) or check for game over
    const cashOutButton = page.getByRole('button', { name: 'Cash Out' });
    if (await cashOutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (await cashOutButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await cashOutButton.click();
        await page.waitForTimeout(3000);
      }
    }

    // Verify game completed — Start Game reappears and result is shown
    await expect(startGameButton).toBeVisible({ timeout: 15_000 });

    // Verify no error boundary after game completion
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('can place a second consecutive bet', async ({ page }) => {
    await ensureAuthenticated(page, '/games/landmines');

    const startGameButton = page.getByRole('button', { name: 'Start Game' });
    await expect(startGameButton).toBeVisible({ timeout: 15_000 });
    await expect(startGameButton).toBeEnabled({ timeout: 5_000 });

    const betInput = page.locator('#landmines-bet-amount');

    // --- First game ---
    await betInput.clear();
    await betInput.fill('10');
    await page.getByRole('button', { name: /easy/i }).click();
    await startGameButton.click();

    await expect(async () => {
      const cashOutVisible = await page.getByRole('button', { name: /cash out/i }).isVisible().catch(() => false);
      const processingVisible = await page.getByRole('button', { name: /processing/i }).isVisible().catch(() => false);
      expect(cashOutVisible || processingVisible).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    await page.waitForTimeout(1000);

    // Reveal a cell
    const cells = page.locator('.grid-cols-5 button:not([disabled])');
    if (await cells.count() > 0) {
      await cells.first().click();
      await page.waitForTimeout(2000);
    }

    // Cash out if alive
    const cashOutButton = page.getByRole('button', { name: 'Cash Out' });
    if (await cashOutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (await cashOutButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await cashOutButton.click();
        await page.waitForTimeout(3000);
      }
    }

    // Wait for Start Game to reappear
    await expect(startGameButton).toBeVisible({ timeout: 15_000 });
    await expect(startGameButton).toBeEnabled({ timeout: 5_000 });

    // --- Second game ---
    await betInput.clear();
    await betInput.fill('20');
    await page.getByRole('button', { name: /medium/i }).click();
    await startGameButton.click();

    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    await expect(async () => {
      const cashOutVisible = await page.getByRole('button', { name: /cash out/i }).isVisible().catch(() => false);
      const processingVisible = await page.getByRole('button', { name: /processing/i }).isVisible().catch(() => false);
      expect(cashOutVisible || processingVisible).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });

    // Reveal a cell in second game
    const cells2 = page.locator('.grid-cols-5 button:not([disabled])');
    if (await cells2.count() > 0) {
      await cells2.first().click();
      await page.waitForTimeout(2000);
    }

    // Cash out if alive
    if (await cashOutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (await cashOutButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await cashOutButton.click();
        await page.waitForTimeout(3000);
      }
    }

    await expect(startGameButton).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });
});
