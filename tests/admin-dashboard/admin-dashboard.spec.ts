/**
 * Cycle Ella — Admin dashboard API contract tests
 * ================================================
 * Target: http://localhost:3000 (backend/index.js — see playwright.config.ts)
 *
 * The backend must be running first:
 *     cd backend && npm start
 * ...with ADMIN_USERNAME / ADMIN_PASSWORD_HASH set in backend/.env (see
 * backend/.env.example for how to generate the hash).
 *
 * These tests log in for real, so they need the PLAINTEXT credentials that
 * hash came from, passed as env vars (never hardcode a real password here):
 *     ADMIN_TEST_USERNAME=admin ADMIN_TEST_PASSWORD=yourpassword npx playwright test
 * (from this folder, or with --config tests/admin-dashboard/playwright.config.ts
 * from the repo root). Tests that need a logged-in session are skipped if
 * these are not set, so the suite still runs (and still proves the 401/429
 * guarantees) without them.
 */

import { test, expect } from '@playwright/test';

const READ_ENDPOINTS = [
  '/api/admin/summary',
  '/api/admin/risk-distribution',
  '/api/admin/timeseries?weeks=4',
  '/api/admin/cycle-regularity',
  '/api/admin/top-foods',
  '/api/admin/health-conditions',
  '/api/admin/languages',
  '/api/admin/feature-usage',
  '/api/admin/model-evaluation',
];

// Field names that must never appear anywhere in an admin endpoint's JSON
// response — the dashboard is aggregate-only, by design (see adminController.js).
const PII_KEYS = ['email', 'phone', 'full_name', 'password', 'date_of_birth', 'otp'];

function containsPiiKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = containsPiiKey(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.includes(key.toLowerCase())) return key;
      const hit = containsPiiKey(v);
      if (hit) return hit;
    }
  }
  return null;
}

test.describe('Admin auth guard', () => {
  for (const endpoint of READ_ENDPOINTS) {
    test(`${endpoint} returns 401 with no token`, async ({ request }) => {
      const res = await request.get(endpoint);
      expect(res.status()).toBe(401);
    });

    test(`${endpoint} returns 401 with a garbage token`, async ({ request }) => {
      const res = await request.get(endpoint, { headers: { Authorization: 'Bearer not-a-real-token' } });
      expect(res.status()).toBe(401);
    });
  }
});

// Order matters below: the login endpoint's per-IP rate limit (5 failed
// attempts / 15 min, see adminController.js) is shared across every test
// in this file, and playwright.config.ts runs this file serially on one
// worker so declaration order is execution order. The successful-login
// test runs first, *before* anything deliberately fails a login; the test
// that intentionally exhausts the limiter runs last, so it cannot block
// the tests that need a working session.
const USERNAME = process.env.ADMIN_TEST_USERNAME;
const PASSWORD = process.env.ADMIN_TEST_PASSWORD;

test.describe('Authenticated session', () => {
  test.skip(!USERNAME || !PASSWORD, 'Set ADMIN_TEST_USERNAME / ADMIN_TEST_PASSWORD to run this suite');

  test('logs in and every read endpoint returns 200 with no personal data', async ({ request }) => {
    const loginRes = await request.post('/api/admin/login', { data: { username: USERNAME, password: PASSWORD } });
    expect(loginRes.status()).toBe(200);
    const { token } = await loginRes.json();
    expect(typeof token).toBe('string');

    for (const endpoint of READ_ENDPOINTS) {
      const res = await request.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status(), `${endpoint} should return 200 with a valid admin token`).toBe(200);

      const body = await res.json();
      const piiHit = containsPiiKey(body);
      expect(piiHit, `${endpoint} response contains a personal-data field: "${piiHit}"`).toBeNull();
    }
  });
});

test.describe('Admin login', () => {
  test('rejects a wrong password without revealing which field was wrong', async ({ request }) => {
    const res = await request.post('/api/admin/login', { data: { username: 'admin', password: 'definitely-wrong' } });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message).toBe('Invalid credentials');
    expect(body.token).toBeUndefined();
  });

  test('rejects a missing username/password with 400', async ({ request }) => {
    const res = await request.post('/api/admin/login', { data: {} });
    expect(res.status()).toBe(400);
  });

  // Runs last on purpose — see the file-level comment above.
  test('locks out after repeated failures (rate limit)', async ({ request }) => {
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request.post('/api/admin/login', { data: { username: 'admin', password: `wrong-${i}` } });
      lastStatus = res.status();
    }
    expect(lastStatus).toBe(429);
  });
});
