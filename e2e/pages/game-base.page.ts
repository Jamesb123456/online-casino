import type { Page } from '@playwright/test';

export class GameBasePage {
  constructor(protected page: Page) {}

  /** Navigate to a game page and wait for it to load */
  async goto(gamePath: string) {
    await this.page.goto(gamePath);
    await this.page.waitForLoadState('networkidle');
    // Allow socket connections to establish
    await this.page.waitForTimeout(2000);
  }

  /** Get the current balance displayed on the page */
  async getBalance(): Promise<number> {
    // Look for balance text - usually formatted as $XXX.XX
    const balanceLocator = this.page.locator(':text("Balance")').first();
    const parent = balanceLocator.locator('..');
    const text = await parent.textContent();
    if (!text) return 0;
    const match = text.match(/\$?([\d,]+\.?\d*)/);
    return match ? parseFloat(match[1].replace(',', '')) : 0;
  }

  /** Fill a bet amount input */
  async setBetAmount(inputId: string, amount: number) {
    const input = this.page.locator(`#${inputId}`);
    await input.clear();
    await input.fill(String(amount));
  }

  /** Click a button by its visible text */
  async clickButton(text: string) {
    await this.page.getByRole('button', { name: text, exact: false }).click();
  }

  /** Wait for a button with specific text to appear */
  async waitForButton(text: string, timeout = 30_000) {
    await this.page.getByRole('button', { name: text, exact: false })
      .waitFor({ state: 'visible', timeout });
  }

  /** Wait for a button to be enabled */
  async waitForButtonEnabled(text: string, timeout = 30_000) {
    await this.page.getByRole('button', { name: text, exact: false })
      .waitFor({ state: 'visible', timeout });
    await this.page.waitForFunction(
      (btnText) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent?.includes(btnText));
        return btn && !btn.disabled;
      },
      text,
      { timeout }
    );
  }
}
