// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validateStandard, type StandardSchemaV1 } from "./standard.ts";
import { FluxeError } from "./errors.ts";

// Validator GIẢ non-Zod (chỉ implement `~standard`) — chứng minh contract không khoá Zod.
const strSchema: StandardSchemaV1<unknown, string> = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (v) => (typeof v === "string" ? { value: v } : { issues: [{ message: "phải là string", path: ["field"] }] }),
    types: undefined,
  },
};

test("validateStandard: Zod hợp lệ → trả value", async () => {
  const out = await validateStandard(z.object({ title: z.string() }), { title: "x" });
  assert.deepEqual(out, { title: "x" });
});

test("validateStandard: Zod sai → FluxeError 400 code=validation + details có path", async () => {
  await assert.rejects(
    () => validateStandard(z.object({ title: z.string() }), { title: 123 }),
    (e: any) => e instanceof FluxeError && e.code === "validation" && e.status === 400 &&
      Array.isArray(e.details) && e.details.some((d: any) => d.path === "title"),
  );
});

test("validateStandard: validator NON-Zod (chỉ ~standard) cũng chạy", async () => {
  assert.equal(await validateStandard(strSchema, "hi"), "hi");
  await assert.rejects(
    () => validateStandard(strSchema, 42),
    (e: any) => e instanceof FluxeError && (e.details as any[]).some((d) => d.path === "field"),
  );
});
