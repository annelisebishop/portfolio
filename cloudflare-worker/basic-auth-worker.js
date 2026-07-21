/**
 * Cloudflare Worker: custom-styled login gate for a GitHub Pages site.
 *
 * Sits in front of your custom domain. A visitor without a valid session
 * cookie is served a branded login page (instead of the browser's native
 * Basic Auth prompt). Submitting the right username/password sets a
 * signed, HttpOnly session cookie and forwards them to the real site —
 * the site itself never leaves GitHub, this Worker just refuses to
 * forward unauthenticated requests.
 *
 * Credentials are read from environment variables (set as encrypted
 * "Secret" variables in the Cloudflare dashboard, NOT hardcoded here —
 * see cloudflare-worker/README.md for setup steps):
 *   AUTH_USERNAME
 *   AUTH_PASSWORD
 */

const SESSION_COOKIE = 'auth_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.AUTH_USERNAME || !env.AUTH_PASSWORD) {
      return new Response('Auth not configured yet — set AUTH_USERNAME and AUTH_PASSWORD as secrets on this Worker.', { status: 500 });
    }

    if (request.method === 'POST' && url.pathname === '/__login') {
      return handleLogin(request, env);
    }

    const cookie = getCookie(request.headers.get('Cookie'), SESSION_COOKIE);
    if (cookie && (await isValidSession(cookie, env.AUTH_PASSWORD))) {
      // Credentials check out — forward to the actual origin (GitHub Pages).
      // This does not re-trigger this Worker.
      return fetch(request);
    }

    return renderLoginPage(url.pathname, false);
  },
};

async function handleLogin(request, env) {
  const form = await request.formData();
  const user = String(form.get('username') || '');
  const pass = String(form.get('password') || '');
  const redirectTo = sanitizeRedirect(String(form.get('redirect') || '/'));

  if (!(await timingSafeEqual(user, env.AUTH_USERNAME)) || !(await timingSafeEqual(pass, env.AUTH_PASSWORD))) {
    return renderLoginPage(redirectTo, true);
  }

  const token = await createSessionToken(env.AUTH_PASSWORD);
  const headers = new Headers();
  headers.set('Location', redirectTo);
  headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
  return new Response(null, { status: 302, headers });
}

function renderLoginPage(redirectTo, showError) {
  const safeRedirect = escapeHtml(sanitizeRedirect(redirectTo));
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign in</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    padding: 24px;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0b0d; color: #f2f2f3; }
    .card { background: #17171a; border-color: #2a2a2e; }
    input { background: #0f0f11; border-color: #34343a; color: #f2f2f3; }
  }
  .card {
    width: 100%;
    max-width: 360px;
    background: #fff;
    border: 1px solid #e5e5e7;
    border-radius: 14px;
    padding: 32px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  p.sub { margin: 0 0 24px; font-size: 0.9rem; opacity: 0.65; }
  label { display: block; font-size: 0.85rem; margin-bottom: 6px; font-weight: 500; }
  input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #d2d2d7;
    font-size: 1rem;
    margin-bottom: 16px;
  }
  input:focus { outline: 2px solid #0071e3; outline-offset: 1px; }
  button {
    width: 100%;
    padding: 11px;
    border: none;
    border-radius: 8px;
    background: #0071e3;
    color: #fff;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
  }
  button:hover { background: #0077ed; }
  .error {
    background: #fdecea;
    color: #b3261e;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 0.85rem;
    margin-bottom: 16px;
  }
  @media (prefers-color-scheme: dark) {
    .error { background: #3a1c1a; color: #ff8a80; }
  }
</style>
</head>
<body>
  <form class="card" method="POST" action="/__login">
    <h1>Restricted</h1>
    <p class="sub">Enter your credentials to view this site.</p>
    ${showError ? '<div class="error">Incorrect username or password.</div>' : ''}
    <input type="hidden" name="redirect" value="${safeRedirect}">
    <label for="username">Username</label>
    <input id="username" name="username" type="text" autocomplete="username" required autofocus>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`,
    {
      status: showError ? 401 : 200,
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    }
  );
}

// Only allow same-site, path-relative redirects — never forward to an
// external host supplied via the redirect field.
function sanitizeRedirect(path) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/';
  return path;
}

function getCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

async function createSessionToken(secret) {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = await hmac(secret, exp);
  return `${exp}.${sig}`;
}

async function isValidSession(token, secret) {
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (!Number.isFinite(Number(exp)) || Date.now() > Number(exp)) return false;
  const expected = await hmac(secret, exp);
  return timingSafeEqual(sig, expected);
}

async function hmac(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]));
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Constant-time comparison so a mismatch can't be detected faster/slower
// based on how many characters match (avoids leaking info via timing).
async function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}
