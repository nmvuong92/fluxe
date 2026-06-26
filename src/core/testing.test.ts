import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestBackend } from "./testing.ts";

test("seed + listTodos trả bản sao đã seed", async () => {
  const b = createTestBackend([{ id: "1", title: "a", done: false }]);
  assert.deepEqual(await b.listTodos(), [{ id: "1", title: "a", done: false }]);
  assert.equal(b.name, "test");
});

test("addTodo thêm + ghi lại call (spy)", async () => {
  const b = createTestBackend();
  const t = await b.addTodo("x");
  assert.equal(t.title, "x");
  assert.deepEqual(b.calls.at(-1), { method: "addTodo", args: ["x"] });
  assert.equal((await b.listTodos()).length, 1);
});

test("toggleTodo lật done", async () => {
  const b = createTestBackend([{ id: "1", title: "a", done: false }]);
  const list = await b.toggleTodo("1");
  assert.equal(list[0].done, true);
});

test("failNext tiêm lỗi đúng 1 lần rồi hồi phục", async () => {
  const b = createTestBackend();
  b.failNext("addTodo");
  await assert.rejects(() => b.addTodo("x"), /test fail: addTodo/);
  // lần sau thành công lại
  const t = await b.addTodo("y");
  assert.equal(t.title, "y");
});
