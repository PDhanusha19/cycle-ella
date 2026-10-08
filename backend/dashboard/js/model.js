AdminApi.requireAuth();
Layout.init({ active: '/dashboard/model.html', title: 'Model evaluation' });
document.getElementById('footer-slot').innerHTML = Layout.footerNoteHtml();

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(c));
  return node;
}

function fmtPct(n, digits = 1) {
  return `${Number(n).toFixed(digits)}%`;
}

function renderKpis(data) {
  document.getElementById('kpi-t1-percent').textContent = fmtPct(data.t1_percent_of_t4_auc);
  document.getElementById('kpi-parity').textContent = `${data.parity.identical_risk_levels} / ${data.parity.records}`;
  document.getElementById('kpi-api-tests').textContent = `${data.testing.playwright_passed} / ${data.testing.playwright_passed + data.testing.playwright_failed}`;
  document.getElementById('kpi-sus').textContent = data.uat.sus_mean.toFixed(1);
}

function renderAucChart(data) {
  const canvas = document.getElementById('chart-auc');
  const labels = data.tiers.map((t) => `${t.id} — ${t.name}`);
  const series = [
    { key: 'logistic_regression', label: 'Logistic Regression', color: ChartTheme.pink },
    { key: 'random_forest', label: 'Random Forest', color: ChartTheme.purple },
    { key: 'svm', label: 'SVM', color: ChartTheme.blue },
  ];

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: data.auc[s.key],
        backgroundColor: s.color,
        borderRadius: 6,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { min: 80, max: 100, ticks: { callback: (v) => `${v}%` } } },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

function renderLrTable(data) {
  const tbody = document.querySelector('#lr-table tbody');
  data.lr_detail.forEach((row) => {
    tbody.appendChild(el('tr', {}, [
      el('td', { text: row.tier }),
      el('td', { text: fmtPct(row.auc) }),
      el('td', { text: `${row.ci[0]}–${row.ci[1]}` }),
      el('td', { text: fmtPct(row.sensitivity) }),
      el('td', { text: fmtPct(row.specificity) }),
      el('td', { text: fmtPct(row.accuracy) }),
      el('td', { text: fmtPct(row.ppv) }),
      el('td', { text: fmtPct(row.npv) }),
      el('td', { text: fmtPct(row.pr_auc) }),
      el('td', { text: row.brier.toFixed(3) }),
    ]));
  });
}

function renderCorrectedTable(data) {
  const tbody = document.querySelector('#corrected-table tbody');
  data.corrected_tests.forEach((row) => {
    const badge = el('span', {
      class: row.significant ? 'badge badge-significant' : 'badge badge-not-significant',
      text: row.significant ? 'Significant' : 'Not significant',
    });
    tbody.appendChild(el('tr', {}, [
      el('td', { text: row.comparison }),
      el('td', { text: `${row.delta_auc > 0 ? '+' : ''}${row.delta_auc}` }),
      el('td', { text: row.p < 0.001 ? '<0.001' : row.p.toString() }),
      el('td', { text: `${row.ci[0]}–${row.ci[1]}` }),
      el('td', {}, [badge]),
    ]));
  });

  const naive = data.naive_wilcoxon_p;
  const naivePairs = Object.keys(naive).map((k) => `${k} (p=${naive[k]})`).join(' and ');
  document.getElementById('corrected-caption').textContent =
    `An uncorrected Wilcoxon test would have called ${naivePairs} significant — multiple-comparison correction changes that conclusion.`;
}

function renderConfusion(data) {
  const c = data.deployed_model_holdout.confusion;
  const grid = document.getElementById('confusion-grid');

  const cell = (cls, n, lbl) => el('div', { class: `cell ${cls}` }, [
    el('span', { class: 'n', text: n }),
    el('span', { class: 'lbl', text: lbl }),
  ]);

  grid.appendChild(el('div', { class: 'head' }));
  grid.appendChild(el('div', { class: 'head', text: 'Predicted: No PCOS' }));
  grid.appendChild(el('div', { class: 'head', text: 'Predicted: PCOS' }));

  grid.appendChild(el('div', { class: 'head', text: 'Actual: No PCOS' }));
  grid.appendChild(cell('tn', c.tn, 'True negative'));
  grid.appendChild(cell('fp', c.fp, 'False positive'));

  grid.appendChild(el('div', { class: 'head', text: 'Actual: PCOS' }));
  grid.appendChild(cell('fn', c.fn, 'False negative'));
  grid.appendChild(cell('tp', c.tp, 'True positive'));

  const h = data.deployed_model_holdout;
  document.getElementById('confusion-caption').textContent =
    `${h.test_records} held-out records — precision ${fmtPct(h.precision)}, recall ${fmtPct(h.recall)}, F1 ${fmtPct(h.f1)}.`;
}

async function loadAll() {
  const data = await AdminApi.get('/model-evaluation');
  renderKpis(data);
  renderAucChart(data);
  renderLrTable(data);
  renderCorrectedTable(data);
  renderConfusion(data);
}

loadAll().catch((err) => console.error(err));
