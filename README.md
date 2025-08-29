# Lovable — Big Demo for Cloudflare Pages + Prerender

A larger, image-heavy **SPA** (Home, Gallery, Products, Blog, Contact) to verify **Prerender** with **Cloudflare Pages**. All content is rendered client-side so bots need Prerender to see it.

## What’s inside
- `index.html`, `styles.css` — layout, dark UI, hero section
- `app.js` — History API router; routes: `/`, `/gallery`, `/products`, `/products/:id`, `/blog`, `/contact`
- `assets/images/` — 1 hero, 12 gallery, 6 product images (PNG placeholders)
- `_worker.js` — Cloudflare **Pages Function**:
  - serves static files and SPA fallback for users
  - detects bots and forwards to **Prerender**
  - tries **path style**, then `?url=`, then `?uri=` (covers staging/internal variants)
  - optional debug headers when `PRERENDER_DEBUG=1`

## Deploy to Cloudflare Pages
1. Push these files to a GitHub repo (or import the zip).
2. Cloudflare → **Workers & Pages → Pages → Create project → Connect to Git** → pick the repo.
3. Build config:
   - Framework preset: **None**
   - Build command: **(empty)**
   - Output directory: **/** (root)
4. Click **Save and Deploy**. You’ll get `https://<project>.pages.dev`.

## Environment variables (Pages → Project → Settings → Environment variables)
- `PRERENDER_TOKEN` = your token (prod or staging; match the environment)
- `PRERENDER_BASE`  = `https://service.prerender.io` **or** `https://service.prerender-staging.dev`
  - (If your team insists on an internal base, set the **full URL** e.g., `https://private-cache.internal.prerender-staging.dev`)
- `PRERENDER_DEBUG` = `1` (optional during QA)

Redeploy after changing env vars.

## Prerender dashboard
- Add your Pages host (e.g., `<project>.pages.dev`) to **Domain Manager** in the **same environment** you’re calling.
- Use the Verify Integration wizard to test a fetch.

## Verify with curl
Replace `<host>` with your Pages hostname.

```bash
# Origin (users)
curl -I https://<host>/
curl -I https://<host>/gallery
curl -I https://<host>/products

# Bots (through Prerender)
curl -I -A "Googlebot" https://<host>/
curl -I -A "Googlebot" https://<host>/gallery
curl -I -A "Googlebot" https://<host>/products/2
curl -I -A "Googlebot" https://<host>/blog
```
**Expected for bots:** `HTTP/2 200` and `x-prerender-requestid`. If not, check the token, base, and Domain Manager allow-list.
