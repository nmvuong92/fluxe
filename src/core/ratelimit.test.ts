import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./ratelimit.ts";

test("trong capacity → ok, cạn → chặn", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 3, refillPerSec: 1, now: () => t });
  assert.equal(rl.take("a").ok, true);
  assert.equal(rl.take("a").ok, true);
  assert.equal(rl.take("a").ok, true);
  assert.equal(rl.take("a").ok, false); // cạn token
});

test("refill theo thời gian", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 1, refillPerSec: 1, now: () => t });
  assert.equal(rl.take("a").ok, true);
  assert.equal(rl.take("a").ok, false);
  t = 1000; // +1s → +1 token
  assert.equal(rl.take("a").ok, true);
});

test("key cô lập (per-IP)", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 1, refillPerSec: 1, now: () => t });
  assert.equal(rl.take("a").ok, true);
  assert.equal(rl.take("b").ok, true); // key khác, bucket riêng
});

test("retryAfter > 0 khi bị chặn", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 1, refillPerSec: 1, now: () => t });
  rl.take("a");
  assert.ok(rl.take("a").retryAfter >= 1);
});
