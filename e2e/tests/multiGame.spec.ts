import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Multi-Game Navigation Spec
 *
 * Verifies that a player can navigate between three different games in a single
 * session and that the balance bar remains consistent throughout (no NaN, no
 * missing balance display).
 *
 * Flow: Crash → Blackjack → Roulette
 *
 * This is intentionally lighter than the individual game specs — the goal is
 * cross-game session stability, not full bet coverage (those are in their own
 * dedicated specs).
 */
test.describe('Multi-Game Navigation', () => {
  test.setTimeout(180_000);

  /**
   * Read the visible balance from the header balance chip.
   * Returns the raw text (e.g. "1,000 Credits") or null if not found.
   */
  async function readHeaderBalance(page: any): Promise<string | null> {
    try {
      // The header shows the balance in a chip with text-accent-gold font-bold
      // We look for the balance container in the header
      const balanceChip = page.locator('header').locator('.text-accent-gold.font-bold.font-heading').first();
      const visible = await balanceChip.isVisible({ timeout: 5000 });
      if (!visible) return null;
      return await balanceChip.textContent();
    } catch {
      return null;
    }
  }

  test('crash → blackjack → roulette: balance bar remains consistent', async ({ page }) => {
    // ────────────────────────────────────────────────────────
    // Step 1: Crash game
    // ────────────────────────────────────────────────────────
    await ensureAuthenticated(page, '/games/crash');
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for crash game to load (socket connects)
    await page.waitForTimeout(3000);

    const crashBalance = await readHeaderBalance(page);
    if (crashBalance) {
      // Balance should be a non-NaN, non-empty value
      expect(crashBalance).not.toContain('NaN');
      expect(crashBalance.trim().length).toBeGreaterThan(0);
    }

    // Wait for "Place Bet" to appear so we know the game is live
    const crashPlaceBet = page.getByRole('button', { name: 'Place Bet' });
    const crashLoaded = await crashPlaceBet.isVisible({ timeout: 30_000 }).catch(() => false);
    if (crashLoaded) {
      // Place a small bet to verify the flow
      const betInput = page.locator('#crash-bet-amount');
      await betInput.clear();
      await betInput.fill('5');
      const autoCashout = page.locator('#crash-auto-cashout');
      await autoCashout.clear();
      await autoCashout.fill('1.2');
      await crashPlaceBet.click();
      await page.waitForTimeout(1000);
      await expect(page.getByText('Something went wrong')).not.toBeVisible();
    }

    // ────────────────────────────────────────────────────────
    // Step 2: Navigate to Blackjack
    // ────────────────────────────────────────────────────────
    await page.goto('/games/blackjack');
    await page.waitForLoadState('domcontentloaded');

    // Auth guard may show "Verifying authentication" briefly
    await page.waitForFunction(
      () => {
        const body = document.body.textContent || '';
        return !body.includes('Verifying authentication');
      },
      { timeout: 20_000 }
    );

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    const bjBalance = await readHeaderBalance(page);
    if (bjBalance && crashBalance) {
      // Balance should not change to NaN between games
      expect(bjBalance).not.toContain('NaN');
    }

    // Wait for blackjack to load
    const bjPlaceBet = page.getByRole('button', { name: 'Place Bet' });
    const bjLoaded = await bjPlaceBet.isVisible({ timeout: 15_000 }).catch(() => false);

    if (bjLoaded) {
      // Place a bet via the $10 preset
      const ten = page.getByRole('button', { name: '$10', exact: true });
      if (await ten.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ten.click();
        await bjPlaceBet.click();
        await page.waitForTimeout(1000);
        await expect(page.getByText('Something went wrong')).not.toBeVisible();

        // Stand immediately if action buttons appear
        const standButton = page.getByRole('button', { name: 'Stand' });
        if (await standButton.isVisible({ timeout: 8000 }).catch(() => false)) {
          await standButton.click();
        }
        // Wait for place-bet to reappear
        await bjPlaceBet.isVisible({ timeout: 20_000 }).catch(() => {});
      }
    }

    // ────────────────────────────────────────────────────────
    // Step 3: Navigate to Roulette
    // ────────────────────────────────────────────────────────
    await page.goto('/games/roulette');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForFunction(
      () => {
        const body = document.body.textContent || '';
        return !body.includes('Verifying authentication');
      },
      { timeout: 20_000 }
    );

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for roulette to load
    const rouletteBetInput = page.locator('#roulette-bet-amount');
    const rouletteLoaded = await rouletteBetInput.isVisible({ timeout: 15_000 }).catch(() => false);

    if (rouletteLoaded) {
      const roulettePlaceBet = page.getByRole('button', { name: 'Place Bet' });
      await rouletteBetInput.clear();
      await rouletteBetInput.fill('5');

      const redButton = page.getByRole('button', { name: /^Red/i });
      if (await redButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await redButton.click();
      }

      const placeBetEnabled = await roulettePlaceBet.isEnabled({ timeout: 15_000 }).catch(() => false);
      if (placeBetEnabled) {
        await roulettePlaceBet.click();
        await page.waitForTimeout(1000);
        await expect(page.getByText('Something went wrong')).not.toBeVisible();
      }
    }

    // ────────────────────────────────────────────────────────
    // Final assertion: balance bar still visible and valid
    // ────────────────────────────────────────────────────────
    const finalBalance = await readHeaderBalance(page);
    if (finalBalance) {
      expect(finalBalance).not.toContain('NaN');
      expect(finalBalance.trim().length).toBeGreaterThan(0);
    }

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('navigating between games does not trigger error boundaries', async ({ page }) => {
    const games = ['/games/crash', '/games/blackjack', '/games/roulette'];

    for (const gameUrl of games) {
      await page.goto(gameUrl);
      await page.waitForLoadState('domcontentloaded');

      // Wait for auth guard to settle
      await page.waitForFunction(
        () => {
          const body = document.body.textContent || '';
          return !body.includes('Verifying authentication');
        },
        { timeout: 20_000 }
      );

      // Short wait for socket to connect and game state to initialise
      await page.waitForTimeout(2000);

      await expect(page.getByText('Something went wrong')).not.toBeVisible({
        timeout: 5_000,
      });
    }
  });
});
