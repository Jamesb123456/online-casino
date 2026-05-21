import { test, expect } from '@playwright/test';
import { ensureAdminAuthenticated } from '../../fixtures/auth';

/**
 * Admin Player Management specs.
 * Tests searching users, adjusting balance, and suspending (deactivating) an account.
 */
test.describe('Admin Player Management', () => {
  async function ensureAdminOnPage(page, path: string) {
    await ensureAdminAuthenticated(page, path);
  }

  test('player management page loads', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/players');

    await expect(page.getByRole('heading', { name: 'Player Management' })).toBeVisible({ timeout: 15_000 });
  });

  test('player table renders with columns', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/players');

    // Wait for loading to finish
    await expect(page.getByText('Loading players...')).not.toBeVisible({ timeout: 15_000 });

    // Table should have Username column header
    await expect(page.getByRole('columnheader', { name: /Username/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: /Status/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: /Balance/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: /Actions/i })).toBeVisible({ timeout: 10_000 });
  });

  test('search by username filters players', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/players');

    // Wait for initial load
    await expect(page.getByText('Loading players...')).not.toBeVisible({ timeout: 15_000 });

    const searchInput = page.locator('#player-search');
    await searchInput.waitFor({ state: 'visible', timeout: 10_000 });

    // Search for the seeded player
    await searchInput.fill('player1');

    // Wait for the filtered result
    await expect(async () => {
      const rows = await page.locator('tbody tr').count();
      expect(rows).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 10_000, intervals: [500] });

    // The player row should contain the searched username
    const tableBody = page.locator('tbody');
    await expect(tableBody.getByText('player1')).toBeVisible({ timeout: 10_000 });
  });

  test('search with no match shows empty state', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/players');

    await expect(page.getByText('Loading players...')).not.toBeVisible({ timeout: 15_000 });

    const searchInput = page.locator('#player-search');
    await searchInput.waitFor({ state: 'visible', timeout: 10_000 });

    // Search for a username that definitely doesn't exist
    await searchInput.fill('zzznonexistentuser999xyz');

    await expect(async () => {
      const text = await page.locator('body').textContent() || '';
      const hasEmpty = text.includes('No players found') || (await page.locator('tbody tr').count()) === 0;
      expect(hasEmpty).toBeTruthy();
    }).toPass({ timeout: 10_000, intervals: [500] });
  });

  test('adjust balance modal opens via Funds button', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/players');

    await expect(page.getByText('Loading players...')).not.toBeVisible({ timeout: 15_000 });

    // Find the Funds button for any player row
    const fundsButton = page.getByRole('button', { name: 'Funds' }).first();
    await fundsButton.waitFor({ state: 'visible', timeout: 15_000 });
    await fundsButton.click();

    // Manage Funds modal should open
    await expect(page.getByText('Manage Funds')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Current Balance')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#fund-amount')).toBeVisible({ timeout: 5_000 });

    // Add Funds and Remove Funds buttons exist
    await expect(page.getByRole('button', { name: 'Add Funds' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Remove Funds' })).toBeVisible({ timeout: 5_000 });
  });

  test('edit player modal opens via Edit button', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/players');

    await expect(page.getByText('Loading players...')).not.toBeVisible({ timeout: 15_000 });

    const editButton = page.getByRole('button', { name: 'Edit' }).first();
    await editButton.waitFor({ state: 'visible', timeout: 15_000 });
    await editButton.click();

    // Edit Player modal should open
    await expect(page.getByText('Edit Player')).toBeVisible({ timeout: 10_000 });

    // The Active Account checkbox represents the suspend/unsuspend toggle
    await expect(page.locator('#editIsActive')).toBeVisible({ timeout: 5_000 });
  });

  test('suspend (deactivate) toggle is present in edit modal', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/players');

    await expect(page.getByText('Loading players...')).not.toBeVisible({ timeout: 15_000 });

    const editButton = page.getByRole('button', { name: 'Edit' }).first();
    await editButton.waitFor({ state: 'visible', timeout: 15_000 });
    await editButton.click();

    // The Active Account checkbox is the suspend control
    const activeCheckbox = page.locator('#editIsActive');
    await expect(activeCheckbox).toBeVisible({ timeout: 10_000 });
    // It should be a checkbox input
    await expect(activeCheckbox).toHaveAttribute('type', 'checkbox');
  });

  test('status filter renders options', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/players');

    const statusFilter = page.locator('#player-status-filter');
    await statusFilter.waitFor({ state: 'visible', timeout: 15_000 });

    // Should have at least "All Users", "Active Only", "Inactive Only"
    await expect(statusFilter.locator('option[value="all"]')).toHaveText('All Users');
    await expect(statusFilter.locator('option[value="active"]')).toHaveText('Active Only');
    await expect(statusFilter.locator('option[value="inactive"]')).toHaveText('Inactive Only');
  });
});
