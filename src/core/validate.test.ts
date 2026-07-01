// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validateInput, withInput } from "./validate.ts";
import { FluxeError } from "./errors.ts";

test("valid → trả data đã parse", async () => {
  const r = await validateInput(z.object({ title: z.string() }), { title: "x" });
  assert.deepEqual(r, { title: "x" });
});

test("invalid → FluxeError 400 code=validation + details field", async () => {
  await assert.rejects(
    () => validateInput(z.object({ title: z.string().min(1, "rỗng") }), { title: "" }),
    (e: any) => e instanceof FluxeError && e.status === 400 && e.code === "validation" &&
      Array.isArray(e.details) && e.details[0].path === "title",
  );
});

test("coerce: chuỗi '42' → number 42", async () => {
  const r = await validateInput(z.object({ n: z.coerce.number() }), { n: "42" });
  assert.equal(r.n, 42);
});

test("withInput gắn inputSchema vào handler", () => {
  const schema = z.object({ id: z.string() });
  const fn = withInput(schema, async () => "ok");
  assert.equal((fn as any).inputSchema, schema);
});
