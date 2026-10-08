import { defineConfig } from '@playwright/test';

// Mirrors tests/e2e-tests/playwright.config.ts's pattern (own baseURL,
// testDir '.' so specs resolve relative to this folder) but points at the
// Node backend (index.js, port from backend/.env PORT) instead of the
// Flask AI service.
export default defineConfig({
  testDir: '.',
  // Serial, single worker: several tests here deliberately burn the admin
  // login's shared per-IP rate limit (adminController.js), so test order
  // matters — see the comment above `test.describe.configure` in the spec.
  fullyParallel: false,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.ADMIN_TEST_BASE_URL || 'http://localhost:3000',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
});
