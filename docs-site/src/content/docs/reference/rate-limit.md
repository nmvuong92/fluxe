---
title: Rate limit
description: createRateLimiter — token-bucket + LRU (chống rò RAM theo IP).
sidebar:
  order: 24
---

## Định nghĩa

**Rate limit** chặn lạm dụng (spam action, brute-force) bằng **token-bucket per key** (thường là
per-IP). Mỗi key có một "xô" token: mỗi request tiêu 1 token, token hồi đều theo thời gian
(`refillPerSec`), `capacity` cho phép **burst** ngắn. Hết token → từ chối với `429` + header
`retry-after`.

Điểm DSA quan trọng: bucket được **bound bằng LRU** (`maxKeys`). Nếu cứ tạo bucket mới cho mỗi IP mà
không giới hạn, kẻ tấn công nhiều nguồn sẽ làm **rò RAM**. Map giữ thứ tự chèn được dùng làm LRU:
chạm key = `delete + set` (đẩy về cuối), đầy thì evict key cũ nhất (đầu Map) — O(1) mỗi thao tác.

## Cơ chế trong fluxe

```ts
// @nmvuong92/fluxe
export function createRateLimiter(opts: {
  capacity: number;       // số token tối đa (burst)
  refillPerSec: number;   // token hồi mỗi giây
  now?: () => number;     // ms — inject để test
  maxKeys?: number;       // bound số bucket (LRU) — mặc định 100k
}): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const max = opts.maxKeys ?? 100_000;
  const buckets = new Map<string, { tokens: number; last: number }>();

  return {
    take(key) {
      const t = now();
      let b = buckets.get(key);
      if (b) {
        buckets.delete(key); // chạm → đưa về cuối (recently used)
      } else {
        b = { tokens: opts.capacity, last: t };
        if (buckets.size >= max) buckets.delete(buckets.keys().next().value!); // evict LRU (đầu)
      }
      buckets.set(key, b);

      b.tokens = Math.min(opts.capacity, b.tokens + ((t - b.last) / 1000) * opts.refillPerSec);
      b.last = t;
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return { ok: true, retryAfter: 0 };
      }
      return { ok: false, retryAfter: Math.ceil((1 - b.tokens) / opts.refillPerSec) };
    },
    size: () => buckets.size,
  };
}
```

Engine tự tạo một limiter cho action (per-IP, mặc định `capacity: 30, refillPerSec: 10`) và áp
**trước cả CSRF/handler** — vượt hạn trả `429` kèm header `retry-after`, request thừa bị chặn
trước khi tốn công xử lý.

## Ví dụ

Tự tạo limiter và gọi `take(key)` cho mỗi request — hết token thì `ok: false` kèm `retryAfter`:

```ts
// @nmvuong92/fluxe
import { createRateLimiter } from "@nmvuong92/fluxe";

const limiter = createRateLimiter({ capacity: 30, refillPerSec: 10 });  // per-key (vd per-IP)

const r = limiter.take("act:" + ip);
if (!r.ok) {
  // từ chối với 429 + retry-after = r.retryAfter (giây)
}
```

Bắn 50 request liên tiếp cùng key → vượt `capacity: 30` → một số trả `ok: false` (429).

## API

```ts
// @nmvuong92/fluxe
createRateLimiter(opts: { capacity, refillPerSec, now?, maxKeys? }): RateLimiter
interface RateLimiter {
  take(key: string): { ok: boolean; retryAfter: number };
  size(): number;
}
```

## Lưu ý

- `now` inject được → test **không cần `sleep` thật**, chỉ tua đồng hồ giả lập (đo được, behavior-preserving).
- `maxKeys` mặc định 100k — bound RAM theo số IP; quá ngưỡng thì evict LRU, **không rò RAM** dù bị tấn công nhiều nguồn.
- Bản này **1-node** (bucket trong RAM process). Distributed: chia sẻ bucket qua Redis (Trục 4d), giữ nguyên interface `take`.
- Rate-limit chạy **đầu tiên** trong đường action — request thừa bị chặn trước khi tốn công CSRF/parse/handler.

## ENV

`FLUXE_RATELIMIT_CAPACITY` (30) · `FLUXE_RATELIMIT_REFILL` (10) · `FLUXE_RATELIMIT_MAX_KEYS` (5000). Xem [Configuration](/reference/configuration/).
