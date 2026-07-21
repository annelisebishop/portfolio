# Password-protecting this site with Cloudflare

This gates your custom domain behind a real username/password (HTTP Basic
Auth), enforced at Cloudflare's edge before the request ever reaches
GitHub Pages. `basic-auth-worker.js` is the whole thing — no build step,
no dependencies, just paste it into the Cloudflare dashboard.

**Heads up:** this protects your *custom domain* only. The default
`yourusername.github.io` fallback URL that GitHub always publishes
alongside it can't be gated this way (that requires GitHub Enterprise).
Pick a non-guessable GitHub username/repo name and don't link to the
`.github.io` URL anywhere, and this is a non-issue in practice.

## Prerequisites

- Your domain's nameservers are pointed at Cloudflare (moved off Network
  Solutions' nameservers), with the domain added to a free Cloudflare
  account.
- DNS records in Cloudflare pointing your domain at GitHub Pages, with
  the proxy status set to **Proxied** (orange cloud) — Workers Routes
  only intercept proxied traffic, not "DNS only" (grey cloud) records.

## Setup

1. **Create the Worker.** Cloudflare dashboard → Workers & Pages →
   Create → Create Worker. Give it a name (e.g. `site-basic-auth`).
2. **Paste the script.** Open the online editor and replace the default
   contents with everything in `basic-auth-worker.js`. Deploy.
3. **Set your credentials as secrets** — never type the real password
   into the script itself, and never commit it to this repo. In the
   Worker's Settings → Variables → Environment Variables:
   - Add `AUTH_USERNAME`, type **Secret**, value = whatever username you
     want to give out
   - Add `AUTH_PASSWORD`, type **Secret**, value = whatever password you
     want to give out
   - Save (this redeploys the Worker with the secrets attached)
4. **Route it to your domain.** On the Worker's **Triggers** tab → Routes
   → Add Route. Add:
   - `yourdomain.com/*`
   - `www.yourdomain.com/*` (if you use the www subdomain too)

   Replace `yourdomain.com` with your actual domain.
5. **Test it.** Visit your domain in a private/incognito window — you
   should get a browser username/password prompt before anything loads.
   Wrong credentials (or none) get a 401; correct ones pass through to
   the real site.

## Changing the password later

Update the `AUTH_PASSWORD` secret in the Worker's Settings → Variables —
no code changes or redeploy of the site itself needed.

## Sharing access

Give out the domain + username + password directly (e.g. in an email to
a recruiter). There's no per-person login — anyone with the credentials
gets in, so treat the password like a shared secret and rotate it if you
think it's leaked.
