import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Critical guest-flow E2E tests.
 *
 * These run against a real browser in GUEST mode (no Clerk login) so the core
 * local-first paths are verified end-to-end without external auth. The app is
 * a single-page shell whose tabs are driven by `activeTab`; the guest scope is
 * the default store scope.
 */

async function closeDrawer(page: Page): Promise<void> {
  const closeBtn = page.getByRole('button', { name: 'Close menu' });
  if ((await closeBtn.count()) > 0) {
    try { await closeBtn.click({ timeout: 2000 }); } catch { /* already closed */ }
  }
}

/** Waits for the dashboard (HomeScreen) to be loaded and interactable. */
async function loadedHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await closeDrawer(page);
  await expect(page.getByRole('button', { name: /New Note/i })).toBeVisible({ timeout: 10000 });
}

async function createNote(page: Page, title: string, body: string): Promise<void> {
  await page.getByRole('button', { name: /New Note/i }).click();
  await expect(page.getByRole('button', { name: 'Back to notes' })).toBeVisible();
  await page.getByPlaceholder('Untitled').fill(title);
  const content = page.getByRole('textbox', { name: 'Note content' });
  await content.click();
  await page.keyboard.type(body);
  await expect(page.getByText('Saved')).toBeVisible({ timeout: 8000 });
  await page.getByRole('button', { name: 'Back to notes' }).click();
  await expect(page.getByRole('button', { name: /New Note/i })).toBeVisible();
}

test('app boots to the dashboard in guest mode', async ({ page }) => {
  await loadedHome(page);
  await expect(page.getByRole('button', { name: /New Note/i })).toBeVisible();
});

test('guest can create a note, back out, and see it in the grid', async ({ page }) => {
  await loadedHome(page);
  await createNote(page, 'E2E Note Title', 'Hello from Playwright E2E.');
  await expect(page.getByText('E2E Note Title').first()).toBeVisible();
});

test('guest notes persist across a full page reload', async ({ page }) => {
  await loadedHome(page);
  await createNote(page, 'Persistent E2E Note', 'This must survive a reload.');
  await page.reload({ waitUntil: 'networkidle' });
  await closeDrawer(page);
  await expect(page.getByText('Persistent E2E Note').first()).toBeVisible({ timeout: 10000 });
});

test('guest can delete a note (with the 5s undo window)', async ({ page }) => {
  await loadedHome(page);
  await createNote(page, 'Delete Me E2E', 'Temporary content.');
  await closeDrawer(page);

  // Click the note card's exact delete button (aria-label matches the title).
  const deleteBtn = page.getByRole('button', { name: 'Delete note Delete Me E2E', exact: true });
  await expect(deleteBtn).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await deleteBtn.click();

  // Undo window (5s) must expire before the note is actually removed.
  await expect(page.getByText('Delete Me E2E')).toHaveCount(0, { timeout: 10000 });
});

test('AI tutor tab renders (sign-in gate in guest mode)', async ({ page }) => {
  // `?returnTo=ai` opens the AI tab directly, avoiding the responsive drawer.
  await page.goto('/?returnTo=ai', { waitUntil: 'networkidle' });
  await closeDrawer(page);
  // In guest mode the AI tab is gated behind auth but must still mount the
  // tutor header (proving navigation + lazy-load succeeded).
  await expect(page.getByRole('heading', { name: 'AI Assistant', level: 1 })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Unlock AI Study Assistant')).toBeVisible();
});
