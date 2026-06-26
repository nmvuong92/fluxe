import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRouter } from "./router.ts";

const c = (id: string, route: string) => ({ id, route, hydration: "static", loader: async () => ({}), view: () => null }) as any;

test("static route khớp, params rỗng", () => {
  const m = makeRouter([c("home", "/"), c("todos", "/todos")]);
  assert.deepEqual(m("/")!.params, {});
  assert.equal(m("/")!.cell.id, "home");
  assert.equal(m("/todos")!.cell.id, "todos");
});

test("dynamic param trích đúng", () => {
  const m = makeRouter([c("show", "/todos/[id]")]);
  const r = m("/todos/42");
  assert.equal(r!.cell.id, "show");
  assert.deepEqual(r!.params, { id: "42" });
});

test("nhiều param", () => {
  const m = makeRouter([c("p", "/u/[uid]/post/[pid]")]);
  assert.deepEqual(m("/u/7/post/99")!.params, { uid: "7", pid: "99" });
});

test("param được URL-decode", () => {
  const m = makeRouter([c("hello", "/hello/[name]")]);
  assert.deepEqual(m("/hello/th%E1%BA%BF%20gi%E1%BB%9Bi")!.params, { name: "thế giới" });
});

test("no match → null", () => {
  const m = makeRouter([c("home", "/"), c("show", "/todos/[id]")]);
  assert.equal(m("/nope"), null);
  assert.equal(m("/todos/42/extra"), null); // không khớp 1 đoạn
});

test("precedence: static ưu tiên hơn dynamic", () => {
  const m = makeRouter([c("dyn", "/todos/[id]"), c("new", "/todos/new")]);
  assert.equal(m("/todos/new")!.cell.id, "new"); // static thắng
  assert.equal(m("/todos/42")!.cell.id, "dyn");
});
