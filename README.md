# fluxe

Khung fullstack **polyglot** dựa trên triết lý **RCA — Resolved Cell Architecture**:
*logic chỉ phụ thuộc HỢP ĐỒNG; mọi quyết định vận hành (ngôn ngữ, render, transport,
backend, scale) là **kết quả được GIẢI** bởi engine, không viết tay.*

> Đổi backend từ TS → Go → Rust, đổi render static ↔ island, gộp nhiều backend trong một
> app per-cell — tất cả chỉ sửa `app/profiles.ts`, **cell & frontend không đổi một dòng**.

## Chạy nhanh

```bash
npm install
npm run fx -- build        # resolve + prerender + bundle (1 schema → TS/Go/Rust qua fx gen)
npm run fx -- dev          # http://localhost:5180
npm run test:all           # typecheck + 107 unit + 28 integration — TẤT CẢ XANH
```

`fx`: `gen · resolve · prerender · build · dev · test · jobs`.

## Cấu trúc — ranh giới DEV vs ENGINE

```
app/        ← DEV sở hữu (sửa thoải mái) — Contract Plane
  cells/        trang/feature (route + loader + view + action/head/layout/guard)
  layouts/      layout dùng chung (nested)
  profiles.ts   CHỌN backend per môi trường + per-cell (memory/go/rust)
  contract.ts   schema → codegen TS/Go/Rust
  env.ts        env có kiểu, validate fail-fast lúc boot
  native/       service Go/Rust CỦA DEV (backend/host/hot/actor)

src/        ← ENGINE (không đụng) — Resolution Plane
  core/         resolver · router · errors · auth · validate · codegen · layouts ·
                broker · presence · jobs · ratelimit · observe · panel · seo · cli · ...
  server_factory.ts   runtime ráp cell + giải manifest
```

**Quy tắc:** "backend nào đang chạy" do `app/profiles.ts` (config) quyết, **không** do vị trí
folder. Engine không bao giờ import ngược vào `app/`.

## Tính năng (tất cả TDD + chạy thật)

- **Render** — static (0 JS) · island hydrate · SPA nav (Inertia) · static-prerender (Go phục vụ thẳng) · API mode `?json=1`
- **Routing** — động `[param]` → `ctx.input` · **nested layouts** · SEO (head/canonical/OG/JSON-LD per cell, `/sitemap.xml`, `/robots.txt`)
- **Bảo mật (đầy đủ)** — input validation (Zod) · auth password **scrypt** · **RBAC** · **CSRF** double-submit · **rate-limit** token-bucket · error handling không-leak + structured
- **Data** — backend polyglot per-cell · DB **SQLite thật** + adapter **Postgres** · **codegen contract** 1 schema → TS/Go/Rust
- **Mutations DX** — `RpcError` có cấu trúc · `mutate()` optimistic + rollback · lỗi validation field-level
- **Realtime (Trục 4g)** — **SSE channel** + pub/sub broker · live-update on action · **presence** (multi-tab) · **actor-Go** (BEAM-style: room=goroutine, supervisor restart)
- **Async** — **job queue bền** (SQLite, retry → dead-letter)
- **Observability** — request log + dashboard `/_fluxe` (RCA Resolution + Recent requests)
- **Config** — env có kiểu, fail-fast lúc boot
- **DX** — `fx` CLI · mock `Backend` test cực dễ · typecheck gate

## Polyglot 4 tầng (Go/Rust thật, đã chạy)

| Tầng | Ngôn ngữ | Demo |
|------|----------|------|
| **Backend** (Todo CRUD) | Go · Rust | `./run-native.sh` |
| **Host/edge** (proxy + static) | Go | `./run-host.sh` |
| **Hot compute** (search) | Rust | `./run-hot.sh` |
| **Actor/realtime** (room+supervisor) | Go | `./run-actor.sh` |

Engine viết bằng: **TS** (Resolver + SSR/cell) · **Go** (host/actor) · **Rust** (hot compute) —
mỗi tầng đúng ngôn ngữ tối ưu, đúng §6d của [idea.md](idea.md).

## Triết lý

Toàn bộ định hướng, các trục chiến lược, tenets và nguyên lý RCA: xem **[idea.md](idea.md)**.
Spec + plan: `docs/superpowers/`.
