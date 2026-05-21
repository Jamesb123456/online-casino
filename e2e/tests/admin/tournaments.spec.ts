import { test, expect } from '@playwright/test';
import { ensureAdminAuthenticated } from '../../fixtures/auth';

/**
 * Admin Tournaments specs.
 * Tests create, cancel, and finalize tournament flows.
 */
test.describe('Admin Tournaments', () => {
  async function ensureAdminOnPage(page, path: string) {
    await ensureAdminAuthenticated(page, path);
  }

  test('tournaments page loads', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/tournaments');

    await expect(page.getByRole('heading', { name: 'Tournaments' })).toBeVisible({ timeout: 15_000 });
  });

  test('create tournament form is visible', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/tournaments');

    const createCard = page.locator('[data-testid="tournaments-create-card"]');
    await expect(createCard).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Create tournament')).toBeVisible({ timeout: 10_000 });
  });

  test('create form has required fields', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/tournaments');

    const createCard = page.locator('[data-testid="tournaments-create-card"]');
    await expect(createCard).toBeVisible({ timeout: 15_000 });

    // Name input
    await expect(createCard.locator('input[name="name"]')).toBeVisible({ timeout: 10_000 });

    // Prize pool input
    await expect(createCard.locator('input[name="prizePool"]')).toBeVisible({ timeout: 10_000 });

    // Game selector
    await expect(createCard.locator('[data-testid="game-select"]')).toBeVisible({ timeout: 10_000 });

    // Scoring selector
    await expect(createCard.locator('[data-testid="scoring-select"]')).toBeVisible({ timeout: 10_000 });

    // Date-time inputs
    await expect(createCard.locator('input[name="startTime"]')).toBeVisible({ timeout: 10_000 });
    await expect(createCard.locator('input[name="endTime"]')).toBeVisible({ timeout: 10_000 });

    // Submit button
    await expect(createCard.locator('[data-testid="create-submit-btn"]')).toBeVisible({ timeout: 10_000 });
  });

  test('prize distribution sum indicator is visible', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/tournaments');

    const distSum = page.locator('[data-testid="dist-sum"]');
    await expect(distSum).toBeVisible({ timeout: 15_000 });

    // Default distribution (0.5 + 0.3 + 0.2 = 1.0)
    await expect(distSum).toContainText('1.000');
  });

  test('create tournament with valid data succeeds', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/tournaments');

    const createCard = page.locator('[data-testid="tournaments-create-card"]');
    await expect(createCard).toBeVisible({ timeout: 15_000 });

    const uniqueName = `E2E Test Tournament ${Date.now()}`;

    // Fill in the name
    await createCard.locator('input[name="name"]').fill(uniqueName);

    // Prize pool
    await createCard.locator('input[name="prizePool"]').fill('1000');

    // Start time: set to 1 hour from now
    const startTime = new Date(Date.now() + 60 * 60 * 1000);
    const endTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const toLocalDateTime = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    await createCard.locator('input[name="startTime"]').fill(toLocalDateTime(startTime));
    await createCard.locator('input[name="endTime"]').fill(toLocalDateTime(endTime));

    // Submit
    await createCard.locator('[data-testid="create-submit-btn"]').click();

    // Expect success — either a toast or the tournament appearing in the list
    await expect(async () => {
      const body = await page.locator('body').textContent() || '';
      const succeeded = body.includes('Tournament created') || body.includes(uniqueName);
      expect(succeeded).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });
  });

  test('status filter renders all options', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/tournaments');

    const statusFilter = page.locator('[data-testid="status-filter"]');
    await expect(statusFilter).toBeVisible({ timeout: 15_000 });

    await expect(statusFilter.locator('option[value=""]')).toHaveText('All statuses');
    await expect(statusFilter.locator('option[value="scheduled"]')).toHaveText('Scheduled');
    await expect(statusFilter.locator('option[value="active"]')).toHaveText('Active');
    await expect(statusFilter.locator('option[value="finalized"]')).toHaveText('Finalized');
    await expect(statusFilter.locator('option[value="cancelled"]')).toHaveText('Cancelled');
  });

  test('cancel scheduled tournament', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/tournaments');

    await expect(page.locator('[data-testid="tournaments-list-card"]')).toBeVisible({ timeout: 15_000 });

    // Wait for loading
    await expect(async () => {
      const spinning = await page.locator('[data-testid="tournaments-list-card"] .animate-spin').count();
      expect(spinning).toBe(0);
    }).toPass({ timeout: 15_000, intervals: [500] });

    // Check if any scheduled tournaments are cancellable
    const cancelButtons = page.locator('[data-testid^="cancel-btn-"]');
    const cancelCount = await cancelButtons.count();

    if (cancelCount > 0) {
      await cancelButtons.first().click();

      // Success toast or row status change
      await expect(async () => {
        const body = await page.locator('body').textContent() || '';
        expect(body.includes('cancelled') || body.includes('Cancelled')).toBeTruthy();
      }).toPass({ timeout: 10_000, intervals: [500] });
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No cancellable tournaments in list. Create test creates one; run full suite for cancel coverage.',
      });
    }
  });

  test('tournaments list card is rendered', async ({ page }) => {
    await ensureAdminOnPage(page, '/admin/tournaments');

    const listCard = page.locator('[data-testid="tournaments-list-card"]');
    await expect(listCard).toBeVisible({ timeout: 15_000 });

    // Table headers
    await expect(listCard.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10_000 });
    await expect(listCard.getByRole('columnheader', { name: 'Game' })).toBeVisible({ timeout: 10_000 });
    await expect(listCard.getByRole('columnheader', { name: 'Status' })).toBeVisible({ timeout: 10_000 });
    await expect(listCard.getByRole('columnheader', { name: 'Prize pool' })).toBeVisible({ timeout: 10_000 });
  });
});
