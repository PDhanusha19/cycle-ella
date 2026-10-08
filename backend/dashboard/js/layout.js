// Shared chrome (sidebar + topbar + footer) for every dashboard page, plus
// a couple of small DOM-safety helpers used across pages.
const Layout = (() => {
  const LOGO_SVG = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E5457A"/><stop offset="1" stop-color="#9B4DB5"/></linearGradient></defs><rect width="40" height="40" rx="10" fill="url(#logo-g)"/><text x="20" y="28" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="22" fill="#fff">E</text></svg>`;

  const NAV_ITEMS = [
    { href: '/dashboard/index.html', label: 'Overview' },
    { href: '/dashboard/users.html', label: 'Users and usage' },
    { href: '/dashboard/cycle.html', label: 'Cycle and nutrition' },
    { href: '/dashboard/model.html', label: 'Model evaluation' },
    { href: '/dashboard/testing.html', label: 'Testing and usability' },
  ];

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function renderSidebar(activeHref) {
    const items = NAV_ITEMS.map((item) => {
      const active = item.href === activeHref ? ' active' : '';
      return `<a href="${item.href}" class="${active.trim()}">${escapeHtml(item.label)}</a>`;
    }).join('');

    return `
      <div class="sidebar-brand">
        <span class="logo">${LOGO_SVG}</span>
        <span class="wordmark">Cycle Ella</span>
      </div>
      <nav class="sidebar-nav">${items}</nav>
      <div class="sidebar-foot">Admin dashboard &middot; screening aid, not a diagnosis.</div>
    `;
  }

  function renderTopbar(title) {
    return `
      <h1>${escapeHtml(title)}</h1>
      <div class="topbar-right">
        <span class="chip">Admin</span>
        <button class="btn btn-ghost" id="logout-btn" type="button">Logout</button>
      </div>
    `;
  }

  function init({ active, title }) {
    const sidebarSlot = document.getElementById('sidebar-slot');
    const topbarSlot = document.getElementById('topbar-slot');
    if (sidebarSlot) sidebarSlot.innerHTML = renderSidebar(active);
    if (topbarSlot) topbarSlot.innerHTML = renderTopbar(title);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => AdminApi.logout());

    document.title = `${title} — Cycle Ella Admin`;
  }

  function formatTimestamp(date) {
    return date.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function footerNoteHtml() {
    return '<div class="footer-note">Screening aid, not a diagnosis. Aggregated data only.</div>';
  }

  return { escapeHtml, init, formatTimestamp, footerNoteHtml, LOGO_SVG };
})();
