import { test, expect } from '@playwright/test';

test.describe('Crash Game', () => {
  test.setTimeout(120_000);

  test('can place a bet and complete a round', async ({ page }) => {
    // Navigate directly — storageState from auth-setup provides the session.
    await page.goto('/games/crash');
    await page.waitForLoadState('domcontentloaded');

    // If redirected to login, log in and navigate back
    if (page.url().includes('/login')) {
      await page.locator('#username').fill('player1');
      await page.locator('#password').fill('password123');
      await page.locator('button[type="submit"]').click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
      await page.goto('/games/crash');
      await page.waitForLoadState('domcontentloaded');
    }

    // Wait for the game to fully render and socket to connect
    await page.waitForTimeout(5000);

    // Verify no error boundary on initial load
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // The crash game cycles through phases: waiting -> running -> crashed.
    // "Place Bet" only appears during the "waiting" phase.
    const placeBetButton = page.getByRole('button', { name: 'Place Bet' });
    await placeBetButton.waitFor({ state: 'visible', timeout: 60_000 });

    // Fill bet amount
    const betInput = page.locator('#crash-bet-amount');
    await betInput.clear();
    await betInput.fill('10');

    // Fill auto cashout
    const autoCashoutInput = page.locator('#crash-auto-cashout');
    await autoCashoutInput.clear();
    await autoCashoutInput.fill('1.5');

    // Place the bet
    await placeBetButton.click();

    // Verify no error boundary immediately after bet placement
    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for the game round to complete — look for result indicators.
    // After the round, either: Cashed Out, Busted, or Place Bet reappears for next round.
    await expect(async () => {
      const pageText = await page.textContent('body') || '';
      const hasResult =
        pageText.includes('Cashed Out') ||
        pageText.includes('Busted') ||
        pageText.includes('CRASHED') ||
        pageText.includes('Crashed @');
      const placeBetVisible = await placeBetButton.isVisible().catch(() => false);
      expect(hasResult || placeBetVisible).toBeTruthy();
    }).toPass({ timeout: 60_000, intervals: [500] });

    // Verify no error boundary after round completion
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('can place a second consecutive bet', async ({ page }) => {
    await page.goto('/games/crash');
    await page.waitForLoadState('domcontentloaded');

    if (page.url().includes('/login')) {
      await page.locator('#username').fill('player1');
      await page.locator('#password').fill('password123');
      await page.locator('button[type="submit"]').click();
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
      await page.goto('/games/crash');
      await page.waitForLoadState('domcontentloaded');
    }

    await page.waitForTimeout(5000);

    const placeBetButton = page.getByRole('button', { name: 'Place Bet' });

    // --- First bet ---
    await placeBetButton.waitFor({ state: 'visible', timeout: 60_000 });
    const betInput = page.locator('#crash-bet-amount');
    await betInput.clear();
    await betInput.fill('10');
    const autoCashoutInput = page.locator('#crash-auto-cashout');
    await autoCashoutInput.clear();
    await autoCashoutInput.fill('1.2');
    await placeBetButton.click();

    // Wait for first round to finish — Place Bet reappears during next waiting phase
    await placeBetButton.waitFor({ state: 'visible', timeout: 90_000 });

    // --- Second bet ---
    await betInput.clear();
    await betInput.fill('20');
    await autoCashoutInput.clear();
    await autoCashoutInput.fill('2.0');
    await placeBetButton.click();

    await page.waitForTimeout(1000);
    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Wait for second round to finish
    await expect(async () => {
      const pageText = await page.textContent('body') || '';
      const hasResult =
        pageText.includes('Cashed Out') ||
        pageText.includes('Busted') ||
        pageText.includes('CRASHED') ||
        pageText.includes('Crashed @');
      const placeBetVisible = await placeBetButton.isVisible().catch(() => false);
      expect(hasResult || placeBetVisible).toBeTruthy();
    }).toPass({ timeout: 60_000, intervals: [500] });

    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });
});
