/* SEO / head management — builder thuần (testable). Cell khai báo head(data) →
 * framework bơm vào <head>; sitemap/robots tự sinh từ route table. */

export interface HeadMeta {
  title?: string;
  description?: string;
  canonical?: string;
  og?: Record<string, string>;   // open graph: title/description/image/type/url…
  jsonLd?: unknown;              // structured data (JSON-LD)
}

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderHead(meta: HeadMeta): string {
  const tags: string[] = [`<title>${esc(meta.title ?? "fluxe")}</title>`];
  if (meta.description) tags.push(`<meta name="description" content="${esc(meta.description)}">`);
  if (meta.canonical) tags.push(`<link rel="canonical" href="${esc(meta.canonical)}">`);
  for (const [k, v] of Object.entries(meta.og ?? {})) {
    tags.push(`<meta property="og:${esc(k)}" content="${esc(v)}">`);
  }
  if (meta.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`);
  return tags.join("");
}

// Chỉ route tĩnh (bỏ [param] và route nội bộ) — caller lọc trước hoặc truyền sẵn.
export function renderSitemap(routes: string[], baseUrl: string): string {
  const urls = routes.map((r) => `  <url><loc>${esc(baseUrl + r)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots(baseUrl: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`;
}
