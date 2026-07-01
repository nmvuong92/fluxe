// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDb } from "@backend/db";
import { makeTodosService } from "@backend/modules/todos/todos.service.ts";

test("service.add trim title rồi list trả todo", async () => {
  const svc = makeTodosService(makeDb());
  await svc.add("  mua sữa  ");
  const all = await svc.list();
  assert.equal(all.length, 1);
  assert.equal(all[0].title, "mua sữa");
});

test("service.toggle lật done", async () => {
  const svc = makeTodosService(makeDb());
  const t = await svc.add("x");
  const toggled = await svc.toggle(t.id);
  assert.equal(toggled?.done, true);
});
