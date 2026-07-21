# Ann Bishop — Portfolio

Personal portfolio site for Ann Bishop (Product, Design & Research Leadership).

🔗 **Live site:** _add your custom domain here once it's live, e.g. annbishop.com_

## About this project

A single self-contained `index.html` — no build step, no framework, no
dependencies. All CSS is inline in a `<style>` tag and all fonts/images are
self-hosted, so the site works entirely offline and loads fast.

## Structure

```
index.html   — the entire site (markup, styles, and a small script for
               the nav scroll state, mobile menu, and case-study accordions)
fonts/       — self-hosted variable font files (Instrument Sans, Fraunces,
               EB Garamond)
images/      — case study screenshots and client logo favicons
```

## Running locally

No install needed. From this folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Editing content

Everything — text, case studies, timeline entries, contact links — lives
directly in `index.html`. Search for the section you want to change (nav
comments like `<!-- ====== WORK ====== -->` mark each section) and edit
the markup in place.

To update the résumé PDF, replace the file linked from the nav's "Résumé"
button (`/Ann_Bishop_Resume.pdf`).

## Deployment

Hosted on GitHub Pages. Pushing to `main` updates the live site
automatically — there's nothing to build or compile.
