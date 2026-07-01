// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTitle } from "@backend/modules/todos/domain/rules.ts";
test("cleanTitle trim khoảng trắng", () => {
  assert.equal(cleanTitle("  x  "), "x");
});
