// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { reproTest } from "./repro.ts";

test("sinh test từ event rpc:todos.add", () => {
  const code = reproTest({
    id: 1, kind: "mutation", label: "rpc:todos.add", status: "ok", startedAt: 0,
    input: { title: "abc" }, data: { id: "3", title: "abc", done: false },
  } as any);
  assert.match(code, /import todos from "\.\.\/app\/cells\/todos\/index"/);
  assert.match(code, /todos\.actions!\.add\(/);
  assert.match(code, /input: \{"title":"abc"\}/);
  assert.match(code, /assert\.deepEqual\(out, \{"id":"3","title":"abc","done":false\}\)/);
});
