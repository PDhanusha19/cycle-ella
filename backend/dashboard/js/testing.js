AdminApi.requireAuth();
Layout.init({ active: '/dashboard/testing.html', title: 'Testing and usability' });
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

function row(label, value) {
  return el('tr', {}, [el('td', { text: label }), el('td', { text: value, style: 'text-align:right;font-weight:700;' })]);
}

async function loadAll() {
  const data = await AdminApi.get('/model-evaluation');
  const t = data.testing;
  const u = data.uat;
  const d = data.dataset;

  document.getElementById('kpi-playwright').textContent = `${t.playwright_passed} / ${t.playwright_passed + t.playwright_failed}`;
  document.getElementById('kpi-unit').textContent = `${t.unit_tests_passed} / ${t.unit_tests_passed}`;
  document.getElementById('kpi-manual').textContent = `${t.manual_cases_passed} / ${t.manual_cases_executed}`;
  document.getElementById('kpi-uat').textContent = u.participants;

  const testingTbody = document.getElementById('testing-table');
  testingTbody.appendChild(row('Playwright API tests (run ' + t.run_date + ')', `${t.playwright_passed} passed, ${t.playwright_failed} failed`));
  testingTbody.appendChild(row('Suite duration', `${t.playwright_seconds}s`));
  testingTbody.appendChild(row('Unit tests passed', `${t.unit_tests_passed}`));
  testingTbody.appendChild(row('Integration tests passed', `${t.integration_tests_passed}`));
  testingTbody.appendChild(row('Manual test cases', `${t.manual_cases_passed} / ${t.manual_cases_executed} passed`));

  const uatTbody = document.getElementById('uat-table');
  uatTbody.appendChild(row('Participants', `${u.participants}`));
  uatTbody.appendChild(row('Tasks completed', `${u.tasks_completed} / ${u.tasks_total}`));
  uatTbody.appendChild(row('SUS mean (SD)', `${u.sus_mean} (±${u.sus_sd})`));
  uatTbody.appendChild(row('SUS excl. identical pattern', `${u.sus_without_identical_pattern}`));
  uatTbody.appendChild(row('Feature rating range', `${u.feature_rating_range[0]} – ${u.feature_rating_range[1]}`));
  document.getElementById('uat-note').textContent = u.note;

  const datasetTbody = document.getElementById('dataset-table');
  datasetTbody.appendChild(row('Source', d.source));
  datasetTbody.appendChild(row('Total records', `${d.records}`));
  datasetTbody.appendChild(row('Complete records', `${d.complete_records}`));
  datasetTbody.appendChild(row('PCOS / Non-PCOS', `${d.pcos} / ${d.non_pcos} (${d.pcos_percent}%)`));
}

loadAll().catch((err) => console.error(err));
