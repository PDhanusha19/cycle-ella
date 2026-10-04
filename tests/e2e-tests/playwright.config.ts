import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Resolved relative to THIS file, so './tests' pointed at
  // tests/e2e-tests/tests/ — a directory that does not exist, and no
  // tests were ever discovered. '.' is this folder, where the specs live.
  testDir: '.',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5001',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  // No 'projects' with browsers needed for pure API testing —
  // add a chromium project later only if you get an Expo web build working.
});