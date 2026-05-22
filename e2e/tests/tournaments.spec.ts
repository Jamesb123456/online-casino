import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Tournaments Spec
 *
 * The tournaments page (/tournaments) is a read-only view of active tournaments.
 * Participation is automatic — players appear on a tournament leaderboard by
 * playing the associated game while the tournament is active.  There is no
 * explicit "join" button on the UI.
 *
 * Tests:
 *  1. Page renders with correct heading.
 *  2. Either shows tournament cards or an empty-state message.
 *  3. Each tournament card shows expected fields (name, prize pool, time left).
 *  4. If the player is already participating, their rank / score card renders.
 */
test.describe('Tournaments', () => {
  test.setTimeout(60_000);

  test('tournaments page loads with heading', async ({ page }) => {
    await ensureAuthenticated(page, '/tournaments');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Heading
    await expect(page.getByRole('heading', { name: /Active Tournaments/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('shows tournament cards or empty state', async ({ page }) => {
    await ensureAuthenticated(page, '/tournaments');

    // Wait for loading spinner to clear
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    const body = await page.textContent('body') || '';

    // Either tournament cards exist or the empty-state message is shown
    const hasTournaments = body.includes('prize pool') || body.includes('Time left');
    const hasEmptyState = body.includes('No active tournaments');

    expect(hasTournaments || hasEmptyState).toBeTruthy();
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });

  test('tournament card shows required fields when tournaments exist', async ({ page }) => {
    await ensureAuthenticated(page, '/tournaments');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    // If tournaments are present, verify card structure
    const tournamentCard = page.locator('[data-testid^="tournament-card-"]').first();
    const cardExists = await tournamentCard.isVisible({ timeout: 2000 }).catch(() => false);

    if (cardExists) {
      // Prize pool
      await expect(tournamentCard.getByText(/prize pool/i)).toBeVisible();

      // "Ends" date field
      await expect(tournamentCard.getByText(/Ends/i)).toBeVisible();

      // Time left (data-testid="time-left-{id}")
      const timeLeft = tournamentCard.locator('[data-testid^="time-left-"]');
      await expect(timeLeft).toBeVisible();
      const timeText = (await timeLeft.textContent()) || '';
      // Should not be empty
      expect(timeText.trim().length).toBeGreaterThan(0);

      // Top 10 standings table header
      await expect(tournamentCard.getByText(/Top 10/i)).toBeVisible();
    } else {
      // No tournaments active — verify graceful empty state
      await expect(page.getByText(/No active tournaments/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('game link in tournament card navigates to the correct game', async ({ page }) => {
    await ensureAuthenticated(page, '/tournaments');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    const tournamentCard = page.locator('[data-testid^="tournament-card-"]').first();
    const cardExists = await tournamentCard.isVisible({ timeout: 2000 }).catch(() => false);

    if (!cardExists) {
      test.skip(true, 'No active tournaments to test game link');
      return;
    }

    // Each card has a "Play {gameType}" link
    const playLink = tournamentCard.getByRole('link', { name: /Play/i });
    await expect(playLink).toBeVisible();
    const href = await playLink.getAttribute('href');
    // Should point to /games/<gameType>
    expect(href).toMatch(/\/games\//);
  });

  test('player entry panel renders if already participating', async ({ page }) => {
    await ensureAuthenticated(page, '/tournaments');

    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 20_000 });

    // Check if any "my-entry" panel is visible (only present if player has a score)
    const myEntry = page.locator('[data-testid^="my-entry-"]').first();
    const entryVisible = await myEntry.isVisible({ timeout: 2000 }).catch(() => false);

    if (entryVisible) {
      await expect(myEntry.getByText(/Your rank/i)).toBeVisible();
      await expect(myEntry.getByText(/Your score/i)).toBeVisible();
    }
    // If not visible the player has not participated yet — no assertion needed
    await expect(page.getByText('Something went wrong')).not.toBeVisible();
  });
});
