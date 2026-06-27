// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChaos } from "./chaos.ts";

test("parse delay + fail", () => {
  assert.deepEqual(parseChaos("delay=600;fail=0.3"), { delayMs: 600, failRate: 0.3 });
});

test("rỗng → 0", () => {
  assert.deepEqual(parseChaos(undefined), { delayMs: 0, failRate: 0 });
  assert.deepEqual(parseChaos(""), { delayMs: 0, failRate: 0 });
});

test("clamp fail [0,1], delay >= 0", () => {
  assert.equal(parseChaos("fail=2").failRate, 1);
  assert.equal(parseChaos("fail=-1").failRate, 0);
  assert.equal(parseChaos("delay=-5").delayMs, 0);
});
