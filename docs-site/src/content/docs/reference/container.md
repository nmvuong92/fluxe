---
title: Container (DI lười)
description: Resolved Container — đăng ký service dạng factory, chỉ module được dùng mới bootstrap (lazy singleton), tự bắt phụ thuộc vòng.
sidebar:
  order: 28
---

## Định nghĩa

**Resolved Container** là cơ chế DI của fluxe: bạn *đăng ký* service dưới dạng **factory**
(hàm tạo), nhưng service **chưa được tạo** cho tới lần đầu có code thật sự `get()` nó. Tạo xong
thì **memoize** (singleton) — lần `get()` sau trả lại đúng instance đó.

> Triết lý RCA: service cũng là thứ được *resolve* lười. App không dùng realtime → broker/presence
> **không bao giờ** được khởi tạo. `resolved()` chứng minh điều đó.

```ts
import { createContainer } from "@nmvuong92/fluxe";

const c = createContainer();
c.register("broker", () => createBroker());      // O(1) — KHÔNG tạo broker
c.register("presence", () => createPresence());  // O(1) — KHÔNG tạo presence

c.resolved();            // []  → chưa có gì bootstrap
const broker = c.get("broker");   // lần đầu → tạo + cache
c.resolved();            // ["broker"]  → presence vẫn chưa tạo
```

## API

```ts
interface Container {
  register<T>(token: string, factory: (c: Container) => T): Container; // O(1), 0 instantiate; trùng token → ném
  override<T>(token: string, factory: (c: Container) => T): Container; // ghi đè + reset instance (test/config)
  has(token: string): boolean;
  get<T>(token: string): T;        // lazy + memoize singleton + cycle-safe (DFS)
  resolved(): string[];            // token ĐÃ tạo → "chỉ used mới bootstrap" + observability
}
createContainer(): Container
```

## DI giữa các service

Factory nhận chính container → gọi `c.get(dep)` để lấy phụ thuộc. Thứ tự khởi tạo là **DFS tự
nhiên** (dep tạo trước):

```ts
c.register("mailer", (c) => createMailer(c.get("config")));
c.register("config", () => loadConfig());
const m = c.get("mailer");   // config tạo trước, rồi mailer
```

Phụ thuộc **vòng** (A cần B, B cần A) → ném lỗi nêu rõ chuỗi:

```
Container: phụ thuộc vòng (cycle) tại 'x' — chuỗi: x → y → x
```

## Trong engine (lazy bootstrap)

`makeServer` đăng ký service realtime nặng/optional dưới dạng factory. Chúng chỉ bootstrap khi
request đầu cần:

| Token | Bootstrap khi |
|-------|---------------|
| `broker` | có client SSE đầu tiên, hoặc action đầu tiên publish |
| `presence` | có client SSE kèm `?id=` đầu tiên |

App tĩnh thuần (không SSE, không action) → broker/presence **không bao giờ** tạo. Kiểm chứng:

```bash
curl localhost:5180/_fluxe/stats | jq .bootstrapped   # [] khi chưa ai dùng realtime
```

## DSA & độ phức tạp

- `Map<token, factory>` + `Map<token, instance>` → `register`/`get`(đã tạo) **O(1)**.
- `Set` "đang giải" → bắt cycle theo độ sâu DFS **O(depth)**.
- Không cache vô hạn: số token = số service đăng ký (bounded), không rò RAM.

## Trung thực: perf nằm ở đâu

Service fluxe hiện rẻ (toàn `Map`) → lazy chúng là **clean-arch + chỉ-used-bootstrap**, không
phải win perf lớn. Win perf THẬT thuộc phase sau (đã thiết kế): **lazy cell code-load** (cold-boot
không import hết cell) + **client code-split** (chỉ tải JS island đang xem).

## Phi mục tiêu (hiện tại)

- Chỉ **singleton lười** — chưa transient / request-scope.
- Chưa lazy-cell / code-split (roadmap).
- Không ép service rẻ luôn-dùng (recorder, renderCache, ratelimit) vào container — thực dụng.
