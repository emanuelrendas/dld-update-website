/**
 * RAIOC Executive Command Center - Human Session Login Gate
 * Rendered instead of the command center when no valid dashboard session
 * cookie is present. Never embeds INTERNAL_SERVICE_KEY or any secret.
 */

export function renderDashboardLoginPage({ error = '', notConfigured = false } = {}) {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAIOC — Executive Command Center Sign In</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
      background:#0b0d10; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#e5e7eb; }
    .card { width:320px; padding:32px; background:#12151a; border:1px solid #262a31; border-radius:12px; }
    h1 { font-size:15px; font-weight:700; letter-spacing:.02em; margin:0 0 4px; }
    p.sub { font-size:12px; color:#8b93a1; margin:0 0 20px; }
    label { display:block; font-size:11px; color:#8b93a1; margin-bottom:6px; }
    input { width:100%; box-sizing:border-box; padding:10px 12px; background:#0b0d10; border:1px solid #2b2f37;
      border-radius:8px; color:#e5e7eb; font-size:13px; margin-bottom:14px; }
    button { width:100%; padding:10px 12px; background:#6366f1; border:none; border-radius:8px; color:#fff;
      font-size:13px; font-weight:600; cursor:pointer; }
    button:disabled { opacity:.6; cursor:not-allowed; }
    .msg { font-size:12px; color:#f87171; margin-bottom:14px; min-height:14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>RAIOC Executive Command Center</h1>
    <p class="sub">Sign in to continue.</p>
    <div class="msg">${notConfigured ? 'Dashboard sign-in is not configured. Contact the system owner.' : (error || '')}</div>
    <form id="login-form">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autocomplete="current-password" autofocus />
      <button type="submit" id="submit-btn" ${notConfigured ? 'disabled' : ''}>Sign In</button>
    </form>
  </div>
  <script>
    const API_BASE = (typeof window !== 'undefined' && window.location.hostname.includes('emanuelrendas.com'))
      ? 'https://api.emanuelrendas.com' : '';
    const form = document.getElementById('login-form');
    const btn = document.getElementById('submit-btn');
    const msg = document.querySelector('.msg');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      msg.textContent = '';
      try {
        const res = await fetch(API_BASE + '/api/dashboard/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: document.getElementById('password').value }),
        });
        if (res.ok) {
          window.location.href = '/dashboard';
        } else {
          const data = await res.json().catch(() => ({}));
          msg.textContent = data.error || 'Sign in failed';
          btn.disabled = false;
        }
      } catch (err) {
        msg.textContent = 'Network error, please try again';
        btn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
