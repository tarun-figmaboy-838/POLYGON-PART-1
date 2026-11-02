// A LIGHT RUNNER FOR PART 2, while a level is being built.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['zzdeploy.spec.mjs', 'zzcase.spec.mjs', 'zzlive.spec.mjs'],
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8181',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'phone-landscape', use: { ...devices['Desktop Chrome'], viewport: { width: 844, height: 390 } } }
  ],
  webServer: {
    command: 'node tools/serve.mjs 8181',
    url: 'http://127.0.0.1:8181/index.html',
    reuseExistingServer: true,
    timeout: 30_000
  }
});
