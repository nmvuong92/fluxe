// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTracer, encodeTrace, decodeTrace } from "./trace.ts";

test("[trace] span lồng nhau → cây children đúng + dur ≥ 0", async () => {
  const tr = createTracer();
  await tr.span("resolver", async () => {
    await tr.span("db.query", async () => { /* việc */ });
  });
  const root = tr.finish();
  assert.equal(root.name, "request");
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].name, "resolver");
  assert.equal(root.children[0].children[0].name, "db.query");   // nest đúng dưới resolver
  assert.ok(root.dur >= 0 && root.children[0].dur >= 0);
});

test("[trace] span trả giá trị của fn (xuyên suốt)", async () => {
  const tr = createTracer();
  const v = await tr.span("x", async () => 42);
  assert.equal(v, 42);
});

test("[trace] maxSpans: vượt quota → không thêm node (chống phình)", async () => {
  const tr = createTracer(2);   // root + 1 span
  await tr.span("a", async () => { await tr.span("b", async () => {}); });
  const root = tr.finish();
  // a được ghi (n=2 khi vào b → b chạy thẳng, không node)
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].children.length, 0);
});

test("[trace] encode → decode round-trip; header khổng lồ → '' ", async () => {
  const tr = createTracer();
  await tr.span("r", async () => {});
  const root = tr.finish();
  const enc = encodeTrace(root);
  assert.ok(enc.length > 0);
  assert.deepEqual(decodeTrace(enc), root);
  assert.equal(decodeTrace(null), null);
  assert.equal(decodeTrace("@@@notbase64@@@ %%%"), null);
  // quá maxBytes → ''
  const big = { name: "x", at: 0, dur: 0, children: Array.from({ length: 500 }, (_, i) => ({ name: "n" + i, at: i, dur: 1, children: [] })) };
  assert.equal(encodeTrace(big as any, 100), "");
});
