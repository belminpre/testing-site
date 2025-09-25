// Cloudflare Pages _worker.js
// - Serves any /sitemap*.xml and /robots.txt as static with correct headers
// - Dynamically generates /sitemap_index.xml by probing existing sitemap_smallN.xml files
//   so you don't need to hand-maintain the index.

const SMALL_MIN = 1;
const SMALL_MAX = 300; // adjust if you have more

function xmlResponse(body, status=200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function textResponse(body, status=200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, origin } = url;

    // 0) Dynamic sitemap index
    if (pathname === "/sitemap_index.xml") {
      // Also include any explicit static sitemaps at root (sitemap1.xml, sitemap2.xml, etc.)
      const candidates = [];
      // Known root sitemaps (optional)
      const roots = ["sitemap1.xml", "sitemap2.xml", "sitemap3.xml"];
      for (const name of roots) {
        const res = await env.ASSETS.fetch(new Request(new URL("/" + name, origin), request));
        if (res && res.status === 200) {
          candidates.push("/" + name);
        }
      }
      // Probe small range
      for (let i = SMALL_MIN; i <= SMALL_MAX; i++) {
        const name = `/sitemap_small${i}.xml`;
        const res = await env.ASSETS.fetch(new Request(new URL(name, origin), request));
        if (res && res.status === 200) {
          candidates.push(name);
        }
      }
      const lastmod = new Date().toISOString().slice(0, 10);
      const items = candidates.map(p => {
        const loc = `${origin}${p}`;
        return `  <sitemap>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`;
      }).join("\n");

      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
      return xmlResponse(body);
    }

    // 1) Bypass for sitemaps and robots.txt so they are served as static files with correct headers
    if (/^\/(sitemap.*\.xml|robots\.txt)$/i.test(pathname)) {
      const assetRes = await env.ASSETS.fetch(request);
      if (!assetRes) return new Response("Not found", { status: 404 });

      // Copy body and fix headers
      const headers = new Headers(assetRes.headers);
      if (pathname.endsWith(".xml")) {
        headers.set("Content-Type", "application/xml; charset=utf-8");
      } else if (pathname.endsWith(".txt")) {
        headers.set("Content-Type", "text/plain; charset=utf-8");
      }
      headers.set("X-Content-Type-Options", "nosniff");

      return new Response(assetRes.body, {
        status: assetRes.status,
        statusText: assetRes.statusText,
        headers,
      });
    }

    // 2) Default serve static asset (if present)
    const res = await env.ASSETS.fetch(request);
    if (res && res.status !== 404) return res;

    // Optional SPA fallback to index.html
    return env.ASSETS.fetch(new Request(new URL("/", url).toString(), request));
  },
};