# app/ — phần của DEV (bạn sửa ở đây)

Đây là **Contract Plane** (xem idea.md §6d): nơi dev viết app. Mọi thứ trong `app/`
là của bạn. **Engine (`src/core/*` + runtime) là Resolution Plane — KHÔNG đụng.**

## Bạn sửa gì trong `app/`

| Thư mục/File | Bạn làm gì |
|--------------|------------|
| `app/cells/` | Trang/feature: mỗi cell = route + loader + view (+ action/head/layout/guard) |
| `app/layouts/` | Layout dùng chung (nested) bọc view |
| `app/profiles.ts` | **Chọn backend** cho từng môi trường (memory / go / rust …) + per-cell |
| `app/contract.ts` | Schema dữ liệu → codegen ra types TS/Go/Rust (`fx gen`) |
| `app/native/` | **Service Go/Rust của bạn** (backend / host / hot-path) — dev sở hữu |

## `app/native/` — service polyglot của dev

| Thư mục | Tầng | Trạng thái demo |
|---------|------|------------------|
| `app/native/rust/` | **Backend** (Todo CRUD, Rust) | ✅ **đang dùng** — demo hướng Rust (`backend: "rust"` trong profile) |
| `app/native/go/` | Backend (Todo CRUD, Go) | 💤 dormant — proof polyglot, chưa chọn |
| `app/native/host-go/` | Host/edge (Go) | demo `run-host.sh` |
| `app/native/hot-rust/` | Hot compute (Rust) | demo `run-hot.sh` |

> **Quan trọng:** "backend nào ĐANG chạy" do `app/profiles.ts` quyết (config), **KHÔNG**
> phải do vị trí folder. Rust active vì profile chọn `rust`; Go nằm đây sẵn nhưng dormant.
> Đổi backend = sửa profile, không di chuyển file.

## Ví dụ: dev chọn backend = Rust

Trong `app/profiles.ts`, chỉ cần khai báo — **không đụng core**:

```ts
export const profiles = {
  dev:        { name: "dev",        backend: "memory" },              // dev: 0 hạ tầng
  "prod-rust":{ name: "prod-rust",  backend: "rust",
                endpoints: { rust: "http://127.0.0.1:8082" } },       // prod: service Rust
  // per-cell: cell nóng dùng Rust, còn lại memory
  mixed:      { name: "mixed", backend: "memory",
                endpoints: { go: "http://127.0.0.1:8081" },
                cellBackends: { todos: "go" } },
};
```

Đổi `backend` / `cellBackends` → engine tự giải (Resolution Plane) ra wiring. **Cell,
frontend, core: KHÔNG đổi một dòng.** Đó là RCA.

## Ranh giới (vì sao tách)

- **`app/` (bạn)** import từ engine qua `../../../src/core/*` (sau này là `@fluxe/core`).
- **`src/core/*` (engine)** KHÔNG bao giờ import ngược vào `app/` — chỉ runtime
  (`src/server_factory.ts`) ráp cell của bạn lại. Đụng vào core = đụng vào framework, đừng.

## Lệnh (engine lo, bạn chỉ gọi)

```bash
npm run fx -- gen          # codegen contract → TS/Go/Rust
npm run fx -- dev          # resolve + build + chạy
npm run fx -- test         # unit + integration
```
