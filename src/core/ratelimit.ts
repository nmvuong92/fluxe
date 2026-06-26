/* Rate limiting (6b.F) — token bucket per key (vd IP/user/route). Thuần, clock injected.
 * Bucket bound bằng LRU (maxKeys) → CHỐNG RÒ RAM khi nhiều IP (kẻ tấn công nhiều nguồn).
 * Bản 1-node; distributed: chia sẻ bucket qua Redis (gắn 4d), cùng interface. */

export interface RateLimiter {
  take(key: string): { ok: boolean; retryAfter: number };
  size(): number;
}

export function createRateLimiter(opts: {
  capacity: number;       // số token tối đa (burst)
  refillPerSec: number;   // token hồi mỗi giây
  now?: () => number;     // ms — inject để test
  maxKeys?: number;       // bound số bucket (LRU) — mặc định 100k
}): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const max = opts.maxKeys ?? 100_000;
  // Map giữ thứ tự chèn → dùng làm LRU: chạm key = delete+set (đẩy về cuối).
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
