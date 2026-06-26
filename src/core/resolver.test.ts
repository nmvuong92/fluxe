import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "./resolver.ts";

const cells = [
  { id: "home", route: "/", hydration: "static" as const },
  { id: "todos", route: "/todos", hydration: "island" as const },
];

test("memory profile → in-process, no endpoint", () => {
  const m = resolve(cells, { name: "dev", backend: "memory" });
  assert.equal(m.version, 1);
  assert.equal(m.profile, "dev");
  assert.deepEqual(m.backend, { language: "memory", transport: "in-process" });
});

test("go profile → http + endpoint", () => {
  const m = resolve(cells, { name: "prod-go", backend: "go", endpoints: { go: "http://127.0.0.1:8081" } });
  assert.deepEqual(m.backend, { language: "go", transport: "http", endpoint: "http://127.0.0.1:8081" });
});

test("render flags map per hydration", () => {
  const m = resolve(cells, { name: "dev", backend: "memory" });
  assert.deepEqual(m.cells.home.render, { mode: "static", shipClientJs: false });
  assert.deepEqual(m.cells.todos.render, { mode: "island", shipClientJs: true });
  assert.equal(m.cells.todos.route, "/todos");
});

test("fail-fast: go without endpoint", () => {
  assert.throws(() => resolve(cells, { name: "bad", backend: "go" }), /endpoints\.go/);
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
