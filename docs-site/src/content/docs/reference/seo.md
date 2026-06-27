---
title: SEO
description: renderHead, sitemap, robots, JSON-LD — head per cell, sitemap/robots tự sinh.
sidebar:
  order: 15
---

## Định nghĩa

SEO / head management trong fluxe là **builder thuần** (string-in/string-out → testable). Mỗi cell
khai báo `head(data)` từ data của loader → framework bơm vào `<head>` lúc SSR. Sitemap và robots
**tự sinh** từ route table (danh sách cell), không phải viết tay.

Các builder `renderHead`/`renderSitemap`/`renderRobots` là **thuần** (string-in/string-out) → dễ test,
dễ tái dùng. Framework lo phần HTTP: gọi `head(data)` của cell rồi nhúng vào `<head>` khi SSR, và
phục vụ sẵn `/sitemap.xml` + `/robots.txt`.

## Cơ chế trong fluxe

- **`renderHead(meta)`** sinh chuỗi `<title>/<meta>/<link>/JSON-LD` đã escape từ object `HeadMeta`
  (`title`/`description`/`canonical`/`og`/`jsonLd`). Framework gọi `cell.head(data)` để lấy `meta` rồi
  chèn kết quả vào `<head>` lúc SSR.
- **`renderSitemap(routes, baseUrl)`** sinh `<urlset>` từ danh sách route; **`renderRobots(baseUrl)`**
  sinh nội dung `robots.txt` (có dòng `Sitemap:`). Framework tự phục vụ endpoint `/sitemap.xml` +
  `/robots.txt`, lọc chỉ route tĩnh (bỏ `[param]`) trước khi truyền vào `renderSitemap`.

## Ví dụ

Cell `home` khai báo `head(data)` đầy đủ (title/description/canonical/og/jsonLd):

```ts
// app/cells/home/index.tsx
head: (data) => ({
  title: data.title,
  description: "Khung fullstack tối giản: SSR + island + backend data linh hoạt.",
  canonical: "/",
  og: { title: data.title, type: "website" },
  jsonLd: { "@context": "https://schema.org", "@type": "WebSite", name: "fluxe" },
}),
```

→ `renderHead` sinh ra (đã escape):

```html
<title>fluxe — fullstack tối giản</title>
<meta name="description" content="Khung fullstack tối giản: SSR + island + backend data linh hoạt.">
<link rel="canonical" href="/">
<meta property="og:title" content="fluxe — fullstack tối giản">
<meta property="og:type" content="website">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"fluxe"}</script>
```

## API

```ts
// @nmvuong92/fluxe
interface HeadMeta { title?; description?; canonical?; og?: Record<string,string>; jsonLd?: unknown }
renderHead(meta: HeadMeta): string                          // <title>/<meta>/<link>/JSON-LD (escaped)
renderSitemap(routes: string[], baseUrl: string): string    // <urlset> chỉ route tĩnh
renderRobots(baseUrl: string): string                       // User-agent + Sitemap line
```

## Lưu ý

- Mọi giá trị qua `esc()` → escape `& < > "` (chống injection vào head). `jsonLd` serialize bằng
  `JSON.stringify` rồi nhúng `<script type="application/ld+json">`.
- Không có `title` → mặc định `"fluxe"`.
- Sitemap chỉ chứa **route tĩnh**: server lọc `c.route.includes("[")` (bỏ `[param]`) trước khi truyền
  vào `renderSitemap`. Route động không tự liệt kê được.
- `baseUrl` suy từ `req.headers.host` → reverse-proxy đổi host sẽ đổi base; cân nhắc fix cứng nếu
  cần canonical tuyệt đối.
