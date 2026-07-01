// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "../helpers/make-test-app.ts";

test("[e2e] POST /__rpc/addTodo rồi listTodos thấy todo", async () => {
  const { port, close } = await startTestServer();
  try {
    await fetch(`http://127.0.0.1:${port}/__rpc/addTodo`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "học fluxe" }),
    });
    const res = await fetch(`http://127.0.0.1:${port}/__rpc/listTodos`, { method: "POST" });
    const todos = await res.json();
    assert.equal(res.status, 200);
    assert.ok(todos.some((t: any) => t.title === "học fluxe"));
  } finally { await close(); }
});

test("[e2e] SSR trang / (home static) render title", async () => {
  const { port, close } = await startTestServer();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /fluxe starter/);
  } finally { await close(); }
});
