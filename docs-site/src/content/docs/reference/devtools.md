---
title: Devtools
description: DebugBar (5 tính năng), debug store, headers x-fluxe-*, chaos/live-swap.
sidebar:
  order: 61
---

## Định nghĩa

**Devtools** của fluxe là một thanh debug *trong app* (in-app), cắm một lần vào layout là có đủ
năm tính năng quan sát + thử nghiệm ngay trên trang đang chạy — không cần extension, không cần
mở port riêng. Bối cảnh: giúp dev thấy "full flow" của mỗi query/mutation (backend nào giải,
mất bao lâu, lỗi gì) và **chủ động phá** (chaos) hoặc **đổi backend** (live-swap) để kiểm thử UX.

Quan trọng: **chaos, live-swap và header resolution chỉ bật ở DEV** (`NODE_ENV !== "production"`).
Production không lộ các cơ chế này.

## Cơ chế trong fluxe

**1. DebugBar — 5 tính năng** (nút ⚡ góc dưới-phải mọi trang). Cắm `<DebugBar />` một lần vào
layout là có đủ:

1. **Chaos toggle** — tiêm delay + lỗi giả (fault injection), hằng `CHAOS = "delay=600;fail=0.4"`.
2. **Repro → Test** — "Copy as test" sinh test pasteable từ một mutation event.
3. **RCA badge** — mỗi event hiện `resolution` (vd `rust/http`).
4. **Trace timing** — thanh server-ms vs client-ms.
5. **Live backend swap** — đổi `auto`/`memory`/`go`/`rust` ngay, không restart.

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
import { createTestBackend } from "@nmvuong92/fluxe";

test("repro: ${cell}.${action}", async () => {
  const backend = createTestBackend();
  const out = await ${cell}.actions!.${action}({ input: ${input}, backend });
  assert.deepEqual(out, ${expected});
});`;
}
```

**4. Client gắn header DEV + đọc meta** — chaos/live-swap đi qua header `x-fluxe-*`:

```ts
// @nmvuong92/fluxe/client
let _chaos = "";        // vd "delay=600;fail=0.3"
let _devBackend = "";   // vd "go" | "rust" | "memory"
export const setChaos = (v: string) => { _chaos = v; };
export const setDevBackend = (v: string) => { _devBackend = v; };

// trong rpc():
if (_chaos) headers["x-fluxe-chaos"] = _chaos;             // #1 chaos
if (_devBackend) headers["x-fluxe-backend"] = _devBackend; // #5 live swap
// … sau khi fetch:
_lastMeta = {                                              // #3 resolution + #4 server timing
  resolution: hget("x-fluxe-resolution") ?? undefined,
  serverMs: Number(hget("x-fluxe-server-ms")) || undefined,
  clientMs: Math.round(performance.now() - t0),
};
export const lastRpcMeta = (): RpcMeta => _lastMeta;
```

**5. Server áp dụng — CHỈ Ở DEV** (`NODE_ENV !== "production"`): khi nhận header `x-fluxe-backend`,
engine live-swap backend cho riêng request đó; khi nhận `x-fluxe-chaos`, engine parse rồi tiêm
`delayMs` và ném `FluxeError("chaos", …, 500)` theo `failRate`. Mọi response action đều gắn header
`x-fluxe-resolution` (backend/transport đã giải) và `x-fluxe-server-ms` (thời gian server). Ở
production cả hai header request bị bỏ qua — cơ chế không lộ.

## Ví dụ

Cắm `<DebugBar />` vào layout là có đủ 5 tính năng; ghi event qua store:

```ts
import { DebugBar, debug } from "@nmvuong92/fluxe/react";

const id = debug.start("mutation", "rpc:todos.add");  // bắt đầu event
// … chạy rpc …
debug.finish(id, { status: "ok", data, resolution, serverMs });  // immutable, cap 50
```

Tự ép chaos/swap bằng `curl` (chỉ ăn ở DEV):

```bash
# Tiêm delay 600ms + 40% fail
curl -X POST localhost:5180/__action/todos/add -H "x-fluxe-chaos: delay=600;fail=0.4" \
  -H "x-csrf-token: $CSRF" -b "csrf=$CSRF" -H 'content-type: application/json' -d '{"title":"x"}'

# Live-swap sang backend rust cho riêng request này
curl -X POST localhost:5180/__action/todos/list -H "x-fluxe-backend: rust" \
  -H "x-csrf-token: $CSRF" -b "csrf=$CSRF" -H 'content-type: application/json' -d '{}' -i
# → header x-fluxe-resolution: rust/http (swap)
```

## Headers runtime

| Header | Hướng | Ý nghĩa |
|--------|-------|---------|
| `x-fluxe-resolution` | response | backend/transport đã giải (vd `memory/in-process`, `rust/http (swap)`) |
| `x-fluxe-server-ms` | response | thời gian xử lý phía server (ms) |
| `x-fluxe-chaos` | request | bật chaos cho request đó (`delay=…;fail=…`) — **DEV** |
| `x-fluxe-backend` | request | ép live-swap backend (`memory`/`go`/`rust`/…) — **DEV** |

## API

```ts
// @nmvuong92/fluxe/react
debug.start(kind: EventKind, label: string): number          // bắt đầu event, trả id
debug.finish(id: number, patch: Partial<DebugEvent>): void   // kết thúc; immutable, cap 50

// @nmvuong92/fluxe
parseChaos(header: string | undefined): Chaos                // { delayMs, failRate }

// @nmvuong92/fluxe/react
reproTest(ev: DebugEvent & { input?: unknown }): string      // sinh source test pasteable

// @nmvuong92/fluxe/client
setChaos(v: string): void;        getChaos(): string
setDevBackend(v: string): void;   getDevBackend(): string
lastRpcMeta(): RpcMeta            // { resolution?, serverMs?, clientMs? }
```

## Lưu ý

:::caution
**Chaos, live-swap và header resolution chỉ bật ở DEV** (`NODE_ENV !== "production"`). Server bọc
cả hai header `x-fluxe-chaos`/`x-fluxe-backend` trong `if (DEV && …)` — prod bỏ qua, không lộ
cơ chế này.
:::

- `failRate` được clamp `[0, 1]`, `delayMs` clamp `≥ 0` — header rác không làm crash.
- Chaos fail ném `FluxeError("chaos", …, 500)` — lỗi có kiểu, client thấy như lỗi thật để test
  rollback/optimistic.
- Store `debug` cap **50 event**, cập nhật immutable để `useSyncExternalStore` re-render đúng.
- `reproTest` chỉ áp cho event **mutation** có label dạng `rpc:<cell>.<action>`; nút "Copy as
  test" chỉ hiện khi `e.kind === "mutation"`.
