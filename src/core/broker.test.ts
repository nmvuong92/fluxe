// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBroker } from "./broker.ts";

test("publish tới mọi subscriber của topic", () => {
  const b = createBroker();
  const got: any[] = [];
  b.subscribe("room", (d) => got.push(d));
  b.subscribe("room", (d) => got.push(d));
  b.publish("room", { x: 1 });
  assert.deepEqual(got, [{ x: 1 }, { x: 1 }]);
});

test("topic cô lập — publish topic khác không nhận", () => {
  const b = createBroker();
  const got: any[] = [];
  b.subscribe("a", (d) => got.push(d));
  b.publish("b", 1);
  assert.deepEqual(got, []);
});

test("unsubscribe → không nhận nữa", () => {
  const b = createBroker();
  const got: any[] = [];
  const off = b.subscribe("a", (d) => got.push(d));
  b.publish("a", 1);
  off();
  b.publish("a", 2);
  assert.deepEqual(got, [1]);
});

test("count subscriber", () => {
  const b = createBroker();
  assert.equal(b.count("a"), 0);
  const off = b.subscribe("a", () => {});
  assert.equal(b.count("a"), 1);
  off();
  assert.equal(b.count("a"), 0);
});
