AdminApi.requireAuth();
Layout.init({ active: '/dashboard/cycle.html', title: 'Cycle and nutrition' });
document.getElementById('footer-slot').innerHTML = Layout.footerNoteHtml();

let regularityChart = null;
let topFoodsChart = null;

async function loadRegularity() {
  const data = await AdminApi.get('/cycle-regularity');
  const canvas = document.getElementById('chart-regularity');
  const hasData = toggleEmptyState(canvas, data.users_with_period_data > 0, 'No period data logged yet');
  if (!hasData) return;

  const labels = ['Regular', 'Irregular', 'Not enough data'];
  const values = [data.regular, data.irregular, data.not_enough_data];
  const colors = [ChartTheme.green, ChartTheme.pink, ChartTheme.lavender];

  if (regularityChart) regularityChart.destroy();
  regularityChart = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } },
    },
  });
}

async function loadTopFoods() {
  const { top_foods: foods } = await AdminApi.get('/top-foods');
  const canvas = document.getElementById('chart-top-foods');
  const hasData = toggleEmptyState(canvas, foods.length > 0, 'No food logs yet');
  if (!hasData) return;

  if (topFoodsChart) topFoodsChart.destroy();
  topFoodsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: foods.map((f) => f.food_name),
      datasets: [{
        data: foods.map((f) => f.count),
        backgroundColor: ChartTheme.purple,
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: false } },
    },
  });
}

async function loadAll() {
  document.getElementById('last-updated').textContent = Layout.formatTimestamp(new Date());
  await Promise.all([loadRegularity(), loadTopFoods()]);
}

document.getElementById('refresh-btn').addEventListener('click', loadAll);
loadAll().catch((err) => console.error(err));
