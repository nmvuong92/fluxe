// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "./resolver.ts";

const cells = [
  { id: "home", route: "/", hydration: "static" as const },
  { id: "todos", route: "/todos", hydration: "island" as const },
];

test("memory profile → in-process", () => {
  const m = resolve(cells, { name: "dev", backend: "memory" });
  assert.equal(m.version, 1);
  assert.equal(m.profile, "dev");
  assert.deepEqual(m.backend, { language: "memory" });
});

test("sqlite profile → in-process", () => {
  const m = resolve(cells, { name: "sqlite", backend: "sqlite" });
  assert.deepEqual(m.backend, { language: "sqlite" });
});

test("render flags map per hydration", () => {
  const m = resolve(cells, { name: "dev", backend: "memory" });
  assert.deepEqual(m.cells.home.render, { mode: "static", shipClientJs: false });
  assert.deepEqual(m.cells.todos.render, { mode: "island", shipClientJs: true });
  assert.equal(m.cells.todos.route, "/todos");
});

test("fail-fast: backend không hợp lệ", () => {
  // @ts-expect-error — ép kind ngoài union để kiểm validate runtime
  assert.throws(() => resolve(cells, { name: "bad", backend: "go" }), /không hợp lệ/);
});

test("fail-fast: duplicate route", () => {
  const dup = [
    { id: "a", route: "/x", hydration: "static" as const },
    { id: "b", route: "/x", hydration: "static" as const },
  ];
  assert.throws(() => resolve(dup, { name: "dev", backend: "memory" }), /route trùng/);
});

test("fail-fast: duplicate id", () => {
  const dup = [
    { id: "a", route: "/x", hydration: "static" as const },
    { id: "a", route: "/y", hydration: "static" as const },
  ];
  assert.throws(() => resolve(dup, { name: "dev", backend: "memory" }), /id trùng/);
});

test("per-cell backend: mỗi cell mang backend riêng, fallback về default", () => {
  const m = resolve(cells, {
    name: "mixed", backend: "memory",
    cellBackends: { todos: "sqlite" },
  });
  // top-level = default
  assert.deepEqual(m.backend, { language: "memory" });
  // todos override → sqlite
  assert.deepEqual(m.cells.todos.backend, { language: "sqlite" });
  // home fallback → memory
  assert.deepEqual(m.cells.home.backend, { language: "memory" });
});

test("per-cell backend: không override → mọi cell = default", () => {
  const m = resolve(cells, { name: "dev", backend: "memory" });
  assert.deepEqual(m.cells.home.backend, { language: "memory" });
  assert.deepEqual(m.cells.todos.backend, { language: "memory" });
});

test("fail-fast: cellBackends trỏ cell không tồn tại", () => {
  assert.throws(
    () => resolve(cells, { name: "bad", backend: "memory", cellBackends: { ghost: "memory" } }),
    /cellBackends.*ghost/,
  );
});
