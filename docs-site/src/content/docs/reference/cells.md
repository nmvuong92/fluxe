---
title: Cell — authoring
description: defineCell, loader/view/actions, hydration, layout, guards, head.
sidebar:
  order: 1
---

Một **Cell** là đơn vị trang: khai báo `loader` (lấy data) + `view` (render) + `actions`
(mutation). Engine giải mọi thứ còn lại.

## defineCell

```ts
import { defineCell } from "@nmvuong92/fluxe";

export interface CellDef<I, O> {
  id: string;
  route: string;                          // "/" | "/todos" | "/hello/[name]"
  hydration?: "static" | "island";        // MẶC ĐỊNH "island". "static" = opt-in 0 JS (xem guide riêng)
  loader: (ctx: Ctx<I>) => Promise<O>;    // chạy server, trả props cho view
  view: ComponentType<{ data: O }>;       // React component
  actions?: Record<string, Action>;       // RPC: POST /__action/<cell>/<name>
  head?: (data: O) => HeadMeta;           // SEO per cell — xem /reference/seo/
  layout?: string;                        // id layout bọc view (nested)
  requireAuth?: boolean;                  // guard: cần session
  requireRole?: string;                   // guard RBAC: cần role
}
```

`Ctx` được engine inject — cell **không** tự tạo backend/session:

```ts
interface Ctx<I> {
  input: I;                  // route params (loader) hoặc body đã validate (action)
  backend: Backend;          // ← inject, cell không biết memory/sqlite/postgres
  session?: Session | null;  // ← đã verify HMAC
}
```

## Ví dụ đầy đủ

```ts
export default defineCell<{ name: string }, HelloData>({
  id: "hello",
  route: "/hello/[name]",        // [name] → ctx.input.name
  async loader({ input, backend }) {   // hydration mặc định "island"
    return { name: input.name, backendName: backend.name };
  },
  head: (data) => ({ title: `Xin chào ${data.name}` }),
  view: ({ data }) => <h1>Xin chào, {data.name}!</h1>,
});
```

## Actions (mutation + validation)

`actions` là RPC server. Bọc bằng `withInput(schema, handler)` để runtime tự validate
(Zod) trước khi gọi — input sai trả `FluxeError 400` field-level.

```ts
import { withInput } from "@nmvuong92/fluxe";
import { z } from "zod";

actions: {
  list: async ({ backend }) => backend.listTodos(),
  add: withInput(
    z.object({ title: z.string().min(1, "Tiêu đề không được rỗng").max(200) }),
    async ({ input, backend }) => backend.addTodo(input.title),
  ),
  toggle: withInput(
    z.object({ id: z.string().min(1) }),
    async ({ input, backend }) => backend.toggleTodo(input.id),
  ),
}
```

## Layout lồng nhau

`layout: "site"` bọc view bằng layout đó; layout có `parent` → engine lồng inner→outer
(`layoutChain`, duyệt DFS chuỗi). Khai báo trong `app/layouts/`.

## Guards

| Field | Hiệu lực |
|-------|----------|
| `requireAuth: true` | chưa có session → `401` (redirect `/login`) |
| `requireRole: "admin"` | thiếu role → `403` (ngầm cần auth) |

→ Cơ chế session/role: xem [Session](/reference/session/) và [RBAC](/reference/rbac/).

## Routing

`makeRouter(cells)` so khớp `pathname` → cell + params. Hỗ trợ segment động `[name]`.
SEO sitemap chỉ lấy route tĩnh (bỏ `[param]`).
