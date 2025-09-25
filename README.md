# Cloudflare Pages Sitemaps Fix

Drop these files in your project root and redeploy (or commit to the repo root for Pages).

## Files
- `_headers` – sets correct `Content-Type` for `*.xml` and `robots.txt`.
- `_routes.json` – excludes `sitemap*.xml` and `robots.txt` from SPA routing/Pages Functions so the static files are served.
- `sitemap_index.xml` – minimal valid index (update URLs if your domain/path differs).
- `sitemap_small1.xml` – minimal valid child sitemap (copy/extend as needed).
- `robots.txt` – references the sitemap index.

## Verify after deploy
- `curl -I https://<your-domain>/sitemap_small1.xml` → should return `Content-Type: application/xml`
- Open the URL in browser; you should see XML, not an HTML loader page.
- Submit the sitemap index in Google Search Console.