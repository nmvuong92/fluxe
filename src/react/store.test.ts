// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { DebugStore } from "./store.ts";

test("start → pending, finish → ok + ms", () => {
  const s = new DebugStore();
  const id = s.start("query", "q:x");
  assert.equal(s.events[0].status, "pending");
  s.finish(id, { status: "ok", data: 1 });
  assert.equal(s.events[0].status, "ok");
  assert.equal(typeof s.events[0].ms, "number");
});

test("immutable: events đổi reference mỗi mutate (cho useSyncExternalStore)", () => {
  const s = new DebugStore();
  const a = s.events;
  s.start("query", "q");
  assert.notEqual(a, s.events);
});

test("cap 50 sự kiện", () => {
  const s = new DebugStore();
  for (let i = 0; i < 60; i++) s.start("query", "q" + i);
  assert.ok(s.events.length <= 50);
});

test("subscribe nhận thông báo khi có event", () => {
  const s = new DebugStore();
  let n = 0;
  const off = s.subscribe(() => n++);
  s.start("mutation", "m");
  off();
  s.start("mutation", "m2");
  assert.equal(n, 1); // chỉ đếm trước khi unsubscribe
});

test("clear() xoá hết event + thông báo", () => {
  const s = new DebugStore();
  s.start("query", "q");
  s.start("subscription", "sub:feed");
  assert.equal(s.events.length, 2);
  let notified = false;
  s.subscribe(() => { notified = true; });
  s.clear();
  assert.equal(s.events.length, 0);
  assert.ok(notified);
});
