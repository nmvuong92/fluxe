---
title: Contract DSL
description: Khai báo operations (queries/mutations) bằng builder Zod ở app/contract.ts — type suy ra tức thì (0 codegen), client là Proxy typed. DB ẩn sau resolver.
sidebar:
  order: 4
---

Contract là **nguồn sự thật của giao tiếp cell↔backend** — khai báo **nghiệp vụ** (queries +
mutations) bằng builder, **type suy ra tức thì** (không chờ codegen), client là Proxy có kiểu.
DB/sqlite/pg **ẩn trong resolver** bạn viết — contract không biết. tRPC-style: **không file sinh ra**.

## `app/contract.ts` — builder Zod

```ts
import { f, type Infer } from "@nmvuong92/fluxe";

const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
export type Todo = Infer<typeof Todo>;   // { id: string; title: string; done: boolean } — tức thì

export const contract = f.contract({
  todos: f.query(Todo.array()),                          // đọc
  addTodo: f.mutation({ title: f.string }, Todo),        // ghi (nghiệp vụ bất kỳ)
  toggleTodo: f.mutation({ id: f.string }, Todo.array()),
});

export type AppContract = typeof contract;   // client import type-only → 0 schema xuống browser
```

`f` là lớp mỏng trên **Zod**: `f.string/int/bool/number/null`, `f.object`, `f.union`. Composition dùng
method Zod: `Todo.array()`, `f.string.optional()`, `f.string.nullable()`. Ref type không tồn tại =
**lỗi compile ngay tại dòng**; error là TS gốc, đọc được.

## Resolver — implement contract (DB ẩn)

Kiểu **suy từ contract** (`Resolvers<typeof contract>`) — sai chữ ký = compile error ngay, không gen.

```ts
// app/backend/index.ts
import type { Resolvers } from "@nmvuong92/fluxe";
import { contract } from "../contract";
import { db } from "./data";   // node:sqlite / pg / ORM — contract không biết

export const resolvers: Resolvers<typeof contract> = {
  todos: () => db.listTodos(),
  addTodo: ({ title }) => db.addTodo(title),     // title: string (suy từ contract)
  toggleTodo: ({ id }) => db.toggleTodo(id),
};
```

Tiêm vào engine (dùng chung server framework đã chọn):

```ts
import { contract } from "../contract";
import { resolvers } from "./index";
app.use(fluxe(manifest, cells, layouts, { contract, resolvers }));
// hoặc makeServer(manifest, cells, layouts, { contract, resolvers })
```

## Gọi `api` — server 0 hop, client Proxy typed

```ts
// cell loader (server) — gọi resolvers in-process, 0 hop:
import { resolvers as api } from "../../backend";
loader: async () => ({ todos: await api.todos() })

// view / island (client) — Proxy typed, qua /__rpc, 0 schema xuống browser:
import { createClient } from "@nmvuong92/fluxe/client";
import type { AppContract } from "../../contract";   // type-only → elide
const api = createClient<AppContract>();
const add = useMutation("addTodo", (t: string) => api.addTodo({ title: t }));
```

`createClient` là một **JS Proxy**: `api.addTodo({title})` → `POST /__rpc/addTodo`, kiểu suy từ
`AppContract`. Không file sinh, không Zod trong client bundle.

## Runtime `/__rpc/<op>`

`POST /__rpc/<op>` → tra op trong contract (lạ → 404) → **mutation kiểm CSRF** (double-submit, query
bỏ qua) → validate input bằng **Zod sẵn trong contract** (sai → 400 field-level) → `resolvers[op](input)`
→ JSON. Lỗi domain `FluxeError` → status/code; unexpected → 500 + errorId.

## Vì sao 0 codegen (tRPC-style)

| | Lấy từ đâu |
|---|---|
| **Types** | `Infer<>` / `Resolvers<typeof contract>` — compile-time, tức thì |
| **Validate** | schema Zod **chính là** validator |
| **Server dispatch** | engine đọc contract object lúc chạy |
| **Client** | `createClient<AppContract>()` = Proxy typed |

→ Không `.fluxe/gen`, không `fx gen`, không bước build. Sửa `app/contract.ts` → type cập nhật **ngay**
trong editor (như Zod/tRPC).

## Lưu ý

- **Network hop:** SSR loader gọi resolvers **in-process (0 hop)** → mở trang = 0 API call. Lời gọi
  client (sau hydrate) là **1 hop** (browser→server, mọi framework đều vậy) — giảm bằng SSR +
  optimistic + SSE. Contract không thêm hop, chỉ type-safe + validate.
- **Lớp THÊM:** `actions`/`rpc()` cũ vẫn chạy — contract bổ sung, không thay.
- **v1 chưa có:** subscriptions (đã có SSE riêng) · field-selection kiểu GraphQL · batch nhiều op/1 hop · SDK-codegen cho consumer ngoài.
