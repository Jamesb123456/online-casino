import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Profile Spec
 *
 * Covers:
 *  1. Profile page renders with user information.
 *  2. Account Information card shows username and account type.
 *  3. Balance card is visible.
 *  4. Profile settings form allows editing display name.
 *  5. Change password form validates input before submitting.
 */
test.describe('Profile Page', () => {
  test.setTimeout(60_000);

  test('profile page loads with user info', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Page heading
    await expect(page.getByRole('heading', { name: /Your Profile/i })).toBeVisible({ timeout: 15_000 });

    // Username should be "player1"
    await expect(page.getByText('player1')).toBeVisible({ timeout: 10_000 });
  });

  test('account information card shows username and account type', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    await expect(page.getByText('Account Information')).toBeVisible({ timeout: 15_000 });

    // Username label + value
    await expect(page.getByText('Username')).toBeVisible();
    await expect(page.getByText('player1')).toBeVisible();

    // Account type label
    await expect(page.getByText('Account Type')).toBeVisible();
    // Role is "user" for player1
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toContain('user');
  });

  test('balance card is visible and shows a numeric value', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    await expect(page.getByText('Balance')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Current Balance')).toBeVisible();

    // Balance should be formatted as a number (e.g. "1,000 Credits")
    const body = await page.textContent('body') || '';
    expect(body.includes('Credits') || body.match(/[\d,]+\.\d{2}/)).toBeTruthy();
  });

  test('profile settings card is rendered with username and display name fields', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    const settingsCard = page.getByTestId('profile-settings-card');
    await expect(settingsCard).toBeVisible({ timeout: 15_000 });

    // Display name field (name="display-name")
    const displayNameInput = settingsCard.locator('input[name="display-name"]');
    await expect(displayNameInput).toBeVisible({ timeout: 10_000 });

    // Avatar URL field
    const avatarInput = settingsCard.locator('input[name="avatar"]');
    await expect(avatarInput).toBeVisible();

    // Save profile button
    await expect(settingsCard.getByRole('button', { name: /Save profile/i })).toBeVisible();
  });

  test('can update display name and see success toast', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    const settingsCard = page.getByTestId('profile-settings-card');
    await expect(settingsCard).toBeVisible({ timeout: 15_000 });

    const displayNameInput = settingsCard.locator('input[name="display-name"]');
    await expect(displayNameInput).toBeVisible({ timeout: 10_000 });

    // Clear and enter a new display name
    await displayNameInput.clear();
    await displayNameInput.fill('E2E Test Player');

    await settingsCard.getByRole('button', { name: /Save profile/i }).click();

    // A toast notification should appear indicating success
    await expect(async () => {
      const body = await page.textContent('body') || '';
      expect(body.includes('Profile updated') || body.includes('updated')).toBeTruthy();
    }).toPass({ timeout: 15_000, intervals: [500] });
  });

  test('change password form rejects mismatched passwords with error toast', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    const passwordCard = page.getByTestId('change-password-card');
    await expect(passwordCard).toBeVisible({ timeout: 15_000 });

    // Fill current password
    await passwordCard.locator('input[name="current-password"]').fill('password123');
    // Fill non-matching new passwords
    await passwordCard.locator('input[name="new-password"]').fill('NewPass1!');
    await passwordCard.locator('input[name="confirm-password"]').fill('DifferentPass2!');

    await passwordCard.getByRole('button', { name: /Change password/i }).click();

    // Should show a toast/error about mismatch
    await expect(async () => {
      const body = await page.textContent('body') || '';
      expect(
        body.includes('do not match') ||
        body.includes('mismatch') ||
        body.includes('confirmation')
      ).toBeTruthy();
    }).toPass({ timeout: 10_000, intervals: [300] });
  });

  test('change password form rejects weak password', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    const passwordCard = page.getByTestId('change-password-card');
    await expect(passwordCard).toBeVisible({ timeout: 15_000 });

    // Use a password that's too short (< 8 chars)
    await passwordCard.locator('input[name="current-password"]').fill('password123');
    await passwordCard.locator('input[name="new-password"]').fill('short');
    await passwordCard.locator('input[name="confirm-password"]').fill('short');

    await passwordCard.getByRole('button', { name: /Change password/i }).click();

    // Should show an error about password length or complexity
    await expect(async () => {
      const body = await page.textContent('body') || '';
      expect(
        body.includes('8') ||
        body.includes('characters') ||
        body.includes('must contain')
      ).toBeTruthy();
    }).toPass({ timeout: 10_000, intervals: [300] });
  });

  test('sound settings card is rendered', async ({ page }) => {
    await ensureAuthenticated(page, '/profile');

    const soundCard = page.getByTestId('sound-settings-card');
    await expect(soundCard).toBeVisible({ timeout: 15_000 });

    await expect(soundCard.getByText(/Sound/i)).toBeVisible();
    await expect(soundCard.getByTestId('audio-mute-toggle')).toBeVisible();
    await expect(soundCard.getByTestId('audio-volume-slider')).toBeVisible();
  });
});
