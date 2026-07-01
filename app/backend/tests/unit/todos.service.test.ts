// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDb } from "@backend/db";
import { makeTodosService } from "@backend/modules/todos/todos.service.ts";
test("service.add trim title", async () => {
  const svc = makeTodosService(makeDb());
  await svc.add("  x  ");
  assert.equal((await svc.list())[0].title, "x");
});
