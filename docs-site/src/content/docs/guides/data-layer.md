---
title: Data layer & kiến trúc module
description: Repository seam qua db.ts (đổi ORM 0 sửa module); Drizzle default; promotion path — thêm tầng khi ĐO ĐƯỢC.
sidebar:
  order: 5
---

fluxe theo **pragmatic-DDD**: lấy đúng **một** ý tưởng Clean Architecture đáng giá (domain không biết
ORM), bỏ phần ceremony (repository-class, usecase-per-op, orm-entity + mapper, application layer).
Kết quả: ít file, đổi ORM dễ, DX "nhìn ra pipeline ngay".

## Seam repository = `backend/db.ts` (đã có sẵn)

```ts
// backend/db.ts — INTERFACE (domain-owned) + IMPL (swappable). Đây LÀ repository.
export interface TodoStore { list(): Promise<Todo[]>; add(title: string): Promise<Todo>; toggle(id: string): Promise<Todo | null> }
export function makeDb(): TodoStore { /* memory | drizzle | pg */ }
```

- **Domain (`modules/<x>/domain/rules.ts`) thuần** — không import ORM.
- **Resolver dùng `ctx.db`** (tiêm qua `use:{db:"backend"}`) — chỉ thấy interface, không thấy Drizzle.
- **Đổi driver = sửa `db.ts`**, module KHÔNG đổi. `fx init --driver=memory|drizzle|sqlite|postgres`.

→ Đó chính là "Resolver → domain rules → repository interface → driver impl" — Clean Architecture **đúng ở
điểm duy nhất quan trọng**, không thêm tầng.

## ORM: **Drizzle** (default khuyến nghị)

| Tenet fluxe | Drizzle | Loại ai |
|---|---|---|
| Một runtime TS, 0 binary | ✅ TS thuần | ❌ Prisma (Rust engine) |
| 0 codegen | ✅ code-first | ❌ Prisma |
| Erasable-only (no decorator) | ✅ | ❌ TypeORM/MikroORM (decorator vỡ type-strip) |

Kysely (query builder) = lazier hơn nếu chỉ cần SQL; Drizzle bao được luôn.

## Promotion path — thêm tầng khi ĐO ĐƯỢC (không mặc định)

```text
resolver → ctx.db                         ← mặc định (CRUD, hầu hết module)
resolver → usecase(app) → ctx.db          ← khi resolver làm >1 việc / >1 aggregate
+ domain entity + mapper                  ← khi DB-shape ≠ API-shape thật
+ infrastructure/repository class         ← khi cần Identity Map / Unit of Work (transaction phức tạp)
```

Thêm cho **riêng module đó**, không áp toàn hệ. Đừng dựng sẵn "cho tương lai" — later can scaffold for itself.

## EDA / observability — seam sẵn có, không cần ORM hook

- **Event (EDA):** `ctx.publish("topic", data)` trong resolver → broker/SSE (subscription typed).
- **Trace:** `ctx.span("db.query", () => …)` → waterfall + `/_fluxe`.
- Bền (at-least-once)? Outbox table + `@fluxe/queue` plugin poll → broker. Chỉ khi cần đo được.

## Cache / queue / message bus
Không nhét vào module — dùng **plugin `@fluxe/*`** (opt-in). Xem [RCA](/guides/rca/) mục "cầu nối, không reinvent".
