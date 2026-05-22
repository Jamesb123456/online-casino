import { test, expect } from '@playwright/test';
import { ensureAuthenticated } from '../fixtures/auth';

/**
 * Provably-Fair Verify Spec
 *
 * Covers:
 *  1. Verify page loads with form and "How It Works" panel.
 *  2. "Generate" button fills in a client seed.
 *  3. Submitting with incomplete fields shows a validation error.
 *  4. Submitting valid seeds + nonce returns a verification result.
 *  5. Hash mismatch is indicated clearly in the result.
 */

// Pre-computed test vectors from the server's HMAC-SHA256 algorithm.
// These are valid for any offline verification — we test the API round-trip.
const VALID_CRASH_VECTOR = {
  // A known server seed and its SHA-256 hash (generated via node crypto for testing)
  serverSeed: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  // SHA-256 of the above (hex)
  serverSeedHash: 'b80bb7740288fda1f201890375a60c8fbe30ceb3a4b50aea9f21a03b4ea49398',
  clientSeed: 'testclient',
  nonce: 1,
  gameType: 'crash',
};

test.describe('Provably Fair Verify Page', () => {
  test.setTimeout(60_000);

  test('verify page loads with heading and form', async ({ page }) => {
    // /verify is a public page (no AuthGuard) — navigate directly
    await page.goto('/verify');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Something went wrong')).not.toBeVisible();

    // Heading
    await expect(page.getByRole('heading', { name: /Provably Fair/i })).toBeVisible({
      timeout: 15_000,
    });

    // Form fields
    await expect(page.locator('#serverSeed')).toBeVisible();
    await expect(page.locator('#serverSeedHash')).toBeVisible();
    await expect(page.locator('#clientSeed')).toBeVisible();
    await expect(page.locator('#nonce')).toBeVisible();
    await expect(page.locator('#gameType')).toBeVisible();

    // "How It Works" panel
    await expect(page.getByText('How It Works')).toBeVisible();
  });

  test('Generate button fills the client seed field', async ({ page }) => {
    await page.goto('/verify');
    await page.waitForLoadState('domcontentloaded');

    const clientSeedInput = page.locator('#clientSeed');
    await expect(clientSeedInput).toBeVisible({ timeout: 15_000 });

    // Initially empty
    const initialValue = await clientSeedInput.inputValue();
    expect(initialValue).toBe('');

    // Click Generate
    const generateButton = page.getByRole('button', { name: /Generate/i });
    await generateButton.click();

    // Field should now be populated
    await expect(async () => {
      const value = await clientSeedInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000, intervals: [300] });
  });

  test('submitting with empty fields shows validation error', async ({ page }) => {
    await page.goto('/verify');
    await page.waitForLoadState('domcontentloaded');

    const submitButton = page.getByRole('button', { name: /Verify Result/i });
    await expect(submitButton).toBeVisible({ timeout: 15_000 });

    // Click submit without filling anything
    await submitButton.click();

    // Error message about missing fields
    await expect(page.getByText(/Please fill in all required fields/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('valid seeds return a verification result', async ({ page }) => {
    await page.goto('/verify');
    await page.waitForLoadState('domcontentloaded');

    // Fill in valid test vector
    await page.locator('#serverSeed').fill(VALID_CRASH_VECTOR.serverSeed);
    await page.locator('#serverSeedHash').fill(VALID_CRASH_VECTOR.serverSeedHash);
    await page.locator('#clientSeed').fill(VALID_CRASH_VECTOR.clientSeed);
    await page.locator('#nonce').fill(String(VALID_CRASH_VECTOR.nonce));

    // Select crash game type
    await page.locator('#gameType').selectOption('crash');

    // Submit
    await page.getByRole('button', { name: /Verify Result/i }).click();

    // Result section should appear
    await expect(page.getByText('Verification Result')).toBeVisible({ timeout: 15_000 });

    // The result should contain either "VALID" or "INVALID" and a Raw Result field
    const body = await page.textContent('body') || '';
    const hasResult = body.includes('VALID') || body.includes('INVALID');
    expect(hasResult).toBeTruthy();

    // Raw Result field should be present
    await expect(page.getByText('Raw Result')).toBeVisible();

    // Crash Point field should appear for crash game type
    const hasCrashPoint = body.includes('Crash Point');
    expect(hasCrashPoint).toBeTruthy();
  });

  test('hash mismatch shows failure status', async ({ page }) => {
    await page.goto('/verify');
    await page.waitForLoadState('domcontentloaded');

    // Use a correct server seed but a wrong hash (hash is for a different seed)
    await page.locator('#serverSeed').fill('correctseedvalue12345678901234567890123456789012345678901234');
    await page.locator('#serverSeedHash').fill('0000000000000000000000000000000000000000000000000000000000000000');
    await page.locator('#clientSeed').fill('mismatch-test');
    await page.locator('#nonce').fill('0');
    await page.locator('#gameType').selectOption('crash');

    await page.getByRole('button', { name: /Verify Result/i }).click();

    // Wait for result
    await expect(page.getByText('Verification Result')).toBeVisible({ timeout: 15_000 });

    // Should indicate mismatch
    await expect(async () => {
      const body = await page.textContent('body') || '';
      const hasMismatch =
        body.includes('Hash Mismatch') ||
        body.includes('Verification Failed') ||
        body.includes('INVALID');
      expect(hasMismatch).toBeTruthy();
    }).toPass({ timeout: 5_000, intervals: [300] });
  });

  test('roulette game type shows roulette number in result', async ({ page }) => {
    await page.goto('/verify');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#serverSeed').fill(VALID_CRASH_VECTOR.serverSeed);
    await page.locator('#serverSeedHash').fill(VALID_CRASH_VECTOR.serverSeedHash);
    await page.locator('#clientSeed').fill(VALID_CRASH_VECTOR.clientSeed);
    await page.locator('#nonce').fill('2');
    await page.locator('#gameType').selectOption('roulette');

    await page.getByRole('button', { name: /Verify Result/i }).click();

    await expect(page.getByText('Verification Result')).toBeVisible({ timeout: 15_000 });

    // Roulette result shows "Roulette Number" field
    const body = await page.textContent('body') || '';
    expect(body.includes('Roulette Number')).toBeTruthy();
  });

  test('verify page is accessible without login', async ({ browser }) => {
    // Unauthenticated context
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/verify');
    await page.waitForLoadState('domcontentloaded');

    // Should render the page (no auth guard on /verify)
    await expect(page.getByRole('heading', { name: /Provably Fair/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).not.toHaveURL(/\/login/);

    await context.close();
  });
});
