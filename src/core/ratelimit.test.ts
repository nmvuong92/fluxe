// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
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

test("LRU bound: số bucket không vượt maxKeys (chống rò RAM theo IP)", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 5, refillPerSec: 1, now: () => t, maxKeys: 3 });
  for (let i = 0; i < 100; i++) rl.take("ip" + i); // 100 IP khác nhau
  assert.ok(rl.size() <= 3, `size ${rl.size()} phải ≤ 3`);
});

test("LRU evict: key cũ bị đẩy ra → quay lại được bucket mới (đầy token)", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 1, refillPerSec: 0.0001, now: () => t, maxKeys: 2 });
  rl.take("a"); // a → 0 token
  rl.take("b");
  rl.take("c"); // maxKeys 2 → evict 'a' (LRU)
  // a đã bị evict → bucket mới đầy token → ok=true (nếu KHÔNG evict thì a vẫn 0 → false)
  assert.equal(rl.take("a").ok, true);
});
