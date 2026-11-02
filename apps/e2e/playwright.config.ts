import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: isCI ? 1 : 4,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  // Playwright starts the API and web dev servers itself and waits for both
  // URLs, so CI needs no separate install, background process, or wait-on step.
  webServer: [
    {
      command: 'npm --prefix ../inspection-api run dev',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: { PORT: '4000' },
    },
    {
      command: 'npm --prefix ../inspection-web run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/*.spec.ts',
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
