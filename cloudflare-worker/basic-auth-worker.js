/**
 * Cloudflare Worker: HTTP Basic Auth gate for a GitHub Pages site.
 *
 * Sits in front of your custom domain. Every request must present valid
 * Basic Auth credentials before it's allowed through to the GitHub Pages
 * origin — the site itself never leaves GitHub, this Worker just refuses
 * to forward unauthenticated requests.
 *
 * Credentials are read from environment variables (set as encrypted
 * "Secret" variables in the Cloudflare dashboard, NOT hardcoded here —
 * see cloudflare-worker/README.md for setup steps):
 *   AUTH_USERNAME
 *   AUTH_PASSWORD
 */

export default {
  async fetch(request, env) {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !isAuthorized(authHeader, env.AUTH_USERNAME, env.AUTH_PASSWORD)) {
      return new Response('Authentication required.', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Restricted", charset="UTF-8"',
        },
      });
    }

    // Credentials check out — forward the request to the actual origin
    // (GitHub Pages). This does not re-trigger this Worker.
    return fetch(request);
  },
};

function isAuthorized(authHeader, validUser, validPass) {
  if (!authHeader.startsWith('Basic ')) return false;
  if (!validUser || !validPass) return false; // secrets not configured yet

  let decoded;
  try {
    decoded = atob(authHeader.slice('Basic '.length));
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return false;

  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  return timingSafeEqual(user, validUser) && timingSafeEqual(pass, validPass);
}

// Constant-time comparison so a mismatch can't be detected faster/slower
// based on how many characters match (avoids leaking info via timing).
function timingSafeEqual(a, b) {
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
