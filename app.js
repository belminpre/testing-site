
// ====== Lovable SPA — BIG UPGRADE (routes, pagination, HTTP requests) ======
// Drop-in replacement for /app.js
// - Adds many more pages (Gallery pagination, Products w/ detail, Blog w/ detail,
//   FAQ, Team, Careers, Docs (nested), Legal pages, 404).
// - Adds client-side pagination (query param: ?page=N)
// - Adds HTTP requests to a built-in API exposed by _worker.js under /api/*
// - Keeps History API routing + SPA fallback compatible with Cloudflare Pages.
//
// NOTE: You don't need to change index.html; the router will render the new content.

const app = document.getElementById("app");

// ---------- tiny DOM helpers ----------
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}

function a(href, text, attrs = {}) {
  return el("a", { href, "data-link": "", ...attrs }, [text]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- utilities ----------
function getPageFromURL(def = 1) {
  const url = new URL(location.href);
  const p = parseInt(url.searchParams.get("page") || def, 10);
  return Number.isFinite(p) && p > 0 ? p : def;
}

function paginate({ total, page, pageSize }) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(Math.max(1, page), lastPage);
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return { page, lastPage, start, end };
}

async function api(path, params = {}) {
  const url = new URL(path, location.origin);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

function loadingCard(title = "Loading…") {
  return el("div", { class: "card" }, [el("h3", {}, [title]), el("p", { class: "muted" }, ["Please wait."])]);
}

function errorCard(e) {
  return el("div", { class: "card error" }, [el("h3", {}, ["Something went wrong"]), el("pre", {}, [String(e?.message || e)])]);
}

function paginationNav(basePath, page, lastPage) {
  const nav = el("nav", { class: "pagination" });
  const prev = a(`${basePath}?page=${Math.max(1, page - 1)}`, "← Prev", { class: page <= 1 ? "disabled" : "" });
  const next = a(`${basePath}?page=${Math.min(lastPage, page + 1)}`, "Next →", { class: page >= lastPage ? "disabled" : "" });
  const label = el("span", { class: "page-label" }, [`Page ${page} / ${lastPage}`]);
  nav.append(prev, label, next);
  return nav;
}

function sectionTitle(text, sub="") {
  const div = el("div", { class: "section-title" });
  div.append(el("h2", {}, [text]));
  if (sub) div.append(el("p", { class: "muted" }, [sub]));
  return div;
}

// ---------- views ----------
async function Home() {
  await sleep(150);
  const wrap = el("section");
  wrap.append(sectionTitle("Welcome", "Explore the new sections below."));

  const links = [
    ["/gallery", "Gallery (paginated)"],
    ["/products", "Products (fetch + detail)"],
    ["/blog", "Blog (fetch + detail)"],
    ["/faq", "FAQ"],
    ["/team", "Team"],
    ["/careers", "Careers"],
    ["/docs", "Docs"],
    ["/legal/terms", "Terms"],
    ["/legal/privacy", "Privacy"],
  ];

  const grid = el("div", { class: "grid" });
  for (const [href, label] of links) {
    grid.append(el("div", { class: "card" }, [el("h3", {}, [a(href, label)])]));
  }
  wrap.append(grid);
  return wrap;
}

async function Gallery() {
  await sleep(120);
  const wrap = el("section");
  const page = getPageFromURL(1);
  const total = 12; // we have 12 PNGs in assets/images
  const pageSize = 9;
  const { start, end, lastPage } = paginate({ total, page, pageSize });

  wrap.append(sectionTitle("Gallery", "Image grid with pagination"));
  const grid = el("div", { class: "grid" });
  for (let i = start + 1; i <= end; i++) {
    grid.append(
      el("div", { class: "card" }, [
        el("img", { src: `/assets/images/gallery_${String(i).padStart(2, "0")}.png`, alt: `Gallery ${i}` }),
        el("p", { class: "small" }, [`Gallery item #${i}`]),
      ])
    );
  }
  wrap.append(grid, paginationNav("/gallery", page, lastPage));
  return wrap;
}

async function ProductsIndex() {
  const wrap = el("section");
  wrap.append(sectionTitle("Products", "Data loaded from /api/products"));

  const page = getPageFromURL(1);
  const pageSize = 12;
  wrap.append(loadingCard("Fetching products…"));

  try {
    const data = await api("/api/products", { page, pageSize });
    wrap.innerHTML = "";
    const grid = el("div", { class: "grid" });
    for (const p of data.items) {
      const imgNum = (p.id % 6) || 6; // map to 1..6
      grid.append(
        el("div", { class: "card" }, [
          el("img", { src: `/assets/images/product_${String(imgNum).padStart(2, "0")}.png`, alt: p.name }),
          el("h3", {}, [a(`/products/${p.id}`, p.name)]),
          el("p", {}, [p.description]),
          el("p", { class: "small muted" }, [`$${p.price.toFixed(2)}`]),
        ])
      );
    }
    wrap.append(grid, paginationNav("/products", data.page, data.lastPage));
  } catch (e) {
    wrap.append(errorCard(e));
  }
  return wrap;
}

async function ProductDetail(_, params) {
  const [id] = params; // first capture group
  const wrap = el("section");
  wrap.append(sectionTitle("Product", `ID: ${id}`));
  wrap.append(loadingCard("Loading product…"));
  try {
    const p = await api(`/api/products/${id}`);
    wrap.innerHTML = "";
    const imgNum = (p.id % 6) || 6;
    wrap.append(
      el("div", { class: "card" }, [
        el("img", { src: `/assets/images/product_${String(imgNum).padStart(2, "0")}.png`, alt: p.name }),
        el("h3", {}, [p.name]),
        el("p", {}, [p.description]),
        el("p", { class: "small muted" }, [`$${p.price.toFixed(2)}`]),
        el("p", {}, [a("/products", "← Back to products")]),
      ])
    );
  } catch (e) {
    wrap.append(errorCard(e));
  }
  return wrap;
}

async function BlogIndex() {
  const wrap = el("section");
  wrap.append(sectionTitle("Blog", "Data loaded from /api/posts"));

  const page = getPageFromURL(1);
  const pageSize = 6;
  wrap.append(loadingCard("Fetching posts…"));
  try {
    const data = await api("/api/posts", { page, pageSize });
    wrap.innerHTML = "";
    for (const post of data.items) {
      wrap.append(
        el("article", { class: "card" }, [
          el("h3", {}, [a(`/blog/${post.slug}`, post.title)]),
          el("p", { class: "muted" }, [post.excerpt]),
          el("p", { class: "small muted" }, [`Published: ${post.published_at}`]),
        ])
      );
    }
    wrap.append(paginationNav("/blog", data.page, data.lastPage));
  } catch (e) {
    wrap.append(errorCard(e));
  }
  return wrap;
}

async function BlogDetail(_, params) {
  const [slug] = params;
  const wrap = el("section");
  wrap.append(sectionTitle("Post", slug));
  wrap.append(loadingCard("Loading post…"));
  try {
    const p = await api(`/api/posts/${slug}`);
    wrap.innerHTML = "";
    wrap.append(
      el("article", { class: "card" }, [
        el("h3", {}, [p.title]),
        el("p", { class: "small muted" }, [`Published: ${p.published_at}`]),
        el("div", {}, [p.body]),
        el("p", {}, [a("/blog", "← Back to blog")]),
      ])
    );
  } catch (e) {
    wrap.append(errorCard(e));
  }
  return wrap;
}

// Simple static pages
function StaticPage(title, bodyNodes) {
  return async function () {
    await sleep(50);
    const wrap = el("section");
    wrap.append(sectionTitle(title));
    wrap.append(el("div", { class: "stack" }, [].concat(bodyNodes)));
    return wrap;
  };
}

const FAQ = StaticPage("FAQ", [
  el("div", { class: "card" }, [el("h3", {}, ["How does prerendering work?"]), el("p", {}, ["Bots get HTML from an upstream service, users get the SPA."]) ]),
  el("div", { class: "card" }, [el("h3", {}, ["Can I fetch data?"]), el("p", {}, ["Yes — this app uses /api endpoints served by the Cloudflare Pages Function."]) ]),
]);

const Team = StaticPage("Team", [
  el("div", { class: "card" }, [el("h3", {}, ["Ada Lovelace"]), el("p", {}, ["Engineering"]) ]),
  el("div", { class: "card" }, [el("h3", {}, ["Alan Turing"]), el("p", {}, ["Research"]) ]),
  el("div", { class: "card" }, [el("h3", {}, ["Grace Hopper"]), el("p", {}, ["Product"]) ]),
]);

const Careers = StaticPage("Careers", [
  el("div", { class: "card" }, [el("h3", {}, ["Frontend Engineer"]), el("p", {}, ["Build delightful SPAs."]) ]),
  el("div", { class: "card" }, [el("h3", {}, ["Edge Developer"]), el("p", {}, ["Shape modern edge infrastructure."]) ]),
]);

const DocsIndex = StaticPage("Docs", [
  el("div", { class: "card" }, [el("h3", {}, [a("/docs/getting-started", "Getting Started")]) ]),
  el("div", { class: "card" }, [el("h3", {}, [a("/docs/routing", "Routing")]) ]),
  el("div", { class: "card" }, [el("h3", {}, [a("/docs/api", "API")]) ]),
]);

const DocsGettingStarted = StaticPage("Docs — Getting Started", [
  el("div", { class: "card" }, [el("p", {}, ["Install, deploy, profit."]) ]),
]);

const DocsRouting = StaticPage("Docs — Routing", [
  el("div", { class: "card" }, [el("p", {}, ["This SPA uses the History API and a tiny regex router."]) ]),
]);

const DocsAPI = StaticPage("Docs — API", [
  el("div", { class: "card" }, [el("p", {}, ["The Cloudflare Pages Function exposes /api routes with JSON."]) ]),
]);

const Terms = StaticPage("Terms", [el("div", { class: "card" }, [el("p", {}, ["Use at your own risk."]) ])]);
const Privacy = StaticPage("Privacy", [el("div", { class: "card" }, [el("p", {}, ["No personal data is stored in this demo."]) ])]);

async function NotFound() {
  return StaticPage("404", [el("div", { class: "card" }, [el("p", {}, ["That page could not be found."]) ])])();
}

// ---------- router ----------
const routes = [
  [/^\/$/, Home],
  [/^\/gallery\/?$/, Gallery],
  [/^\/products\/?$/, ProductsIndex],
  [/^\/products\/(\d+)\/?$/, ProductDetail],
  [/^\/blog\/?$/, BlogIndex],
  [/^\/blog\/([^\/]+)\/?$/, BlogDetail],
  [/^\/faq\/?$/, FAQ],
  [/^\/team\/?$/, Team],
  [/^\/careers\/?$/, Careers],
  [/^\/docs\/?$/, DocsIndex],
  [/^\/docs\/getting-started\/?$/, DocsGettingStarted],
  [/^\/docs\/routing\/?$/, DocsRouting],
  [/^\/docs\/api\/?$/, DocsAPI],
  [/^\/legal\/terms\/?$/, Terms],
  [/^\/legal\/privacy\/?$/, Privacy],
];

async function render(pathname) {
  const url = new URL(location.href);
  document.title = "Lovable Demo — Cloudflare Pages + Prerender";
  app.innerHTML = "";
  const route = routes.find(([re]) => re.test(pathname));
  const match = route ? pathname.match(route[0]) : null;
  const view = route ? route[1] : NotFound;
  try {
    const node = await view(pathname, match ? match.slice(1) : []);
    app.innerHTML = "";
    app.append(node);
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch (e) {
    app.innerHTML = "";
    app.append(errorCard(e));
  }
}

function onLinkClick(e) {
  const aEl = e.target.closest("a[data-link]");
  if (!aEl) return;
  const url = new URL(aEl.href, location.origin);
  // External link? Let the browser handle it.
  if (url.origin !== location.origin) return;
  e.preventDefault();
  history.pushState({}, "", url.pathname + url.search);
  render(url.pathname);
}

window.addEventListener("popstate", () => render(location.pathname));
window.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("click", onLinkClick);
  render(location.pathname);
});

// Optional: add minimal styles for pagination if not already present
(function ensurePaginationStyles(){
  if (document.getElementById("pagination-styles")) return;
  const css = `
    .pagination { display:flex; align-items:center; gap:.5rem; justify-content:center; margin: 1.5rem 0; }
    .pagination a { padding:.4rem .7rem; border:1px solid var(--border, #333); border-radius:.5rem; text-decoration:none; }
    .pagination a.disabled { pointer-events:none; opacity:.5; }
    .pagination .page-label { opacity:.7; }
    .muted { opacity:.75; }
    .stack > * + * { margin-top:.75rem; }
  `;
  const style = document.createElement("style");
  style.id = "pagination-styles";
  style.textContent = css;
  document.head.appendChild(style);
})();
