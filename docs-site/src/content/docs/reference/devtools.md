---
title: Devtools
description: DebugBar (4 tính năng), debug store, headers x-fluxe-*, chaos.
sidebar:
  order: 61
---

## Định nghĩa

**Devtools** của fluxe là một thanh debug *trong app* (in-app), cắm một lần vào layout là có đủ
bốn tính năng quan sát + thử nghiệm ngay trên trang đang chạy — không cần extension, không cần
mở port riêng. Bối cảnh: giúp dev thấy "full flow" của mỗi query/mutation (backend nào giải,
mất bao lâu, lỗi gì) và **chủ động phá** (chaos) để kiểm thử UX.

Quan trọng: **chaos và header resolution chỉ bật ở DEV** (`NODE_ENV !== "production"`).
Production không lộ các cơ chế này.

## Cơ chế trong fluxe

**1. DebugBar — live RCA** (nút ⚡ góc dưới-phải mọi trang). Cắm `<DebugBar />` một lần vào
layout là có đủ:

1. **Chaos toggle** — tiêm delay + lỗi giả (fault injection), hằng `CHAOS = "delay=600;fail=0.4"`.
2. **Repro → Test** — "Copy as test" sinh test pasteable từ một mutation event.
3. **RCA badge** — mỗi event hiện `resolution`: render mode + `backend.name` của app (vd `sqlite`).
4. **Trace timing** — thanh server-ms vs client-ms.
5. **Live state** — dòng đọc registry trực tiếp: `query` đang mount · `cached` · request đang bay ·
   `SSE` đang mở (từ `queryStats()` + `sseLive()`).
6. **Filter + Clear** — lọc theo kind (query/mutation/**subscription**/error), nút Clear xoá log.
   Event `subscription` (mỗi message `useSubscription` nhận) cũng hiện trong trace, màu tím.
7. **Span waterfall (Jaeger-lite)** — click 1 event `/__rpc` → cây span pipeline lồng nhau:
   `parse → validate → resolver → publish`, + span DB từ `ctx.span()`. In-process, 0 sidecar.

## Span tracing (waterfall tới backend)

`/__rpc/<op>` tự dựng **cây span** pipeline RCA; resolver thêm span DB qua `ctx.span(name, fn)`
(arg 2). Server encode cây vào header `x-fluxe-trace` (base64 JSON) → DebugBar vẽ waterfall.

```ts
// app/backend/index.ts — resolver thêm span con (hiện dưới "resolver" trong waterfall)
addTodo: async ({ title }, { publish, span }) => {
  const t = await span("db.insert", () => db.addTodo(title));
  publish("todoFeed", await span("db.list", () => db.listTodos()));
  return t;
},
```

```
▼ request            1.09ms
  ├ parse            0.54ms
  ├ validate         0.12ms
  └ resolver         0.27ms
     ├ db.insert     0.04ms   ← ctx.span()
     ├ db.list       0.01ms
     └ publish:todoFeed 0.13ms
```

**Ranh giới:** đây là trace **1-process** cho DX (0 dep, 0 collector). **Distributed/cross-service =
việc HOST** qua OpenTelemetry — fluxe không dựng exporter/sidecar (xem [Một runtime TS]).
Tắt/bật + giới hạn span qua ENV (mặc định TẮT ở production).

**2. Chaos parse** — header `"delay=600;fail=0.3"` → `{ delayMs, failRate }`:

```ts
// @nmvuong92/fluxe
export function parseChaos(header: string | undefined): Chaos {
  const out: Chaos = { delayMs: 0, failRate: 0 };
  for (const part of (header ?? "").split(";")) {
    const [k, v] = part.split("=");
    if (k?.trim() === "delay") out.delayMs = Math.max(0, Number(v) || 0);
    if (k?.trim() === "fail") out.failRate = Math.min(1, Math.max(0, Number(v) || 0));
  }
  return out;
}
```

**3. Repro → Test** — từ một event sinh test dùng `createTestBackend`:

```ts
// @nmvuong92/fluxe/react
export function reproTest(ev: DebugEvent & { input?: unknown }): string {
  const m = ev.label.match(/^rpc:([^.]+)\.(.+)$/);
  const cell = m?.[1] ?? "cell";
  const action = m?.[2] ?? "action";
  // … sinh ra:
  return `import { test } from "node:test";
import assert from "node:assert/strict";
import ${cell} from "../app/cells/${cell}/index";
import { createTestBackend } from "../app/testing";   // spy của bạn (user-land)

test("repro: ${cell}.${action}", async () => {
  const backend = createTestBackend();
  const out = await ${cell}.actions!.${action}({ input: ${input}, backend });
  assert.deepEqual(out, ${expected});
});`;
}
```

**4. Client gắn header DEV + đọc meta** — chaos đi qua header `x-fluxe-*`:

```ts
// @nmvuong92/fluxe/client
let _chaos = "";        // vd "delay=600;fail=0.3"
export const setChaos = (v: string) => { _chaos = v; };

// trong rpc():
if (_chaos) headers["x-fluxe-chaos"] = _chaos;             // #1 chaos
// … sau khi fetch:
_lastMeta = {                                              // #3 resolution + #4 server timing
  resolution: hget("x-fluxe-resolution") ?? undefined,
  serverMs: Number(hget("x-fluxe-server-ms")) || undefined,
  clientMs: Math.round(performance.now() - t0),
};
export const lastRpcMeta = (): RpcMeta => _lastMeta;
```

**5. Server áp dụng — CHỈ Ở DEV** (`NODE_ENV !== "production"`): khi nhận header `x-fluxe-chaos`,
engine parse rồi tiêm `delayMs` và ném `FluxeError("chaos", …, 500)` theo `failRate`. Mọi response
action đều gắn header `x-fluxe-resolution` (`backend.name` của app + render mode) và `x-fluxe-server-ms` (thời gian
server). Ở production header `x-fluxe-chaos` bị bỏ qua — cơ chế không lộ.

## Ví dụ

Cắm `<DebugBar />` vào layout là có đủ 5 tính năng; ghi event qua store:

```ts
import { DebugBar, debug } from "@nmvuong92/fluxe/react";

const id = debug.start("mutation", "rpc:todos.add");  // bắt đầu event
// … chạy rpc …
debug.finish(id, { status: "ok", data, resolution, serverMs });  // immutable, cap 50
```

Tự ép chaos bằng `curl` (chỉ ăn ở DEV):

```bash
# Tiêm delay 600ms + 40% fail
curl -X POST localhost:5180/__action/todos/add -H "x-fluxe-chaos: delay=600;fail=0.4" \
  -H "x-csrf-token: $CSRF" -b "csrf=$CSRF" -H 'content-type: application/json' -d '{"title":"x"}'
```

## Headers runtime

| Header | Hướng | Ý nghĩa |
|--------|-------|---------|
| `x-fluxe-resolution` | response | backend đã giải (vd `memory`, `sqlite`) |
| `x-fluxe-server-ms` | response | thời gian xử lý phía server (ms) |
| `x-fluxe-trace` | response | cây span pipeline (base64 JSON) cho waterfall — gated `FLUXE_TRACE_ENABLED` |
| `x-fluxe-chaos` | request | bật chaos cho request đó (`delay=…;fail=…`) — **DEV** |

## ENV

| Biến | Default | Ý nghĩa |
|------|---------|---------|
| `FLUXE_TRACE_ENABLED` | `true` ở dev/test, `false` ở prod | gửi header `x-fluxe-trace` (waterfall) |
| `FLUXE_TRACE_MAX_SPANS` | `64` | chặn cây span phình (vượt → span chạy thẳng, không ghi node) |

## API

```ts
// @nmvuong92/fluxe/react
debug.start(kind: EventKind, label: string): number          // bắt đầu event, trả id
debug.finish(id: number, patch: Partial<DebugEvent>): void   // kết thúc; immutable, cap 50
debug.clear(): void                                          // xoá log (nút Clear)
queryStats(): { mounted, cached, inflight }                  // live state cho DebugBar

// @nmvuong92/fluxe (resolver ctx — arg 2)
ctx.span<T>(name: string, fn: () => T | Promise<T>): Promise<T>   // span con trong waterfall

// @nmvuong92/fluxe/client
sseLive(): number                                           // số kết nối SSE đang mở
lastRpcMeta(): { resolution?, serverMs?, clientMs?, trace? }    // trace = cây span (Span | null)

// @nmvuong92/fluxe
parseChaos(header: string | undefined): Chaos                // { delayMs, failRate }

// @nmvuong92/fluxe/react
reproTest(ev: DebugEvent & { input?: unknown }): string      // sinh source test pasteable

// @nmvuong92/fluxe/client
setChaos(v: string): void;        getChaos(): string
lastRpcMeta(): RpcMeta            // { resolution?, serverMs?, clientMs? }
```

## Lưu ý

:::caution
**Chaos và header resolution chỉ bật ở DEV** (`NODE_ENV !== "production"`). Server bọc header
`x-fluxe-chaos` trong `if (DEV && …)` — prod bỏ qua, không lộ cơ chế này.
:::

- `failRate` được clamp `[0, 1]`, `delayMs` clamp `≥ 0` — header rác không làm crash.
- Chaos fail ném `FluxeError("chaos", …, 500)` — lỗi có kiểu, client thấy như lỗi thật để test
  rollback/optimistic.
- Store `debug` cap **50 event**, cập nhật immutable để `useSyncExternalStore` re-render đúng.
- `reproTest` chỉ áp cho event **mutation** có label dạng `rpc:<cell>.<action>`; nút "Copy as
  test" chỉ hiện khi `e.kind === "mutation"`.
