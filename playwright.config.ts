import { defineConfig } from '@playwright/test';

/**
 * E2E configuration for StudySnap.
 *
 * These specs target the GUEST flow (no Clerk sign-in) so the critical
 * local-first paths — note CRUD, IndexedDB/localStorage persistence, PWA
 * service worker — can be exercised end-to-end against a real browser without
 * external auth credentials. The Playwright `webServer` boots the Next.js
 * frontend; guest mode works pure local-first so no backend is required.
 *
 * To also cover authenticated flows, provide CLERK_TEST_* credentials and add
 * an `auth.setup` project (out of scope for the green CI baseline).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    cwd: './FRONTEND',
    env: { PORT: '3100' },
  },
});
