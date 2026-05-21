import { test, expect } from '@playwright/test';
import { ensureAdminAuthenticated } from '../../fixtures/auth';

/**
 * Admin Dashboard specs.
 * Uses storageState from admin-setup (admin credentials).
 */
test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAdminAuthenticated(page, '/admin/dashboard');
  });

  test('admin can access the dashboard page', async ({ page }) => {
    // Should be on admin dashboard, not redirected away
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/games/, { timeout: 5_000 });

    // Dashboard heading is visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
  });

  test('dashboard shows stat widgets', async ({ page }) => {
    // The four KPI cards are rendered
    await expect(page.getByText('Total Players')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total Balance')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Games')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Alerts')).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard shows game statistics table', async ({ page }) => {
    await expect(page.getByText('Game Statistics')).toBeVisible({ timeout: 15_000 });

    // Table headers
    await expect(page.getByRole('columnheader', { name: 'Game' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Played' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'House Profit' })).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard shows recent transactions table', async ({ page }) => {
    await expect(page.getByText('Recent Transactions')).toBeVisible({ timeout: 15_000 });

    // Table headers
    await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard shows system alerts section', async ({ page }) => {
    await expect(page.getByText('System Alerts')).toBeVisible({ timeout: 15_000 });
  });

  test('no error boundary on dashboard load', async ({ page }) => {
    await expect(page.getByText('Something went wrong')).not.toBeVisible({ timeout: 15_000 });
  });
});
