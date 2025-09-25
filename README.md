# Cloudflare Pages: Dynamic sitemap index + correct XML serving

This package fixes invalid XML responses and **auto-builds** `sitemap_index.xml` at runtime by scanning which `sitemap_small*.xml` files exist.

## What it does
- Forces correct headers for all `sitemap*.xml` and `robots.txt`.
- Serves them as **static assets** (no SPA/HTML preload).
- **Dynamically generates** `/sitemap_index.xml` by probing `sitemap_small1..300.xml` and also root `sitemap{1,2,3}.xml`. Adjust the range in `_worker.js` if needed.

## Install
1. Put `_worker.js`, `_headers`, `_routes.json`, `robots.txt` in your repo root.
2. Commit & deploy to Cloudflare Pages.

## Verify
```
curl -I https://<your-domain>/sitemap_small1.xml   # Content-Type: application/xml
curl -I https://<your-domain>/sitemap_small41.xml  # Content-Type: application/xml
curl -I https://<your-domain>/robots.txt           # Content-Type: text/plain
curl    https://<your-domain>/sitemap_index.xml    # Should contain entries for all existing sitemaps
```

If you have more than 300 small files, bump `SMALL_MAX` in `_worker.js`.