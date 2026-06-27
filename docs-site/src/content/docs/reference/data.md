---
title: Backends
description: Tầng data user-owned — định nghĩa interface domain ở app/backend.ts, chọn driver memory/SQLite/Postgres, inject qua makeServer.
sidebar:
  order: 3
---

Backend là **tầng data của BẠN** — sống ở `app/backend.ts`, không phải trong engine. Bạn định
nghĩa **interface domain** của mình + chọn nơi lưu (driver), rồi inject vào engine. Cell/loader/
action chỉ thấy interface đó; đổi nơi lưu = thay một dòng, cell & frontend không đổi.

## `app/backend.ts` — bạn sở hữu file này

```ts
import { createMemoryBackend, createSqliteBackend } from "@nmvuong92/fluxe";

// 1) Interface domain CỦA BẠN (Note/User/Order… — ví dụ Todo):
export interface Todo { id: string; title: string; done: boolean }
export interface Backend {
  name: string;
  listTodos(): Promise<Todo[]>;
  addTodo(title: string): Promise<Todo>;
  toggleTodo(id: string): Promise<Todo[]>;
}

// 2) Chọn driver NGAY TẠI ĐÂY (đổi 1 dòng = đổi nơi lưu):
export const backend: Backend = process.env.FLUXE_SQLITE_PATH
  ? createSqliteBackend(process.env.FLUXE_SQLITE_PATH)
  : createMemoryBackend();
```

## Inject vào engine

```ts
import { makeServer } from "@nmvuong92/fluxe";
import { backend } from "../app/backend";

makeServer(manifest, cells, layouts, { backend }).listen(5180);
```

Cell nhận `backend` trong loader/action; thêm tham số kiểu thứ 3 để `ctx.backend` **có kiểu**:

```ts
import type { Backend } from "../../backend";

export default defineCell<{}, TodosData, Backend>({
  loader: async ({ backend }) => ({ todos: await backend.listTodos() }),   // gợi ý + check kiểu
  actions: { add: async ({ input, backend }) => backend.addTodo(input.title) },
});
```

## Driver có sẵn (pin sạc — dùng hay tự viết)

| Driver | Ghi chú |
|--------|---------|
| **memory** | in-process, mặc định dev/test |
| **sqlite** | `node:sqlite` built-in, 0 dep, persist ra file (cần `--experimental-sqlite`) |
| **postgres** | production — **bạn tự inject client `pg`** (`npm i pg`), `createPostgresBackend(client)` |

Cả ba đều là **TS in-process** (0 roundtrip). Muốn nguồn khác (Redis, REST, KV…)? Implement
interface của bạn là xong — engine không quan tâm bên dưới là gì.

```ts
export const backend: Backend = {
  name: "my-api",
  async listTodos() { /* fetch từ REST/ORM của bạn */ return []; },
  async addTodo(t) { /* … */ return { id: "1", title: t, done: false }; },
  async toggleTodo(id) { /* … */ return []; },
};
```

## Quick-start không cần app/backend.ts

Nếu chưa truyền `{ backend }`, engine **fallback** sang driver built-in giải từ `profiles.ts`
(`backend: "memory" | "sqlite"`) cho domain Todo demo — tiện chạy thử ngay. App thật thì định
nghĩa `app/backend.ts` để sở hữu interface + dữ liệu của mình.
