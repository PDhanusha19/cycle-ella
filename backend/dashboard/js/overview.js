AdminApi.requireAuth();
Layout.init({ active: '/dashboard/index.html', title: 'Overview' });
document.getElementById('footer-slot').innerHTML = Layout.footerNoteHtml();

let riskChart = null;
let timeseriesChart = null;

function setKpi(id, value) {
  document.getElementById(id).textContent = (value ?? 0).toLocaleString('en-US');
}

async function loadSummary() {
  const data = await AdminApi.get('/summary');
  setKpi('kpi-total-users', data.total_users);
  setKpi('kpi-verified-users', data.verified_users);
  setKpi('kpi-assessments', data.completed_assessments);
  setKpi('kpi-period-logs', data.period_logs);
  setKpi('kpi-food-logs', data.food_logs);
  setKpi('kpi-reminders', data.active_reminders);
}

async function loadRiskChart() {
  const { distribution } = await AdminApi.get('/risk-distribution');
  const canvas = document.getElementById('chart-risk');
  const hasData = toggleEmptyState(canvas, distribution.length > 0, 'No assessments logged yet');
  if (!hasData) return;

  const order = ['Low', 'Medium', 'High'];
  const byLevel = Object.fromEntries(distribution.map((d) => [d.risk_level, d.count]));
  const labels = order.filter((l) => byLevel[l]);
  const values = labels.map((l) => byLevel[l]);
  const colors = labels.map((l) => RISK_COLORS[l] || ChartTheme.purple);

  if (riskChart) riskChart.destroy();
  riskChart = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

async function loadTimeseries() {
  const { series } = await AdminApi.get('/timeseries?weeks=12');
  const canvas = document.getElementById('chart-timeseries');
  const hasData = toggleEmptyState(canvas, series.some((s) => s.registrations > 0 || s.assessments > 0), 'No activity in the last 12 weeks');
  if (!hasData) return;

  const labels = series.map((s) => new Date(s.week_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));

  if (timeseriesChart) timeseriesChart.destroy();
  timeseriesChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Registrations',
          data: series.map((s) => s.registrations),
          borderColor: ChartTheme.purple,
          backgroundColor: ChartTheme.purple,
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: 'Assessments',
          data: series.map((s) => s.assessments),
          borderColor: ChartTheme.pink,
          backgroundColor: ChartTheme.pink,
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

async function loadAll() {
  document.getElementById('last-updated').textContent = Layout.formatTimestamp(new Date());
  await Promise.all([loadSummary(), loadRiskChart(), loadTimeseries()]);
}

document.getElementById('refresh-btn').addEventListener('click', loadAll);
loadAll().catch((err) => console.error(err));
