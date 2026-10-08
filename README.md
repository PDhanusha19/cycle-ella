# cycle-ella
AI Powered PCOS Nutrition Coaching App

## Admin dashboard

A read-only web dashboard at `/dashboard` for viewing aggregated system
analytics (users, usage, cycle/nutrition patterns) and the static model
evaluation results from the thesis. It never exposes names, emails,
phone numbers or any other individual record — every analytics endpoint
returns counts and aggregates only.

### Setup

1. Add to `backend/.env` (see `backend/.env.example`):
   ```
   ADMIN_USERNAME=youradminname
   ADMIN_PASSWORD_HASH=<bcrypt hash, generated below>
   ```
2. Generate the bcrypt hash (never store the plain-text password):
   ```bash
   cd backend
   node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
   ```
   Paste the output into `ADMIN_PASSWORD_HASH`.
3. `JWT_SECRET` must already be set (the server refuses to start without
   it — see the main backend setup).

### Run

```bash
cd backend
npm install   # first time only — installs chart.js locally, no CDN used
npm start
```

Open **http://localhost:3000/dashboard** (or whatever `PORT` is set to)
and log in with the username/password from step 1.

Pages: **Overview** (KPIs, risk distribution, registrations/assessments
over time) · **Users and usage** (language, health conditions, feature
usage) · **Cycle and nutrition** (cycle regularity, top logged foods) ·
**Model evaluation** and **Testing and usability** (static thesis
results from `backend/data/model_evaluation.json`).

### Tests

```bash
cd backend && npm start   # in one terminal, dashboard must be running
# in another terminal, from the repo root:
ADMIN_TEST_USERNAME=youradminname ADMIN_TEST_PASSWORD=yourpassword \
  npx playwright test --config tests/admin-dashboard/playwright.config.ts
```

Proves: login works with correct credentials, fails with the wrong
password, every analytics endpoint returns 401 without a token, the
login rate limit locks out after repeated failures, and no endpoint
response contains a personal-data field.

### Viva demo script (5 lines)

1. Open `/dashboard` — login screen matches the app's theme; log in.
2. **Overview** — point out the 6 live KPIs and the risk-distribution
   chart, computed from the real `pcos_risk` table, not hardcoded.
3. **Cycle and nutrition** — note the regularity chart reuses the exact
   same rule (`utils/cycleCalculations.js`) the mobile app uses, so the
   two can never disagree.
4. **Model evaluation** — point out the "static results from the thesis"
   label: these numbers come from the trained-model evaluation, not a
   live query, and the AUC chart's axis deliberately starts at 80%.
5. Refresh any chart live, then show a `curl` call to an endpoint
   without a token returning 401 — the dashboard is read-only and
   access-controlled.
