import type { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.page.locator('#username').fill(username);
    await this.page.locator('#password').fill(password);
    await this.page.locator('button[type="submit"]').click();
  }

  async getError(): Promise<string | null> {
    const alert = this.page.locator('[role="alert"]');
    if (await alert.isVisible()) {
      return alert.textContent();
    }
    return null;
  }
}
