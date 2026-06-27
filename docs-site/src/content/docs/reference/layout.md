---
title: Layout
description: Layout bọc mọi trang, layout lồng nhau (layoutChain).
sidebar:
  order: 50
---

## Định nghĩa

**Layout** là component bọc quanh view của cell (header/footer/nav/DebugBar…). Một cell khai báo
`layout: "<id>"`; framework bọc view bằng layout đó. Layout có thể **lồng nhau** qua trường
`parent` — fluxe giải "chuỗi layout" từ cell lên root rồi bọc dần từ trong ra ngoài.

Hàm `layoutChain` (export từ package) là **thuần, testable** (không DOM/React): bạn đưa id layout của
cell + bảng layouts, nó trả mảng id theo thứ tự **inner→outer**. Framework dùng mảng này để bọc view
bằng từng component layout, từ trong ra ngoài.

## Cơ chế trong fluxe

`layoutChain(layoutId, layouts)` đi từ layout của cell theo trường `parent` lên tới root, trả mảng
`[inner, …, outer]`. Nó **chống vòng lặp** (`parent` trỏ lại chính nó → ném Error) và **layout không
tồn tại** (`parent` trỏ id không có trong `layouts` → ném Error), nên sai cấu hình bị bắt sớm thay vì
render hỏng. Framework duyệt mảng này và bọc view bằng từng component layout theo thứ tự inner→outer,
nên layout `parent` xa nhất bọc ngoài cùng.

## Ví dụ

`app/layouts/index.ts` định nghĩa 2 layout lồng nhau: `site` (ngoài cùng, mount `DebugBar`) và
`app` (`parent: "site"`). Cell khai báo `layout: "app"` → render `site(app(cell))`:

```tsx
// app/layouts/index.ts
import { createElement as h, Fragment, type ReactNode } from "react";
import type { LayoutMeta } from "@nmvuong92/fluxe";
import { DebugBar } from "@nmvuong92/fluxe/react";

interface LayoutEntry extends LayoutMeta {
  component: (props: { children: ReactNode }) => ReactNode;
}

// site (ngoài cùng) ← app (trong). Áp app → render site(app(cell)). DebugBar mount ở site.
export const layouts: Record<string, LayoutEntry> = {
  site: {
    id: "site",
    component: ({ children }) =>
      h(Fragment, null,
        h("div", { className: "site" },
          h("header", { className: "site-header" }, "fluxe site"),
          children),
        h(DebugBar as any, null)),
  },
  app: {
    id: "app",
    parent: "site",
    component: ({ children }) =>
      h("div", { className: "app" },
        h("nav", { className: "app-nav" }, "app nav"),
        children),
  },
};
```

Với cell có `layout: "app"`, `layoutChain("app", layouts)` trả `["app", "site"]` → vòng lặp bọc
`app` trước rồi `site` ngoài cùng → kết quả `site(app(view))`.

## API

```ts
// @nmvuong92/fluxe
interface LayoutMeta { id: string; parent?: string }
layoutChain(layoutId: string | undefined, layouts: Record<string, LayoutMeta>): string[]
// trả [inner, …, outer]; ném Error nếu vòng lặp hoặc layout không tồn tại
```

## Lưu ý

- Chuỗi trả về thứ tự **inner→outer**; vòng `for` bọc theo đúng thứ tự đó nên layout cuối cùng
  (`parent` xa nhất) bọc **ngoài cùng**. Mount thứ duy nhất 1 lần (vd `DebugBar`) ở layout root.
- `layoutChain(undefined, …)` trả mảng rỗng → view không bọc layout nào (cell không khai báo
  `layout`).
- `layoutChain` ném lỗi khi `parent` trỏ vòng lặp hoặc tới id không có trong `layouts` → bắt sớm
  sai cấu hình thay vì render hỏng.
