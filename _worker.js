
// ====== Cloudflare Pages Function — BIG UPGRADE for /api + prerender glue ======
// Drop-in replacement for /_worker.js
// - Adds JSON API under /api/* for products and posts (with pagination + search).
// - Ensures /api routes are NEVER prerendered and always served as JSON to users/bots.
// - Keeps static asset serving + SPA fallback for the rest.
// - Preserves existing prerender proxy for bots (Googlebot, etc).

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
};

function json(data, init = {}) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", ...CORS, ...(init.headers || {}) });
  return new Response(JSON.stringify(data), { status: init.status || 200, headers });
}

function notFound(msg = "Not found") { return json({ error: msg }, { status: 404 }); }
function badRequest(msg = "Bad request") { return json({ error: msg }, { status: 400 }); }
function methodNotAllowed() { return json({ error: "Method not allowed" }, { status: 405 }); }

// --- Demo datasets (stable across requests) ---
let PRODUCTS = null;
let POSTS = null;

function seedData() {
  if (PRODUCTS && POSTS) return;
  PRODUCTS = Array.from({ length: 120 }, (_, i) => {
    const id = i + 1;
    return {
      id,
      sku: `SKU-${id.toString().padStart(5, "0")}`,
      name: `Product #${id}`,
      description: `This is the description for Product #${id}. It's fantastic for demos.`,
      price: Math.round((10 + (id % 50) + Math.random() * 100) * 100) / 100,
      created_at: new Date(Date.now() - id * 86400000).toISOString().slice(0, 10),
    };
  });
  POSTS = Array.from({ length: 48 }, (_, i) => {
    const n = i + 1;
    const slug = `post-${n}`;
    return {
      slug,
      title: `Post Title ${n}`,
      excerpt: `A short teaser for post ${n}.`,
      body: `This is the full body of post ${n}. It demonstrates dynamic routes and prerender-friendly content.`,
      published_at: new Date(Date.now() - n * 172800000).toISOString().slice(0, 10),
    };
  });
}

function parseIntQ(v, def) { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : def; }

function handleApi(req, env) {
  seedData();
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/^\/api\/?/, ""); // strip /api/
  if (req.method === "OPTIONS") return json({}, { status: 204 });
  if (req.method !== "GET") return methodNotAllowed();

  // /api/health
  if (pathname === "" || pathname === "/") return json({ ok: true, routes: ["/products", "/products/:id", "/posts", "/posts/:slug"] });
  if (pathname === "health") return json({ ok: true });

  // /api/products and /api/products/:id
  if (pathname === "products") {
    const page = parseIntQ(url.searchParams.get("page"), 1);
    const pageSize = parseIntQ(url.searchParams.get("pageSize"), 12);
    const q = (url.searchParams.get("q") || "").toLowerCase();
    let items = PRODUCTS;
    if (q) items = items.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    const total = items.length;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), lastPage);
    const start = (safePage - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    return json({ items: slice, page: safePage, pageSize, total, lastPage });
  }
  const prodMatch = pathname.match(/^products\/(\d+)$/);
  if (prodMatch) {
    const id = parseInt(prodMatch[1], 10);
    const p = PRODUCTS.find(x => x.id === id);
    return p ? json(p) : notFound("Product not found");
  }

  // /api/posts and /api/posts/:slug
  if (pathname === "posts") {
    const page = parseIntQ(url.searchParams.get("page"), 1);
    const pageSize = parseIntQ(url.searchParams.get("pageSize"), 6);
    const q = (url.searchParams.get("q") || "").toLowerCase();
    let items = POSTS;
    if (q) items = items.filter(p => p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.body.toLowerCase().includes(q));
    const total = items.length;
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), lastPage);
    const start = (safePage - 1) * pageSize;
    const slice = items.slice(start, start + pageSize);
    return json({ items: slice, page: safePage, pageSize, total, lastPage });
  }
  const postMatch = pathname.match(/^posts\/([^\/]+)$/);
  if (postMatch) {
    const slug = postMatch[1];
    const p = POSTS.find(x => x.slug === slug);
    return p ? json(p) : notFound("Post not found");
  }

  return notFound();
}

const BOT_RE = /Googlebot|Bingbot|LinkedInBot|Twitterbot|facebookexternalhit|Slackbot|WhatsApp|DuckDuckBot|YandexBot|Discordbot/i;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";
    const accept = request.headers.get("accept") || "";

    // 1) Built-in JSON API — handle first (no prerender, never proxied)
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    // 2) Static file / SPA fallback for humans (assets are served directly)
    const isAsset = /\.(png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml)$/i.test(url.pathname);
    const isHTMLAccept = accept.includes("text/html");
    const isBot = BOT_RE.test(ua);

    if (!isBot || isAsset) {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404 && request.method === "GET" && isHTMLAccept) {
        // SPA fallback
        return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
      }
      return res;
    }

    // 3) Bots → prerender proxy
    const token = env.PRERENDER_TOKEN;
    const base = (env.PRERENDER_BASE || "https://service.prerender.cloud");
    if (!token) return new Response("Missing PRERENDER_TOKEN", { status: 500 });

    // Some prerender services accept different shapes; we try a few.
    const target = url.origin + url.pathname + url.search;
    const hdrs = { "User-Agent": ua, "X-Prerender-Token": token };
    // Prefer path style
    let upstream = await fetch(`${base}/render/${encodeURIComponent(target)}`, { headers: hdrs });
    if (upstream.status === 404 || upstream.status === 400) upstream = await fetch(`${base}/render?url=${encodeURIComponent(target)}`, { headers: hdrs });
    if (upstream.status === 404 || upstream.status === 400) upstream = await fetch(`${base}/render?uri=${encodeURIComponent(target)}`, { headers: hdrs });

    if (env.PRERENDER_DEBUG === "1") {
      const h = new Headers(upstream.headers);
      h.set("x-debug-prerender-base", base);
      h.set("x-debug-upstream-status", String(upstream.status));
      h.set("x-debug-token-present", env.PRERENDER_TOKEN ? "true" : "false");
      return new Response(upstream.body, { status: upstream.status, headers: h });
    }
    return upstream;
  }
};
