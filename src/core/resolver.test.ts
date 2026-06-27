// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "./resolver.ts";

const cells = [
  { id: "home", route: "/", hydration: "static" as const },
  { id: "todos", route: "/todos", hydration: "island" as const },
];

test("manifest cơ bản: version + profile", () => {
  const m = resolve(cells, { name: "dev" });
  assert.equal(m.version, 1);
  assert.equal(m.profile, "dev");
});

test("render flags map per hydration", () => {
  const m = resolve(cells, { name: "dev" });
  assert.deepEqual(m.cells.home.render, { mode: "static", shipClientJs: false });
  assert.deepEqual(m.cells.todos.render, { mode: "island", shipClientJs: true });
  assert.equal(m.cells.todos.route, "/todos");
});

test("hydration mặc định island khi không khai báo", () => {
  const m = resolve([{ id: "x", route: "/x" }], { name: "dev" });
  assert.deepEqual(m.cells.x.render, { mode: "island", shipClientJs: true });
});

test("fail-fast: duplicate route", () => {
  const dup = [
    { id: "a", route: "/x", hydration: "static" as const },
    { id: "b", route: "/x", hydration: "static" as const },
  ];
  assert.throws(() => resolve(dup, { name: "dev" }), /route trùng/);
});

test("fail-fast: duplicate id", () => {
  const dup = [
    { id: "a", route: "/x", hydration: "static" as const },
    { id: "a", route: "/y", hydration: "static" as const },
  ];
  assert.throws(() => resolve(dup, { name: "dev" }), /id trùng/);
});
