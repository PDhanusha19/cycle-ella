AdminApi.requireAuth();
Layout.init({ active: '/dashboard/users.html', title: 'Users and usage' });
document.getElementById('footer-slot').innerHTML = Layout.footerNoteHtml();

let languagesChart = null;
let healthChart = null;
let featureChart = null;

async function loadLanguages() {
  const { languages } = await AdminApi.get('/languages');
  const canvas = document.getElementById('chart-languages');
  const hasData = toggleEmptyState(canvas, languages.length > 0);
  if (!hasData) return;

  if (languagesChart) languagesChart.destroy();
  languagesChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: languages.map((l) => l.language || 'Unknown'),
      datasets: [{
        data: languages.map((l) => l.count),
        backgroundColor: languages.map((_, i) => CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]),
        borderWidth: 0,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom' } } },
  });
}

async function loadHealthConditions() {
  const data = await AdminApi.get('/health-conditions');
  const fields = ['diabetes', 'cholesterol', 'blood_pressure'];
  const allValues = new Set();
  fields.forEach((f) => (data[f] || []).forEach((row) => allValues.add(row.value)));
  const values = Array.from(allValues);

  const canvas = document.getElementById('chart-health');
  const hasData = toggleEmptyState(canvas, values.length > 0);
  if (!hasData) return;

  const datasets = fields.map((field, i) => {
    const byValue = Object.fromEntries((data[field] || []).map((r) => [r.value, r.count]));
    return {
      label: field.replace('_', ' '),
      data: values.map((v) => byValue[v] || 0),
      backgroundColor: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
      borderRadius: 6,
    };
  });

  if (healthChart) healthChart.destroy();
  healthChart = new Chart(canvas, {
    type: 'bar',
    data: { labels: values, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

async function loadFeatureUsage() {
  const { feature_usage: fu } = await AdminApi.get('/feature-usage');
  const labels = {
    period_tracking: 'Period tracking',
    food_logging: 'Food logging',
    pcos_assessments: 'PCOS assessments',
    reminders_set: 'Reminders set',
    tips_viewed: 'Daily tips viewed',
  };
  const keys = Object.keys(labels);
  const values = keys.map((k) => fu[k] || 0);

  const canvas = document.getElementById('chart-feature-usage');
  const hasData = toggleEmptyState(canvas, values.some((v) => v > 0));
  if (!hasData) return;

  if (featureChart) featureChart.destroy();
  featureChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: keys.map((k) => labels[k]),
      datasets: [{
        data: values,
        backgroundColor: keys.map((_, i) => CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]),
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } },
    },
  });
}

async function loadAll() {
  document.getElementById('last-updated').textContent = Layout.formatTimestamp(new Date());
  await Promise.all([loadLanguages(), loadHealthConditions(), loadFeatureUsage()]);
}

document.getElementById('refresh-btn').addEventListener('click', loadAll);
loadAll().catch((err) => console.error(err));
