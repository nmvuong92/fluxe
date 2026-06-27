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
  session?: Session | null;  // ← do HOST gắn (req.session); fluxe đọc, không verify
}
```

## Typed routes — `ctx.input` SUY TỪ route (0 khai báo)

`[param]` trong `route` tự thành `ctx.input.<param>: string` (template-literal type), `O` suy từ
loader. Không còn `defineCell<{name}, Data>` tay. Để `ctx.backend` có kiểu, bind backend **một lần**
qua `createCells<Backend>()` (kiểu tRPC):

```ts
// app/cell.ts (tạo 1 lần — fx init sinh sẵn)
import { createCells } from "@nmvuong92/fluxe";
import type { Backend } from "./backend/data";
export const defineCell = createCells<Backend>();
```

```ts
// app/cells/hello/index.tsx
import { defineCell } from "../../cell";
import { Hello } from "./view";

export default defineCell({
  id: "hello",
  route: "/hello/[name]",              // → ctx.input.name: string (tự suy)
  async loader({ input, backend }) {   // input.name có kiểu; backend có kiểu (từ factory); O suy từ return
    return { name: input.name, backendName: backend.name };
  },
  head: (data) => ({ title: `Xin chào ${data.name}` }),
  view: Hello,
});
```

Nhiều param: `route: "/u/[id]/post/[slug]"` → `input.id` + `input.slug` đều `string`. Param sai tên =
**lỗi compile ngay tại dòng** (không chờ runtime).

> Không cần backend typed? `import { defineCell } from "@nmvuong92/fluxe"` (route + O vẫn suy,
> `ctx.backend` = `any`).

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
| `requireAuth: true` | không có session → `401` |
| `requireRole: "admin"` | thiếu role → `403` (ngầm cần auth) |

Guard chỉ **đọc** `ctx.session` do **host** gắn (`req.session`) — fluxe không tự verify/cấp
session. Việc đăng nhập, ký/giải session, RBAC store… do host + middleware lo (mount TRƯỚC fluxe).

## Routing

`makeRouter(cells)` so khớp `pathname` → cell + params. Hỗ trợ segment động `[name]`.
SEO sitemap chỉ lấy route tĩnh (bỏ `[param]`).
