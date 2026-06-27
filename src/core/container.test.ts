// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createContainer } from "./container.ts";

test("lazy: register KHÔNG tạo; get mới tạo (memoize singleton)", () => {
  const c = createContainer();
  let created = 0;
  c.register("svc", () => { created++; return { id: created }; });
  assert.equal(created, 0);                 // chưa get → chưa tạo
  assert.equal(c.resolved().length, 0);
  const a = c.get<{ id: number }>("svc");
  const b = c.get<{ id: number }>("svc");
  assert.equal(created, 1);                 // chỉ tạo 1 lần
  assert.equal(a, b);                       // cùng instance (singleton)
  assert.deepEqual(c.resolved(), ["svc"]);
});

test("CHỈ module dùng mới bootstrap: register 3, get 1 → chỉ 1 tạo", () => {
  const c = createContainer();
  let broker = 0, jobs = 0, storage = 0;
  c.register("broker", () => { broker++; return {}; });
  c.register("jobs", () => { jobs++; return {}; });
  c.register("storage", () => { storage++; return {}; });
  c.get("broker");
  assert.deepEqual([broker, jobs, storage], [1, 0, 0]);   // jobs/storage KHÔNG tạo
  assert.deepEqual(c.resolved(), ["broker"]);
});

test("DI: factory resolve dep qua c.get → thứ tự init tự nhiên", () => {
  const order: string[] = [];
  const c = createContainer();
  c.register("a", (c) => { const b = c.get("b"); order.push("a"); return { b }; });
  c.register("b", () => { order.push("b"); return { name: "b" }; });
  const a = c.get<{ b: { name: string } }>("a");
  assert.equal(a.b.name, "b");
  assert.deepEqual(order, ["b", "a"]);      // b tạo trước a (DFS)
});

test("cycle → ném (chuỗi rõ ràng)", () => {
  const c = createContainer();
  c.register("x", (c) => c.get("y"));
  c.register("y", (c) => c.get("x"));
  assert.throws(() => c.get("x"), /cycle/);
});

test("get token chưa đăng ký → ném", () => {
  const c = createContainer();
  assert.throws(() => c.get("none"), /chưa đăng ký/);
});

test("register trùng → ném; override thì được + reset instance", () => {
  const c = createContainer();
  c.register("s", () => 1);
  assert.throws(() => c.register("s", () => 2), /đã đăng ký/);
  assert.equal(c.get("s"), 1);
  c.override("s", () => 2);
  assert.equal(c.get("s"), 2);              // override + tạo lại
});

test("has", () => {
  const c = createContainer();
  c.register("s", () => 1);
  assert.equal(c.has("s"), true);
  assert.equal(c.has("x"), false);
});
