// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { schemaToJson } from "./schema.ts";

test("scalar Zod → JSON Schema type", () => {
  assert.deepEqual(schemaToJson(z.string()), { type: "string" });
  assert.deepEqual(schemaToJson(z.number()), { type: "number" });
  assert.deepEqual(schemaToJson(z.number().int()), { type: "integer" });
  assert.deepEqual(schemaToJson(z.boolean()), { type: "boolean" });
});

test("object → properties + required (bỏ optional khỏi required)", () => {
  const out = schemaToJson(z.object({ title: z.string(), done: z.boolean().optional() }));
  assert.deepEqual(out.properties, { title: { type: "string" }, done: { type: "boolean" } });
  assert.deepEqual(out.required, ["title"]);
  assert.equal(out.type, "object");
});

test("array → items", () => {
  assert.deepEqual(schemaToJson(z.array(z.string())), { type: "array", items: { type: "string" } });
});

test("validator lạ (không Zod) → permissive {}", () => {
  const fake: any = { "~standard": { version: 1, vendor: "x", validate: () => ({ value: 1 }) } };
  assert.deepEqual(schemaToJson(fake), {});
});
