// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { f, type Resolvers, type Infer } from "./contract.ts";

test("f.query: OpDef kind=query + output là ZodType", () => {
  const Todo = f.object({ id: f.string, done: f.bool });
  const op = f.query(Todo.array());
  assert.equal(op.kind, "query");
  assert.ok(op.output instanceof z.ZodType);
  assert.deepEqual(op.output.parse([{ id: "1", done: true }]), [{ id: "1", done: true }]);
});

test("f.mutation: input shape → z.object; validate hoạt động", () => {
  const Todo = f.object({ id: f.string });
  const op = f.mutation({ title: f.string }, Todo);
  assert.equal(op.kind, "mutation");
  assert.ok(op.input instanceof z.ZodType);
  assert.equal(op.input.safeParse({ title: "x" }).success, true);
  assert.equal(op.input.safeParse({ title: 123 }).success, false);   // sai kiểu
});

test("f.mutation: input đã là ZodType thì giữ nguyên", () => {
  const In = z.object({ id: z.string() });
  const op = f.mutation(In, f.string);
  assert.equal(op.input, In);
});

test("f.contract: trả về op map nguyên vẹn (runtime đọc trực tiếp)", () => {
  const Todo = f.object({ id: f.string });
  const c = f.contract({
    todos: f.query(Todo.array()),
    addTodo: f.mutation({ title: f.string }, Todo),
  });
  assert.equal(c.todos.kind, "query");
  assert.equal(c.addTodo.kind, "mutation");
});

test("Infer + Resolvers: type suy từ contract (compile-time, smoke runtime)", () => {
  const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
  type TodoT = Infer<typeof Todo>;
  const c = f.contract({
    todos: f.query(Todo.array()),
    addTodo: f.mutation({ title: f.string }, Todo),
  });
  // Resolvers<typeof c> ép đúng chữ ký — nếu sai sẽ compile-fail (đây là phần "type tức thì").
  const r: Resolvers<typeof c> = {
    async todos() { return []; },
    async addTodo({ title }) { const t: TodoT = { id: "1", title, done: false }; return t; },
  };
  assert.equal(typeof r.todos, "function");
  assert.equal(typeof r.addTodo, "function");
});
