---
title: Contract DSL
description: Khai báo operations (queries/mutations) + types ở app/contract.ts → fx gen tự sinh types + Zod + client api + server Resolvers. DB ẩn sau resolver.
sidebar:
  order: 4
---

Contract là **nguồn sự thật của giao tiếp cell↔backend** — khai báo **nghiệp vụ** (queries +
mutations) một nơi, `fx gen` **tự sinh** types + validator + client + interface resolver. DB/sqlite/
pg **ẩn trong resolver** bạn viết; contract không biết — DB chỉ là một chi tiết nhỏ.

## `app/contract.ts` — khai báo

```ts
import { defineContract } from "@nmvuong92/fluxe";

export const contract = defineContract({
  types:     { Todo: { id: "string", title: "string", done: "bool" } },
  queries:   { todos: { out: "Todo[]" } },                          // đọc
  mutations: { addTodo: { in: { title: "string" }, out: "Todo" },   // ghi (nghiệp vụ bất kỳ)
               toggleTodo: { in: { id: "string" }, out: "Todo[]" } },
});
```

Type-expr là string: scalar (`"string" | "int" | "bool"`), ref type (`"Todo"`), mảng (`"Todo[]"`),
optional (`"string?"`). Không cần parser/DSL text — type-safe ngay khi viết.

## `fx gen` tự sinh (`.fluxe/gen/`)

| File | Nội dung |
|------|----------|
| `types.ts` | interface cho mỗi `type` + `<Op>Input` |
| `validators.ts` | Zod cho `in` mỗi op + `validators` map (wire thẳng) |
| `server.ts` | `interface Resolvers` (backend implement) + `OPS` (kind) + `createApi` |
| `client.ts` | `api` có kiểu: `api.todos()`, `api.addTodo({title})` → `/__rpc` |

**Không gõ `fx gen` tay** — chạy tự động trong `fx sync` (mọi `fx dev`/`fx build`), watch khi `fx dev`,
và npm `prepare` (editor có type ngay sau `npm install`). Giống `svelte-kit sync`/`astro sync`.

## Implement resolver (DB ẩn ở đây)

```ts
// app/backend/index.ts
import type { Resolvers } from "../../.fluxe/gen/server";
import { db } from "./data";   // node:sqlite / pg / ORM của bạn — contract không biết

export const resolvers: Resolvers = {
  todos: () => db.listTodos(),
  addTodo: ({ title }) => db.addTodo(title),
  toggleTodo: ({ id }) => db.toggleTodo(id),
};
```

Tiêm vào engine (dùng chung server framework đã chọn):

```ts
import { validators } from "../../.fluxe/gen/validators";
import { contract } from "../contract";
import { resolvers } from "./index";

app.use(fluxe(manifest, cells, layouts, { resolvers, contract, validators }));
// hoặc makeServer(manifest, cells, layouts, { resolvers, contract, validators })
```

## Gọi `api` — server 0 hop, client 1 hop, cùng kiểu

```ts
// cell loader (server) — gọi resolvers in-process, 0 hop:
import { resolvers as api } from "../../backend";
loader: async () => ({ todos: await api.todos() })

// view / island (client) — qua /__rpc, có kiểu y hệt:
import { api } from "../../../.fluxe/gen/client";
const add = useMutation("addTodo", (t: string) => api.addTodo({ title: t }));
```

## Runtime `/__rpc/<op>`

`POST /__rpc/<op>` → tra op trong contract (lạ → 404) → validate input bằng Zod sinh ra (sai → 400
field-level) → **mutation kiểm CSRF** (double-submit), **query bỏ qua** (đọc thuần) → gọi
`resolvers[op](input)` → JSON. Lỗi domain `FluxeError` → status/code; unexpected → 500 + errorId.

## Lưu ý

- **Network hop:** SSR loader gọi resolvers **in-process (0 hop)** → mở trang = 0 API call. Lời gọi
  từ client (sau hydrate) là **1 hop** (browser→server, mọi framework đều vậy) — giảm tác động bằng
  SSR + optimistic update + SSE push. Contract không thêm hop, chỉ làm nó type-safe + validate.
- **Lớp THÊM:** `actions`/`rpc()` cũ vẫn chạy nguyên — contract không thay thế, chỉ bổ sung.
- **v1 chưa có:** subscriptions (đã có SSE riêng) · field-selection kiểu GraphQL · batch nhiều op/1 hop.
