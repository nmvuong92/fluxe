// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "../helpers/make-test-app.ts";
test("[e2e] addTodo rồi listTodos thấy todo", async () => {
  const { port, close } = await startTestServer();
  try {
    await fetch(`http://127.0.0.1:${port}/__rpc/addTodo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "học fluxe" }) });
    const todos = await (await fetch(`http://127.0.0.1:${port}/__rpc/listTodos`, { method: "POST" })).json();
    assert.ok(todos.some((t: any) => t.title === "học fluxe"));
  } finally { await close(); }
});
