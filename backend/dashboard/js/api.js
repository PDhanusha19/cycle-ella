// Thin fetch wrapper for the admin dashboard. Token lives in
// sessionStorage only (cleared when the tab closes) — never localStorage,
// so a shared/demo machine doesn't keep an admin session alive.
const AdminApi = (() => {
  const TOKEN_KEY = 'cycleella_admin_token';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function isLoginPage() {
    return location.pathname.endsWith('/login.html');
  }

  async function request(path, options = {}) {
    const token = getToken();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`/api/admin${path}`, Object.assign({}, options, { headers }));
    const body = await res.json().catch(() => ({}));

    // A 401 from /login means "wrong credentials" — surface the server's
    // message. A 401 from anywhere else means the session token is missing
    // or expired, which is the only case that should clear it and redirect.
    if (res.status === 401 && path !== '/login') {
      clearToken();
      if (!isLoginPage()) location.href = '/dashboard/login.html';
      throw new Error('Session expired, please log in again');
    }

    if (!res.ok) {
      throw new Error(body.message || `Request failed (${res.status})`);
    }
    return body;
  }

  function get(path) {
    return request(path, { method: 'GET' });
  }

  function login(username, password) {
    return request('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  }

  function requireAuth() {
    if (!getToken() && !isLoginPage()) {
      location.href = '/dashboard/login.html';
    }
  }

  function logout() {
    clearToken();
    location.href = '/dashboard/login.html';
  }

  return { get, login, requireAuth, logout, setToken, getToken };
})();
