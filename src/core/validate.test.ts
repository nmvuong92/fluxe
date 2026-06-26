import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { validateInput, withInput } from "./validate.ts";
import { FluxeError } from "./errors.ts";

test("valid → trả data đã parse", () => {
  const r = validateInput(z.object({ title: z.string() }), { title: "x" });
  assert.deepEqual(r, { title: "x" });
});

test("invalid → FluxeError 400 code=validation + details field", () => {
  try {
    validateInput(z.object({ title: z.string().min(1, "rỗng") }), { title: "" });
    assert.fail("phải ném");
  } catch (e) {
    assert.ok(e instanceof FluxeError);
    assert.equal(e.status, 400);
    assert.equal(e.code, "validation");
    assert.ok(Array.isArray((e as FluxeError).details));
    assert.equal((e as any).details[0].path, "title");
  }
});

test("coerce: chuỗi '42' → number 42", () => {
  const r = validateInput(z.object({ n: z.coerce.number() }), { n: "42" });
  assert.equal(r.n, 42);
});

test("withInput gắn inputSchema vào handler", () => {
  const schema = z.object({ id: z.string() });
  const fn = withInput(schema, async () => "ok");
  assert.equal((fn as any).inputSchema, schema);
});
