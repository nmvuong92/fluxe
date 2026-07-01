// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeServer } from "../server_factory.ts";
import { f } from "./contract.ts";
import { resolve } from "./resolver.ts";

const Todo = f.object({ id: f.string, title: f.string });
const contract = f.contract({
  listTodos: f.query(Todo.array(), { rest: { method: "GET", path: "/v1/todos" } }),
  getTodo: f.query(Todo, { input: { id: f.string }, rest: { method: "GET", path: "/v1/todos/:id" } }),
  addTodo: f.mutation({ title: f.string }, Todo, { rest: { method: "POST", path: "/v1/todos" } }),
  removeTodo: f.mutation({ id: f.string }, f.null, { rest: { method: "DELETE", path: "/v1/todos/:id" } }),
});
const resolvers = {
  listTodos: () => [{ id: "1", title: "a" }],
  getTodo: (input: { id: string }) => ({ id: input.id, title: "found" }),
  addTodo: (input: { title: string }) => ({ id: "2", title: input.title }),
  removeTodo: (_input: { id: string }) => null,
};

async function serve() {
  const manifest = resolve([], { name: "test" });
  const server = makeServer(manifest, [], {}, { contract, resolvers });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  return { port, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test("[rest] GET /v1/todos → collection", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/todos`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [{ id: "1", title: "a" }]);
  } finally { await close(); }
});

test("[rest] GET /v1/todos/:id → path param vào input", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/todos/42`);
    assert.deepEqual(await res.json(), { id: "42", title: "found" });
  } finally { await close(); }
});

test("[rest] POST /v1/todos → 201 Created + validate lỗi → 400 JSON", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/todos`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "x" }),
    });
    assert.equal(res.status, 201);   // tạo → 201
    assert.deepEqual(await res.json(), { id: "2", title: "x" });
    const bad = await fetch(`http://127.0.0.1:${port}/v1/todos`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: 123 }),
    });
    assert.equal(bad.status, 400);
    const body = await bad.json();
    assert.equal(body.error.code, "validation");   // error standard: { error: { code, ... } }
    assert.ok(Array.isArray(body.error.details));
  } finally { await close(); }
});

test("[rest] DELETE /v1/todos/:id → 204 No Content", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/todos/9`, { method: "DELETE" });
    assert.equal(res.status, 204);
    assert.equal(await res.text(), "");
  } finally { await close(); }
});
