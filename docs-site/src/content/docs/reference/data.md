---
title: Backends
description: Interface Backend, adapter memory/SQLite/Postgres/HTTP, wiring từ manifest.
sidebar:
  order: 3
---

Cell/loader/action chỉ thấy **một interface** `Backend`. Đổi nguồn dữ liệu = thay một
implementation; cell & frontend không đổi.

## Interface Backend

```ts
// @nmvuong92/fluxe
export interface Todo { id: string; title: string; done: boolean }

export interface Backend {
  name: string;
  listTodos(): Promise<Todo[]>;
  addTodo(title: string): Promise<Todo>;
  toggleTodo(id: string): Promise<Todo[]>;
}
```

## Các adapter có sẵn

| Adapter | Ghi chú |
|---------|---------|
| **memory** | in-process, mặc định dev |
| **SQLite** | `node:sqlite` built-in, 0 dep, persist ra file (cần `--experimental-sqlite`) |
| **HTTP** | gọi service polyglot thật (Go/Rust/Python/…) — xem [Switch backend](/guides/switch-backend/) |
| **Postgres** | adapter tham chiếu production (cần `npm i pg` + `DATABASE_URL`) |

```ts
import { createSqliteBackend } from "@nmvuong92/fluxe/sqlite";
const backend = createSqliteBackend("./data.db");   // cùng interface → switch tự do
```

## Wiring từ manifest

Backend được engine giải **per-cell** từ Resolution Manifest, không hardcode trong cell: app có một
backend mặc định, và từng cell có thể override sang backend khác — tất cả quyết định bằng config, cell
không cần biết.

Profile `mixed` cho app default `memory` nhưng cell `todos` giải sang Go — chỉ bằng config
(`cellBackends`). Xem [RCA](/guides/rca/) và [Switch backend](/guides/switch-backend/).
