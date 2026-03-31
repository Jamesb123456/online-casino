import { test as base, expect } from '@playwright/test';

// Extended test fixture with helpers for game testing
export const test = base.extend<{ gamePage: GamePageHelpers }>({
  gamePage: async ({ page }, use) => {
    await use(new GamePageHelpers(page));
  },
});

class GamePageHelpers {
  constructor(private page: import('@playwright/test').Page) {}

  /** Read the user's balance from the page */
  async getBalance(): Promise<number> {
    // Balance is typically shown in the betting panel with a $ prefix
    const balanceText = await this.page.locator('text=$').first().textContent();
    if (!balanceText) return 0;
    const match = balanceText.match(/\$?([\d,]+\.?\d*)/);
    return match ? parseFloat(match[1].replace(',', '')) : 0;
  }

  /** Wait for socket connection to be established */
  async waitForGameReady(timeout = 10_000): Promise<void> {
    // Wait for the page to be fully loaded and interactive
    await this.page.waitForLoadState('networkidle', { timeout });
    // Give sockets a moment to connect
    await this.page.waitForTimeout(2000);
  }

  /** Fill a bet amount input by its ID */
  async setBetAmount(inputId: string, amount: number): Promise<void> {
    const input = this.page.locator(`#${inputId}`);
    await input.clear();
    await input.fill(String(amount));
  }

  /** Click a preset bet amount button */
  async clickPreset(amount: number): Promise<void> {
    await this.page.getByRole('button', { name: `$${amount}`, exact: false }).click();
  }

  /** Click a button by its text */
  async clickButton(text: string): Promise<void> {
    await this.page.getByRole('button', { name: text, exact: false }).click();
  }

  /** Wait for a button to become enabled and visible */
  async waitForButton(text: string, timeout = 30_000): Promise<void> {
    await this.page.getByRole('button', { name: text, exact: false })
      .waitFor({ state: 'visible', timeout });
  }
}

export { expect };
