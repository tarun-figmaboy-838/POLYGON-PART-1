// scratch config (not committed): the worktree's tests on spare ports while another run holds 8181
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 180_000, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:8191', trace: 'off', video: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } }],
  webServer: [{ command: 'node tools/serve.mjs 8191', url: 'http://127.0.0.1:8191/index.html', reuseExistingServer: true, timeout: 30_000 }]
});
