# app/ — phần của DEV (bạn sửa ở đây)

Đây là **Contract Plane** (xem idea.md §6d): nơi dev viết app. Mọi thứ trong `app/`
là của bạn. **Engine (`src/core/*` + runtime) là Resolution Plane — KHÔNG đụng.**

Engine là **một runtime TypeScript duy nhất** chạy trên `node:http` zero-dep — **không ship
driver data nào**. Backend là **tầng data của bạn** ở `app/backend/data.ts`: bạn tự implement
TS in-process bằng `memory` (object in-RAM) | `sqlite` (`node:sqlite`) | `postgres` (`npm i pg`).
Entry server (`app/backend/server.ts`) mount fluxe (catch-all) + route riêng — đây là backend Express của bạn.

## Bạn sửa gì trong `app/`

| Thư mục/File | Bạn làm gì |
|--------------|------------|
| `app/cells/` | Trang/feature: mỗi cell = route + loader + view (+ action/head/layout/guard) |
| `app/layouts/` | Layout dùng chung (nested) bọc view |
| `app/backend/server.ts` | **Entry server** của bạn: mount fluxe (catch-all) + route riêng (Express/Hono/Nest) |
| `app/backend/data.ts` | **Tầng data của bạn**: interface domain + chọn driver (memory / sqlite / postgres) |
| `app/profiles.ts` | Profile resolve render mode (static/island) per môi trường |
| `app/contract.ts` | Schema dữ liệu → codegen ra types TS (`fx gen`) |

## `app/backend/` — backend của bạn

Thư mục `app/backend/` = backend Express/Hono/Nest của bạn: `server.ts` (entry — mount fluxe
catch-all + route riêng) + `data.ts` (tầng data/service). Ở `app/backend/data.ts` bạn định nghĩa
**interface domain** của mình + **chọn driver** ngay tại đây, rồi inject vào engine
qua `makeServer(manifest, cells, layouts, { backend })`. Cell chỉ thấy interface.

```ts
// app/backend/data.ts — engine không biết gì, bạn tự implement
import { DatabaseSync } from "node:sqlite";

export interface Todo { id: string; title: string; done: boolean }
export interface Backend {
  name: string;
  listTodos(): Promise<Todo[]>;
  addTodo(title: string): Promise<Todo>;
  toggleTodo(id: string): Promise<Todo[]>;
}

export function memoryBackend(): Backend {
  let items: Todo[] = [];
  let seq = 0;
  return {
    name: "memory",
    async listTodos() { return items; },
    async addTodo(title) { const t = { id: String(++seq), title, done: false }; items.push(t); return t; },
    async toggleTodo(id) { items = items.map((t) => t.id === id ? { ...t, done: !t.done } : t); return items; },
  };
}

export function sqliteBackend(path = ":memory:"): Backend {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, done INTEGER DEFAULT 0)`);
  // … CRUD bằng db.prepare(...)
  return { name: "sqlite" } as any;
}

// Đổi 1 dòng = đổi nơi lưu (memory ↔ sqlite ↔ postgres):
export const backend: Backend = process.env.FLUXE_SQLITE_PATH
  ? sqliteBackend(process.env.FLUXE_SQLITE_PATH)
  : memoryBackend();
```

Đổi driver = sửa một dòng trong `app/backend/data.ts`. **Cell, frontend, core: KHÔNG đổi một dòng.**
`postgres` cần bạn `npm i pg` + tự implement `Backend` bằng `Pool`/`Client` (qua `DATABASE_URL`).

## Ranh giới (vì sao tách)

- **`app/` (bạn)** import từ engine qua package `@nmvuong92/fluxe` (local map sang `src/`).
- **`src/core/*` (engine)** KHÔNG bao giờ import ngược vào `app/` — chỉ runtime
  (`src/server_factory.ts`) ráp cell của bạn lại. Đụng vào core = đụng vào framework, đừng.

## Lệnh (engine lo, bạn chỉ gọi)

```bash
npm run fx -- gen          # codegen contract → types TS (.fluxe/gen/types.ts)
npm run fx -- dev          # resolve + build + chạy
npm run fx -- test         # unit + integration
```
