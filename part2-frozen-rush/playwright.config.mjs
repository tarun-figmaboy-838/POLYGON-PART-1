import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // the game preloads its art set before it will run; a per-test 30s is too tight
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8181',
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    video: 'off',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'phone-landscape', use: { ...devices['Desktop Chrome'], viewport: { width: 844, height: 390 } } }
  ],
  webServer: [
    {
      command: 'node tools/serve.mjs 8181',
      url: 'http://127.0.0.1:8181/index.html',
      reuseExistingServer: true,
      timeout: 30_000
    },
    {
      command: 'node tools/zzvercel-sim.mjs root 8201',
      url: 'http://127.0.0.1:8201/game/',
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command: 'node tools/zzcase-serve.mjs 8321',
      url: 'http://127.0.0.1:8321/index.html',
      reuseExistingServer: true,
      timeout: 30_000
    }
  ]
});
