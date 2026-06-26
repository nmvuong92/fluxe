import { test } from "node:test";
import assert from "node:assert/strict";
import { renderHead, renderSitemap, renderRobots } from "./seo.ts";

test("renderHead: title mặc định khi rỗng", () => {
  assert.match(renderHead({}), /<title>fluxe<\/title>/);
});

test("renderHead: title + description + canonical + og + jsonLd", () => {
  const h = renderHead({
    title: "Trang chủ",
    description: "Mô tả",
    canonical: "https://x.com/",
    og: { title: "OG", image: "https://x.com/i.png" },
    jsonLd: { "@type": "WebSite" },
  });
  assert.match(h, /<title>Trang chủ<\/title>/);
  assert.match(h, /<meta name="description" content="Mô tả">/);
  assert.match(h, /<link rel="canonical" href="https:\/\/x\.com\/">/);
  assert.match(h, /<meta property="og:title" content="OG">/);
  assert.match(h, /<meta property="og:image" content="https:\/\/x\.com\/i\.png">/);
  assert.match(h, /<script type="application\/ld\+json">\{"@type":"WebSite"\}<\/script>/);
});

test("renderHead: escape HTML trong title", () => {
  assert.match(renderHead({ title: '<b>"x"' }), /<title>&lt;b&gt;&quot;x&quot;<\/title>/);
});

test("renderSitemap: liệt kê route với baseUrl", () => {
  const xml = renderSitemap(["/", "/todos"], "http://x");
  assert.match(xml, /^<\?xml/);
  assert.match(xml, /<loc>http:\/\/x\/<\/loc>/);
  assert.match(xml, /<loc>http:\/\/x\/todos<\/loc>/);
});

test("renderRobots: trỏ sitemap", () => {
  assert.match(renderRobots("http://x"), /Sitemap: http:\/\/x\/sitemap\.xml/);
});
