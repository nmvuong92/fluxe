// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { etagOf, etagMatches } from "./etag.ts";

test("cùng body → cùng etag, khác body → khác", () => {
  assert.equal(etagOf("a"), etagOf("a"));
  assert.notEqual(etagOf("a"), etagOf("b"));
});

test("etag có ngoặc kép (HTTP)", () => {
  assert.match(etagOf("x"), /^".*"$/);
});

test("etagMatches: If-None-Match chứa etag → true", () => {
  const e = etagOf("x");
  assert.equal(etagMatches(e, e), true);
  assert.equal(etagMatches(`"other", ${e}`, e), true);
  assert.equal(etagMatches(undefined, e), false);
  assert.equal(etagMatches(`"nope"`, e), false);
});
