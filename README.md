# fluxe

[![CI](https://github.com/nmvuong92/fluxe/actions/workflows/ci.yml/badge.svg)](https://github.com/nmvuong92/fluxe/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@nmvuong92/fluxe.svg)](https://www.npmjs.com/package/@nmvuong92/fluxe)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Khung fullstack tối giản — **một runtime TypeScript** (chạy trên `node:http` zero-dep) — dựa
trên triết lý **RCA — Resolved Cell Architecture**: *logic chỉ phụ thuộc HỢP ĐỒNG; mọi quyết định
vận hành (render, backend data) là **kết quả được GIẢI** bởi engine, không viết tay.*

> Đổi backend data `memory ↔ sqlite ↔ postgres` chỉ một dòng trong `app/backend/data.ts`, đổi render
> `static ↔ island` qua profile — **cell & frontend không đổi một dòng**.

## Cài & dùng (npm)

```bash
npm i @nmvuong92/fluxe react react-dom zod
```

```ts
import { defineCell, withInput, makeServer } from "@nmvuong92/fluxe";
import { useQuery, useMutation, Link, Nav, ThemeToggle } from "@nmvuong92/fluxe/react";
import { rpc } from "@nmvuong92/fluxe/client";
```

| Import | Nội dung |
|--------|----------|
| `@nmvuong92/fluxe` | engine: defineCell, makeServer, resolver, auth, validate, seo, broker, ratelimit, contract builder `f`… (KHÔNG có driver data — backend là của bạn ở `app/backend/data.ts`) |
| `@nmvuong92/fluxe/react` | useQuery, useMutation, Link, Nav, ThemeToggle, useTheme, DebugBar |
| `@nmvuong92/fluxe/client` | rpc, RpcError, mutate, revalidate, subscribe |
| `@nmvuong92/fluxe/jobs` | queue/dead-letter (cần `--experimental-sqlite`) |

## Chạy nhanh

```bash
npm install
npm run fx -- build        # resolve + prerender + bundle client
npm run fx -- dev          # http://localhost:5180
npm run test:all           # typecheck + 144 unit + integration (selftest2) — TẤT CẢ XANH
```

`fx`: `resolve · prerender · build · dev · test · jobs`.

## Cấu trúc — ranh giới DEV vs ENGINE

```
app/        ← DEV sở hữu (sửa thoải mái) — Contract Plane
  cells/        trang/feature (route + loader + view + action/head/layout/guard)
  layouts/      layout dùng chung (nested)
  backend/      BACKEND của bạn (Express/Hono/Nest + fluxe)
    server.ts     entry: mount fluxe (catch-all) + route riêng của bạn
    data.ts       TẦNG DATA: interface domain + chọn driver (memory/sqlite/postgres); export backend
  profiles.ts   profile resolve render mode (static/island) per môi trường
  contract.ts   contract builder `f` → types suy ra qua Infer<>/Resolvers<>
  env.ts        env có kiểu, validate fail-fast lúc boot
  app.ts        registry cell — sinh tự động (fx sync), đừng sửa

src/        ← ENGINE (không đụng) — Resolution Plane
  core/         resolver · router · errors · auth · validate · contract · layouts ·
                broker · presence · jobs · ratelimit · observe · panel · seo · cli · ...
  server_factory.ts   runtime ráp cell + giải manifest
```

**Quy tắc:** backend là **tầng data của bạn** ở `app/backend/data.ts` (interface domain + chọn driver),
inject qua `makeServer(…, { backend })`. Engine không bao giờ import ngược vào `app/`.

## Tính năng (tất cả TDD + chạy thật)

- **Server** — chạy zero-config (`makeServer`, node:http) HOẶC nhúng vào **Express/Hono/Nest** qua adapter (`@nmvuong92/fluxe/express|hono|nest`)
- **Render** — static (0 JS) · island hydrate · SPA nav (Inertia) · static-prerender · API mode `?json=1`
- **Routing** — động `[param]` → `ctx.input` · **nested layouts** · SEO (head/canonical/OG/JSON-LD per cell, `/sitemap.xml`, `/robots.txt`)
- **Bảo mật (đầy đủ)** — input validation (Zod) · auth password **scrypt** · **RBAC** · **CSRF** double-submit · **rate-limit** token-bucket · error handling không-leak + structured
- **Data** — backend **user-owned** ở `app/backend/data.ts` (bạn tự định nghĩa interface + implement bằng `node:sqlite`/`pg`/ORM trực tiếp), inject qua `makeServer(…, { backend })` · engine 0 driver · **contract builder** `f` → types suy ra qua inference
- **Mutations DX** — `RpcError` có cấu trúc · `mutate()` optimistic + rollback · lỗi validation field-level
- **Realtime (Trục 4g)** — **SSE channel** + pub/sub broker · live-update on action · **presence** (multi-tab)
- **Async** — **job queue bền** (SQLite, retry → dead-letter)
- **Observability** — request log + dashboard `/_fluxe` (RCA Resolution + Recent requests)
- **Config** — env có kiểu, fail-fast lúc boot
- **DX** — `fx` CLI · mock `Backend` test cực dễ · typecheck gate

## Backend data (user-owned, TS in-process)

Backend là **tầng data của bạn** — định nghĩa interface domain ở `app/backend/data.ts` + chọn driver
**TS in-process** dưới đây, inject qua `makeServer(…, { backend })`. Cell chỉ thấy interface:

| Driver | Bạn tự implement bằng |
|--------|------------------------|
| `memory` | object in-RAM — mặc định dev |
| `sqlite` | `node:sqlite` built-in (`DatabaseSync`), 0 dep, persist ra file (cần `--experimental-sqlite`) |
| `postgres` | `npm i pg`, dùng `Pool`/`Client` trực tiếp (`DATABASE_URL`) |

```ts
// app/backend/data.ts — engine không biết gì
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

export const backend: Backend = process.env.FLUXE_SQLITE_PATH
  ? sqliteBackend(process.env.FLUXE_SQLITE_PATH)   // đổi 1 dòng = đổi nơi lưu
  : memoryBackend();
```

Nguồn khác (REST/ORM/Redis)? Tự implement `Backend` là xong — engine không quan tâm bên dưới.

## Triết lý

Toàn bộ định hướng, các trục chiến lược, tenets và nguyên lý RCA: xem **[idea.md](idea.md)**.
Spec + plan: `docs/superpowers/`.

## License

**Apache-2.0** © 2026 nmvuong92. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
Copyright is held solely by the author, who reserves the right to offer the software under
separate commercial terms.
