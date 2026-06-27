---
title: Navigation
description: Link, SPA nav, scroll restoration, preserveScroll, navigate/prefetch, Nav active.
sidebar:
  order: 41
---

## Định nghĩa

**Resolved Navigation** là cách fluxe điều hướng giữa các trang: `<Link>` render `<a href>` thật
(SSR + JS-tắt vẫn chạy — progressive enhancement). Khi có JS: **hover → prefetch props**,
**click trái nội bộ → SPA swap** (đổi cell + `pushState`, không full reload). Back/forward
(`popstate`) cũng SPA.

Khác Inertia ở chỗ: backend và React **cùng process** — không có hop PHP→Node. SSR + island render
trong cùng runtime, nên prefetch props chỉ là một fetch JSON nội bộ. Trang static (0 React JS) khi
tải trực tiếp **không ship SPA runtime**.

| | Inertia | fluxe `<Link>` |
|---|---|---|
| backend ↔ React render | PHP → hop → Node (SSR) | cùng process, **0 hop** |
| nav island | 1 XHR | 1 XHR + **prefetch on hover** |
| static page | luôn ship SPA runtime | **0 JS** khi tải trực tiếp |

```ts
import { Link, Nav } from "@nmvuong92/fluxe/react";
```

## Cơ chế trong fluxe

- **`<Link>`** render `<a href>` thật. Khi có JS: `onMouseEnter` → prefetch props; `onClick` chỉ bị
  chặn (preventDefault + SPA swap) khi đủ điều kiện "nội bộ" — chuột trái, không phím bổ trợ
  (Cmd/Ctrl/Shift/Alt), cùng origin, không `target="_blank"`/`download`. Ngoài các điều kiện đó →
  để trình duyệt nav bình thường.
- **Prefetch cache** giữ props theo URL + **dedup in-flight** (hover nạp trước, click sau cảm giác
  tức thì): nhiều hover cùng URL chia sẻ một promise, kết quả cache lại cho click.
- **SPA swap** (`navigate`/`prefetch`) tải props của trang đích bằng một fetch JSON nội bộ rồi đổi
  cell + `pushState`. Nếu URL không phải cell hợp lệ (file tĩnh, lỗi tải) → fallback hard nav
  (`location.href`). Back/forward (`popstate`) cũng đi qua đường SPA.
- **Scroll restoration**: scroll lưu vào mỗi history entry; nav mới → cuộn lên đầu, Back/Forward →
  khôi phục đúng `scrollY`. `preserveScroll` giữ nguyên vị trí (lọc/phân trang tại chỗ).
- **`<Nav>`** render danh sách `<Link>`; trạng thái active được đặt bởi `shellScript` vanilla (xem
  [Theme](/reference/theme/)) nên chạy cả trên trang static 0 React JS.

## Ví dụ

`<Link>` trong cell `todos` (SPA nav về trang chủ):

```tsx
// app/cells/todos/view.tsx
h(Link, { href: "/", className: "muted" }, "← về trang chủ (SPA nav)")
```

`preserveScroll` (lọc/phân trang tại chỗ, không nhảy lên đầu) + API programmatic:

```tsx
<Link href="/products?page=2" preserveScroll>Trang sau</Link>
```

```ts
import { navigate, prefetch } from "@nmvuong92/fluxe/react";
navigate("/products?page=2", { preserveScroll: true });
prefetch("/checkout");   // nạp trước
// hoặc qua window: window.fluxe.navigate("/checkout")
```

:::caution[Trung thực]
SPA swap chỉ giữa cell có trong client bundle; mutation vẫn `rpc()` POST (roundtrip vật lý —
optimistic update che latency). "0 roundtrip" chỉ đúng cho **backend↔React nội bộ** (cùng process),
không phải browser↔server.
:::

## API

```ts
// @nmvuong92/fluxe/react
<Link href prefetch? preserveScroll? className? target? download?/>

navigate(href, opts?): Promise<void>                  // SPA swap; non-cell/lỗi → hard nav
prefetch(href): void                                  // nạp trước props cùng origin

<Nav items={NavItem[]} className?/>                   // NavItem = { label; href }
```

## Lưu ý

- Runtime nav **không** import cells/router → giữ client bundle sạch server code; "nội bộ?" =
  cùng origin **và** server trả về cell hợp lệ. Non-cell (file tĩnh) → `location.href` (hard nav).
- Active link do `shellScript` vanilla set theo path (`fluxe:nav` + `popstate`), chạy cả trên trang
  **static 0 React JS** — xem [Theme](/reference/theme/).
- Prefetch chỉ cho link **cùng origin**; `prefetch={false}` trên `<Link>` để tắt hover-prefetch.
