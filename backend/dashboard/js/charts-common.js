// Shared Chart.js defaults + small helpers used by every chart page.
const ChartTheme = {
  pink: '#E5457A',
  pinkDark: '#C73568',
  purple: '#9B4DB5',
  purpleDark: '#7A3A91',
  navyLight: '#2A1A4A',
  green: '#2ECC8E',
  amber: '#F5A623',
  blue: '#3B9EFF',
  textPrimary: '#2D1B4E',
  textSecondary: '#8B7A9E',
  border: '#E8D4F5',
  lavender: '#EDE4FA',
};

// Cycled across bar/doughnut series so every chart reads as one system.
const CATEGORICAL_PALETTE = [
  ChartTheme.pink,
  ChartTheme.purple,
  ChartTheme.blue,
  ChartTheme.amber,
  ChartTheme.green,
  ChartTheme.navyLight,
  ChartTheme.pinkDark,
  ChartTheme.purpleDark,
];

const RISK_COLORS = {
  Low: ChartTheme.green,
  Medium: ChartTheme.amber,
  High: ChartTheme.pink,
};

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = ChartTheme.textSecondary;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.scale.grid.color = ChartTheme.border;
  Chart.defaults.scale.grid.drawBorder = false;
}

// Toggles a canvas vs. its sibling .empty-state div. `hasData` decides
// which one is shown; returns hasData so call sites can early-return.
function toggleEmptyState(canvasEl, hasData, message = 'No data yet') {
  const wrap = canvasEl.closest('.chart-wrap');
  let emptyEl = wrap.querySelector('.empty-state');
  if (!emptyEl) {
    emptyEl = document.createElement('div');
    emptyEl.className = 'empty-state';
    emptyEl.innerHTML = `<span class="icon">&#128202;</span><span></span>`;
    wrap.appendChild(emptyEl);
  }
  emptyEl.querySelector('span:last-child').textContent = message;
  emptyEl.hidden = hasData;
  canvasEl.style.visibility = hasData ? 'visible' : 'hidden';
  return hasData;
}
