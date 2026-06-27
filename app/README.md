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
| `app/profiles.ts` | **Chọn backend data** cho từng môi trường (memory / sqlite / postgres) + per-cell |
| `app/contract.ts` | Schema dữ liệu → codegen ra types TS (`fx gen`) |

## Profiles — chọn backend data

`app/profiles.ts` quyết "backend data nào ĐANG chạy" (config), **KHÔNG** phải vị trí folder.
Đổi backend = sửa profile.

```ts
export const profiles = {
  dev:    { name: "dev",    backend: "memory" },               // dev: 0 hạ tầng
  sqlite: { name: "sqlite", backend: "sqlite" },               // persist ra file
  // per-cell: cell todos dùng sqlite, còn lại memory
  mixed:  { name: "mixed",  backend: "memory",
            cellBackends: { todos: "sqlite" } },
};
```

Đổi `backend` / `cellBackends` → engine tự giải (Resolution Plane) ra wiring. **Cell,
frontend, core: KHÔNG đổi một dòng.** Đó là RCA. `postgres` cần bạn `npm i pg` +
inject client qua `DATABASE_URL`.

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
