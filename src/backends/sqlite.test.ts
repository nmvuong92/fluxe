// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqliteBackend } from "./sqlite.ts";

test("add + list (in-memory)", async () => {
  const b = createSqliteBackend(":memory:");
  assert.deepEqual(await b.listTodos(), []);
  const t = await b.addTodo("học SQLite");
  assert.equal(t.title, "học SQLite");
  assert.equal(t.done, false);
  assert.equal((await b.listTodos()).length, 1);
  assert.equal(b.name, "sqlite");
});

test("toggle lật done", async () => {
  const b = createSqliteBackend(":memory:");
  const t = await b.addTodo("x");
  const list = await b.toggleTodo(t.id);
  assert.equal(list.find((x) => x.id === t.id)!.done, true);
});

test("PERSIST thật ra file: mở lại thấy data", async () => {
  const path = join(tmpdir(), `fluxe-sqlite-test-${process.pid}.db`);
  try {
    const b1 = createSqliteBackend(path);
    await b1.addTodo("bền vững qua restart");
    // "process" mới: connection khác, cùng file
    const b2 = createSqliteBackend(path);
    const list = await b2.listTodos();
    assert.ok(list.some((t) => t.title === "bền vững qua restart"), "data phải còn sau khi mở lại file");
  } finally {
    try { unlinkSync(path); } catch {}
  }
});
