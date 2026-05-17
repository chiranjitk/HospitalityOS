import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Sequential to avoid DB conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker for DB consistency
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 45000,
  expect: { timeout: 10000 },
  globalSetup: require.resolve('./e2e/global-setup'),

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 8000,
    navigationTimeout: 20000,
    // Reuse authenticated session for all tests (except login.spec.ts which manages its own)
    storageState: 'e2e/.auth/admin.json',
  },

  projects: [
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Login tests need fresh state (no stored session)
    {
      name: 'auth-setup',
      testMatch: /login\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] }, // No stored auth
      },
    },
  ],
});
