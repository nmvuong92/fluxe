# fluxe

[![CI](https://github.com/nmvuong92/fluxe/actions/workflows/ci.yml/badge.svg)](https://github.com/nmvuong92/fluxe/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@nmvuong92/fluxe.svg)](https://www.npmjs.com/package/@nmvuong92/fluxe)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Khung fullstack tối giản — **một runtime TypeScript** (chạy trên `node:http` zero-dep) — dựa
trên triết lý **RCA — Resolved Cell Architecture**: *logic chỉ phụ thuộc HỢP ĐỒNG; mọi quyết định
vận hành (render, backend data) là **kết quả được GIẢI** bởi engine, không viết tay.*

> Đổi backend data `memory ↔ sqlite ↔ postgres`, đổi render `static ↔ island`, gộp nhiều backend
> trong một app per-cell — tất cả chỉ sửa `app/profiles.ts`, **cell & frontend không đổi một dòng**.

## Cài & dùng (npm)

```bash
npm i @nmvuong92/fluxe react react-dom zod
```

```ts
import { defineCell, withInput, makeServer, createMemoryBackend } from "@nmvuong92/fluxe";
import { useQuery, useMutation, Link, Nav, ThemeToggle } from "@nmvuong92/fluxe/react";
import { rpc } from "@nmvuong92/fluxe/client";
```

| Import | Nội dung |
|--------|----------|
| `@nmvuong92/fluxe` | engine: defineCell, makeServer, resolver, auth, validate, backends, seo, broker, ratelimit, codegen… |
| `@nmvuong92/fluxe/react` | useQuery, useMutation, Link, Nav, ThemeToggle, useTheme, DebugBar |
| `@nmvuong92/fluxe/client` | rpc, RpcError, mutate, revalidate, subscribe |
| `@nmvuong92/fluxe/jobs` · `/sqlite` | queue/dead-letter · SQLite backend (cần `--experimental-sqlite`) |

## Chạy nhanh

```bash
npm install
npm run fx -- build        # resolve + prerender + bundle (1 schema → types TS qua fx gen)
npm run fx -- dev          # http://localhost:5180
npm run test:all           # typecheck + 107 unit + 28 integration — TẤT CẢ XANH
```

`fx`: `gen · resolve · prerender · build · dev · test · jobs`.

## Cấu trúc — ranh giới DEV vs ENGINE

```
app/        ← DEV sở hữu (sửa thoải mái) — Contract Plane
  cells/        trang/feature (route + loader + view + action/head/layout/guard)
  layouts/      layout dùng chung (nested)
  profiles.ts   CHỌN backend data per môi trường + per-cell (memory/sqlite/postgres)
  contract.ts   schema → codegen types TS
  env.ts        env có kiểu, validate fail-fast lúc boot

src/        ← ENGINE (không đụng) — Resolution Plane
  core/         resolver · router · errors · auth · validate · codegen · layouts ·
                broker · presence · jobs · ratelimit · observe · panel · seo · cli · ...
  server_factory.ts   runtime ráp cell + giải manifest
```

**Quy tắc:** "backend nào đang chạy" do `app/profiles.ts` (config) quyết, **không** do vị trí
folder. Engine không bao giờ import ngược vào `app/`.

## Tính năng (tất cả TDD + chạy thật)

- **Render** — static (0 JS) · island hydrate · SPA nav (Inertia) · static-prerender · API mode `?json=1`
- **Routing** — động `[param]` → `ctx.input` · **nested layouts** · SEO (head/canonical/OG/JSON-LD per cell, `/sitemap.xml`, `/robots.txt`)
- **Bảo mật (đầy đủ)** — input validation (Zod) · auth password **scrypt** · **RBAC** · **CSRF** double-submit · **rate-limit** token-bucket · error handling không-leak + structured
- **Data** — backend TS per-cell (`memory`/`sqlite`/`postgres`) · DB **SQLite thật** (`node:sqlite`) + **Postgres** (inject client `pg`) · **codegen contract** 1 schema → types TS
- **Mutations DX** — `RpcError` có cấu trúc · `mutate()` optimistic + rollback · lỗi validation field-level
- **Realtime (Trục 4g)** — **SSE channel** + pub/sub broker · live-update on action · **presence** (multi-tab)
- **Async** — **job queue bền** (SQLite, retry → dead-letter)
- **Observability** — request log + dashboard `/_fluxe` (RCA Resolution + Recent requests)
- **Config** — env có kiểu, fail-fast lúc boot
- **DX** — `fx` CLI · mock `Backend` test cực dễ · typecheck gate

## Backend data (driver TS in-process)

Backend chỉ là **driver data TypeScript in-process** — chọn qua `app/profiles.ts`, cell không đổi:

| Driver | Ghi chú |
|--------|---------|
| `memory` | in-process, mặc định dev |
| `sqlite` | `node:sqlite` built-in, 0 dep, persist ra file (engine tự dựng) |
| `postgres` | production — **bạn tự inject client `pg`** (`npm i pg` + `DATABASE_URL`) |

```ts
export const profiles = {
  dev:    { name: "dev",    backend: "memory" },
  sqlite: { name: "sqlite", backend: "sqlite" },
  mixed:  { name: "mixed",  backend: "memory", cellBackends: { todos: "sqlite" } },
};
```

## Triết lý

Toàn bộ định hướng, các trục chiến lược, tenets và nguyên lý RCA: xem **[idea.md](idea.md)**.
Spec + plan: `docs/superpowers/`.

## License

**Apache-2.0** © 2026 nmvuong92. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
Copyright is held solely by the author, who reserves the right to offer the software under
separate commercial terms.
