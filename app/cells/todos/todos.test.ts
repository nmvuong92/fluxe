/* Demo: test BUSINESS LOGIC của cell (loader/action) mà KHÔNG cần HTTP/DB —
 * chỉ tiêm mock Backend. Đây là lợi thế tự nhiên của fluxe (Backend là interface).
 * Chạy: npm run test:cells */
import { test } from "node:test";
import assert from "node:assert/strict";
import todos from "./index";
import { createTestBackend } from "../../testing";

test("loader trả todos + tên backend", async () => {
  const backend = createTestBackend([{ id: "1", title: "a", done: false }]);
  const data = await todos.loader({ input: {}, backend });
  assert.equal(data.todos.length, 1);
  assert.equal(data.backendName, "test");
});

test("action add: tạo todo qua backend + spy đúng", async () => {
  const backend = createTestBackend();
  const created = await todos.actions!.add({ input: { title: "việc mới" }, backend });
  assert.equal(created.title, "việc mới");
  assert.deepEqual(backend.calls.at(-1), { method: "addTodo", args: ["việc mới"] });
});

test("action toggle: lật trạng thái done", async () => {
  const backend = createTestBackend([{ id: "1", title: "a", done: false }]);
  const list = await todos.actions!.toggle({ input: { id: "1" }, backend });
  assert.equal(list.find((t: any) => t.id === "1")!.done, true);
});

test("loader lan truyền lỗi backend (test nhánh lỗi dễ dàng)", async () => {
  const backend = createTestBackend();
  backend.failNext("listTodos");
  await assert.rejects(() => todos.loader({ input: {}, backend }), /test fail: listTodos/);
});
