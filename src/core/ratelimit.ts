/* Rate limiting (6b.F) — token bucket per key (vd IP/user/route). Thuần, clock injected
 * (testable). Bản 1-node; distributed: chia sẻ bucket qua Redis (gắn 4d), cùng interface. */

export interface RateLimiter {
  take(key: string): { ok: boolean; retryAfter: number };
}

export function createRateLimiter(opts: {
  capacity: number;       // số token tối đa (burst)
  refillPerSec: number;   // token hồi mỗi giây
  now?: () => number;     // ms — inject để test
}): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const buckets = new Map<string, { tokens: number; last: number }>();

  return {
    take(key) {
      const t = now();
      let b = buckets.get(key);
      if (!b) { b = { tokens: opts.capacity, last: t }; buckets.set(key, b); }
      // hồi token theo thời gian trôi qua
      b.tokens = Math.min(opts.capacity, b.tokens + ((t - b.last) / 1000) * opts.refillPerSec);
      b.last = t;
      if (b.tokens >= 1) {
        b.tokens -= 1;
        return { ok: true, retryAfter: 0 };
      }
      return { ok: false, retryAfter: Math.ceil((1 - b.tokens) / opts.refillPerSec) };
    },
  };
}
