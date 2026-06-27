# app/ — phần của DEV (bạn sửa ở đây)

Đây là **Contract Plane** (xem idea.md §6d): nơi dev viết app. Mọi thứ trong `app/`
là của bạn. **Engine (`src/core/*` + runtime) là Resolution Plane — KHÔNG đụng.**

Engine là **một runtime TypeScript duy nhất** chạy trên `node:http` zero-dep. Backend
chỉ là **driver data TS in-process**: `memory` | `sqlite` (engine tự dựng) | `postgres`
(bạn tự inject client `pg`).

## Bạn sửa gì trong `app/`

| Thư mục/File | Bạn làm gì |
|--------------|------------|
| `app/cells/` | Trang/feature: mỗi cell = route + loader + view (+ action/head/layout/guard) |
| `app/layouts/` | Layout dùng chung (nested) bọc view |
| `app/backend.ts` | **Tầng data của bạn**: interface domain + chọn driver (memory / sqlite / postgres) |
| `app/profiles.ts` | Profile resolve render mode (static/island) per môi trường |
| `app/contract.ts` | Schema dữ liệu → codegen ra types TS (`fx gen`) |

## `app/backend.ts` — tầng data của bạn

Bạn định nghĩa **interface domain** của mình + **chọn driver** ngay tại đây, rồi inject vào engine
qua `makeServer(manifest, cells, layouts, { backend })`. Cell chỉ thấy interface.

```ts
import { createMemoryBackend, createSqliteBackend } from "@nmvuong92/fluxe";

export interface Todo { id: string; title: string; done: boolean }
export interface Backend {
  name: string;
  listTodos(): Promise<Todo[]>;
  addTodo(title: string): Promise<Todo>;
  toggleTodo(id: string): Promise<Todo[]>;
}

// Đổi 1 dòng = đổi nơi lưu (memory ↔ sqlite ↔ postgres):
export const backend: Backend = process.env.FLUXE_SQLITE_PATH
  ? createSqliteBackend(process.env.FLUXE_SQLITE_PATH)
  : createMemoryBackend();
```

Đổi driver = sửa một dòng trong `app/backend.ts`. **Cell, frontend, core: KHÔNG đổi một dòng.**
`postgres` cần bạn `npm i pg` + inject client (qua `DATABASE_URL`) bằng `createPostgresBackend(client)`.

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
