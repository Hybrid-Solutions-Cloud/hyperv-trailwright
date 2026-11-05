import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '.artifacts/browser',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4319/',
    browserName: 'chromium',
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4319 --strictPort',
    url: 'http://127.0.0.1:4319/',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
