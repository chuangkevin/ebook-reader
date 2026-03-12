import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e-issues.spec.ts', 'e2e-invert.spec.ts', 'e2e-paging.spec.ts'],
  timeout: 120000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: false,
    launchOptions: {
      slowMo: 500,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
