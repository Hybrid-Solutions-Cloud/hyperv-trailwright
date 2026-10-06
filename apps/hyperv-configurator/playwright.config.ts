import { defineConfig } from '@playwright/test'

const publishedUrl = process.env.E2E_BASE_URL
const pagesToken = process.env.E2E_PAGES_TOKEN
if (pagesToken && (!publishedUrl || new URL(publishedUrl).origin !== 'https://tierpoint.gitlab.io')) {
  throw new Error('Pages verification credentials are restricted to the TierPoint GitLab Pages origin.')
}

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
    extraHTTPHeaders: pagesToken ? { Authorization: `Bearer ${pagesToken}` } : undefined,
    trace: pagesToken ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4319 --strictPort',
    url: 'http://127.0.0.1:4319/',
    reuseExistingServer: false,
    timeout: 60000,
  },
})
