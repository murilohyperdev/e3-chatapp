import { defineConfig } from '@playwright/test'

// Browser tests against the running Docker stack (docker compose up -d).
// One worker on purpose: there is a single chat room and a single "current alert",
// so tests that ran in parallel would interfere with each other.
export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'off',
    launchOptions: {
      // Optional: use an already installed Chromium instead of `npx playwright install chromium`.
      executablePath: process.env.E2E_CHROMIUM_PATH || undefined,
    },
  },
})
