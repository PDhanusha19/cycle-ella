document.getElementById('login-logo').innerHTML = Layout.LOGO_SVG;

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

// Already have a session? Skip straight to the dashboard.
if (AdminApi.getToken()) {
  location.href = '/dashboard/index.html';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in…';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const result = await AdminApi.login(username, password);
    AdminApi.setToken(result.token);
    location.href = '/dashboard/index.html';
  } catch (err) {
    errorBox.textContent = err.message || 'Login failed';
    errorBox.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log in';
  }
});
