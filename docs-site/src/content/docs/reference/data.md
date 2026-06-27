---
title: Backends
description: Tầng data user-owned — định nghĩa interface domain + tự implement (memory/SQLite/Postgres) ở app/backend/data.ts, inject qua makeServer.
sidebar:
  order: 3
---

Backend là **nghiệp vụ của BẠN nằm sau một CONTRACT** — sống ở `app/backend/`, **không phải trong
engine**. Engine `@nmvuong92/fluxe` **không prescribe driver/DB nào**: nơi khai báo operations là
[Contract DSL](/reference/contract/) (`app/contract.ts`), còn **DB chỉ là chi tiết ẩn bên trong
resolver/implement của bạn**. Bạn tự định nghĩa **interface domain** + **tự implement**, rồi inject
vào engine. Cell/loader/action chỉ thấy interface (hay `api` từ contract) — đổi nơi lưu = thay một
dòng implement, cell & frontend không đổi.

> Khai báo operations ở đâu? → **[Contract DSL](/reference/contract/)** (`defineContract` → `fx gen`
> sinh types + Zod + client `api` + `Resolvers`). Trang này tả phần implement bên dưới — chọn cách
> lưu trữ là **tùy bạn**, các driver dưới đây chỉ là ví dụ, không phải khái niệm của fluxe.

## `app/backend/data.ts` — bạn sở hữu file này

```ts
// app/backend/data.ts — user sở hữu; engine không biết gì
import { DatabaseSync } from "node:sqlite";

// 1) Interface domain CỦA BẠN (Note/User/Order… — ví dụ Todo):
export interface Todo { id: string; title: string; done: boolean }
export interface Backend {
  name: string;
  listTodos(): Promise<Todo[]>;
  addTodo(title: string): Promise<Todo>;
  toggleTodo(id: string): Promise<Todo[]>;
}

// 2a) Driver memory — in-RAM, dev/test:
export function memoryBackend(): Backend {
  let items: Todo[] = [];
  let seq = 0;
  return {
    name: "memory",
    async listTodos() { return items; },
    async addTodo(title) {
      const t: Todo = { id: String(++seq), title, done: false };
      items.push(t);
      return t;
    },
    async toggleTodo(id) {
      items = items.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      return items;
    },
  };
}

// 2b) Driver sqlite — node:sqlite built-in, persist ra file:
export function sqliteBackend(path = ":memory:"): Backend {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, done INTEGER DEFAULT 0)`);
  const list = () =>
    db.prepare(`SELECT id, title, done FROM todos ORDER BY id`).all()
      .map((r: any) => ({ id: String(r.id), title: r.title, done: !!r.done }));
  return {
    name: "sqlite",
    async listTodos() { return list(); },
    async addTodo(title) {
      const { lastInsertRowid } = db.prepare(`INSERT INTO todos (title) VALUES (?)`).run(title);
      return { id: String(lastInsertRowid), title, done: false };
    },
    async toggleTodo(id) {
      db.prepare(`UPDATE todos SET done = NOT done WHERE id = ?`).run(Number(id));
      return list();
    },
  };
}

// 3) Chọn driver NGAY TẠI ĐÂY (đổi 1 dòng = đổi nơi lưu):
export const backend: Backend = process.env.FLUXE_SQLITE_PATH
  ? sqliteBackend(process.env.FLUXE_SQLITE_PATH)
  : memoryBackend();
```

<small>`node:sqlite` cần `node --experimental-sqlite` (Node 22+).</small>

## Inject vào engine

```ts
import { makeServer } from "@nmvuong92/fluxe";
import { backend } from "../app/backend/data";

makeServer(manifest, cells, layouts, { backend }).listen(5180);
```

Cell nhận `backend` trong loader/action; thêm tham số kiểu thứ 3 để `ctx.backend` **có kiểu**:

```ts
import type { Backend } from "../../backend/data";

export default defineCell<{}, TodosData, Backend>({
  loader: async ({ backend }) => ({ todos: await backend.listTodos() }),   // gợi ý + check kiểu
  actions: { add: async ({ input, backend }) => backend.addTodo(input.title) },
});
```

## Driver — bạn tự implement (engine 0 dep data)

| Driver | Cách implement |
|--------|----------------|
| **memory** | object in-RAM (xem `memoryBackend()` trên) — dev/test, 0 hạ tầng |
| **sqlite** | `node:sqlite` built-in (`DatabaseSync`), 0 dep, persist ra file (cần `--experimental-sqlite`) |
| **postgres** | `npm i pg`, dùng `Pool`/`Client` trực tiếp trong implement của bạn |

Ví dụ Postgres — vẫn cùng interface `Backend`, chỉ đổi phần implement:

```ts
import { Pool } from "pg";

export function postgresBackend(url = process.env.DATABASE_URL): Backend {
  const pool = new Pool({ connectionString: url });
  return {
    name: "postgres",
    async listTodos() {
      const { rows } = await pool.query(`SELECT id, title, done FROM todos ORDER BY id`);
      return rows.map((r) => ({ id: String(r.id), title: r.title, done: r.done }));
    },
    async addTodo(title) {
      const { rows } = await pool.query(
        `INSERT INTO todos (title, done) VALUES ($1, false) RETURNING id, title, done`, [title]);
      return { id: String(rows[0].id), title, done: false };
    },
    async toggleTodo(id) {
      await pool.query(`UPDATE todos SET done = NOT done WHERE id = $1`, [id]);
      const { rows } = await pool.query(`SELECT id, title, done FROM todos ORDER BY id`);
      return rows.map((r) => ({ id: String(r.id), title: r.title, done: r.done }));
    },
  };
}
```

Tất cả đều là **TS in-process** (0 roundtrip). Muốn nguồn khác (Redis, REST, KV, ORM…)?
Implement interface của bạn là xong — engine không quan tâm bên dưới là gì.

```ts
export const backend: Backend = {
  name: "my-api",
  async listTodos() { /* fetch từ REST/ORM của bạn */ return []; },
  async addTodo(t) { /* … */ return { id: "1", title: t, done: false }; },
  async toggleTodo(id) { /* … */ return []; },
};
```
